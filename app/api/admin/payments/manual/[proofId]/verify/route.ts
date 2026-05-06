// ─── ADMIN — VERIFY MANUAL NEFT PROOF ───────────────────────────────────────
// Admin reviews a manual NEFT submission and verifies it (after checking
// bank statement). On verify:
//   1. Mark proof verified
//   2. Mark payment row paid (links to proof.payment_id)
//   3. Run pure transition (same as Razorpay path) → deal phase advance
//   4. Generate invoice + email client + alert admin
//
// POST body: { adminNote?: string }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDeal, updateDeal } from "@/lib/deals/store";
import {
    getManualProof,
    markManualProofVerified,
    markPaymentPaid,
    recordTransaction,
} from "@/lib/payments/db";
import { supabase } from "@/lib/supabase";
import {
    t3_advancePaid,
    t4_midPaymentPaid,
    t6_finalPaid,
} from "@/lib/phases/transitions";
import type { TransitionResult, TransitionFail } from "@/lib/phases/transitions";
import { PAYMENT_SPLIT, paymentAmountFor } from "@/lib/phases/constants";
import { paiseToRupees } from "@/lib/razorpay";
import { generateAndPersistInvoice } from "@/lib/invoice/generate";
import { sendPaymentVerifiedEmails } from "@/lib/email/payment-notifications";

export const runtime = "nodejs";

export async function POST(
    req: NextRequest,
    { params }: { params: { proofId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
    }
    const adminEmail = session!.user!.email!;

    const proofId = params.proofId;
    const body = await req.json().catch(() => ({}));
    const adminNote: string = body.adminNote || "Verified against bank statement";
    if (adminNote.length < 10) {
        return NextResponse.json({ error: "adminNote must be at least 10 characters (audit requirement)" }, { status: 400 });
    }

    const proof = await getManualProof(proofId);
    if (!proof) return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    if (proof.status !== "pending_review") {
        return NextResponse.json({ error: `Proof already ${proof.status}` }, { status: 400 });
    }

    // Find the linked pending_admin_verify payment row
    const { data: paymentRows, error: rowsErr } = await supabase
        .from("payments")
        .select("*")
        .eq("deal_token", proof.deal_token)
        .eq("phase", proof.phase)
        .eq("status", "pending_admin_verify")
        .order("created_at", { ascending: false })
        .limit(1);
    if (rowsErr || !paymentRows || paymentRows.length === 0) {
        return NextResponse.json({ error: "No pending_admin_verify payment row found" }, { status: 500 });
    }
    const paymentRow = paymentRows[0];

    // Mark payment paid
    await markPaymentPaid({
        paymentId: paymentRow.id,
        razorpayPaymentId: `neft_${proof.utr}`,
    });

    // Mark proof verified + link to payment
    await markManualProofVerified({
        proofId,
        paymentId: paymentRow.id,
        reviewerEmail: adminEmail,
    });

    // Audit
    await recordTransaction({
        dealToken: proof.deal_token,
        paymentId: paymentRow.id,
        type: `payment.captured.phase${proof.phase}.manual`,
        source: "admin_manual",
        actorEmail: adminEmail,
        amountPaise: proof.amount_paise,
        metadata: { utr: proof.utr, proofId, adminNote },
    });

    // Run pure transition + persist deal
    const deal = await getDeal(proof.deal_token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const ctx = {
        paymentId: `neft_${proof.utr}`,
        orderId: `manual_${proof.id}`,
        source: "manual" as const,
        adminEmail,
        note: adminNote,
    };
    const result: TransitionResult =
        proof.phase === 3 ? t3_advancePaid(deal, ctx) :
        proof.phase === 4 ? t4_midPaymentPaid(deal, ctx) :
        proof.phase === 6 ? t6_finalPaid(deal, ctx) :
        { ok: false, reason: "Invalid phase" };

    if (!result.ok) {
        await recordTransaction({
            dealToken: proof.deal_token,
            paymentId: paymentRow.id,
            type: "payment.transition.failed",
            source: "admin_manual",
            actorEmail: adminEmail,
            metadata: { reason: (result as TransitionFail).reason, proofId },
        });
        return NextResponse.json({
            ok: true,
            paymentCaptured: true,
            transitionFailed: (result as TransitionFail).reason,
        });
    }

    // Sync legacy
    const legacyAmount = paiseToRupees(paymentRow.amount_paise);
    const expectedRupees = paymentAmountFor(deal.totalPrice || 0, proof.phase);
    const legacyPayments = (result.deal.payments || []).map(p =>
        p.phase === proof.phase
            ? { ...p, status: "paid" as const, sessionId: `neft_${proof.utr}`, paidAt: Date.now(), amount: legacyAmount || expectedRupees }
            : p
    );
    if (!legacyPayments.find(p => p.phase === proof.phase)) {
        legacyPayments.push({
            phase: proof.phase,
            percentage: PAYMENT_SPLIT[proof.phase].percentage,
            amount: legacyAmount || expectedRupees,
            status: "paid",
            sessionId: `neft_${proof.utr}`,
            paidAt: Date.now(),
        });
    }

    await updateDeal(proof.deal_token, () => ({
        ...result.deal,
        payments: legacyPayments,
        lastInteractionAt: Date.now(),
    }));

    // Side effects
    Promise.resolve().then(async () => {
        try { await generateAndPersistInvoice({ dealToken: proof.deal_token, paymentId: paymentRow.id }); }
        catch (e) {
            await recordTransaction({
                dealToken: proof.deal_token, paymentId: paymentRow.id,
                type: "invoice.generation.failed",
                source: "system",
                metadata: { error: e instanceof Error ? e.message : String(e) },
            });
        }
        try { await sendPaymentVerifiedEmails({ dealToken: proof.deal_token, paymentId: paymentRow.id }); }
        catch (e) {
            await recordTransaction({
                dealToken: proof.deal_token, paymentId: paymentRow.id,
                type: "email.notification.failed",
                source: "system",
                metadata: { error: e instanceof Error ? e.message : String(e) },
            });
        }
    }).catch(() => { /* swallowed */ });

    return NextResponse.json({ ok: true, paymentId: paymentRow.id, dealToken: proof.deal_token });
}
