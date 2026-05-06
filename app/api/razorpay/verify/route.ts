// ─── RAZORPAY PAYMENT VERIFICATION (client-side success callback) ──────────
// Razorpay checkout returns {razorpay_order_id, razorpay_payment_id, razorpay_signature}
// on success. Client sends them here. We:
//   1. Verify HMAC signature (timing-safe)
//   2. Cross-check amount on server (recompute from deal.totalPrice × percentage)
//   3. Mark payment row paid in Supabase (idempotent)
//   4. Run pure transition (deal phase logic)
//   5. Persist deal to JSON store (atomic write)
//   6. Generate invoice + send emails (best-effort, non-blocking on failure)
//   7. Return result
//
// POST body: { token, orderId, paymentId, signature, paymentPhase }
// (Note: we accept BOTH `orderId/paymentId/signature` and Razorpay's native
//  `razorpay_order_id/...` field names for backwards compatibility.)

import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentSignature, rupeesToPaise } from "@/lib/razorpay";
import {
    t3_advancePaid,
    t4_midPaymentPaid,
    t6_finalPaid,
} from "@/lib/phases/transitions";
import type { TransitionResult, TransitionFail } from "@/lib/phases/transitions";
import { PAYMENT_SPLIT, paymentAmountFor } from "@/lib/phases/constants";
import { getDeal, updateDeal } from "@/lib/deals/store";
import {
    getPaymentByOrderId,
    markPaymentPaid,
    recordTransaction,
} from "@/lib/payments/db";
import { generateAndPersistInvoice } from "@/lib/invoice/generate";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Accept both naming conventions for safety
        const token: string | undefined = body.token;
        const orderId: string | undefined = body.orderId ?? body.razorpay_order_id;
        const paymentId: string | undefined = body.paymentId ?? body.razorpay_payment_id;
        const signature: string | undefined = body.signature ?? body.razorpay_signature;
        const paymentPhase = Number(body.paymentPhase) as 3 | 4 | 6;

        if (!token || !orderId || !paymentId || !signature || !paymentPhase) {
            return NextResponse.json({
                error: "Missing required fields: token, orderId, paymentId, signature, paymentPhase",
            }, { status: 400 });
        }
        if (![3, 4, 6].includes(paymentPhase)) {
            return NextResponse.json({ error: `Invalid paymentPhase ${paymentPhase}` }, { status: 400 });
        }

        // ─── Step 1: HMAC signature ────────────────────────────────────────
        const sigOk = verifyPaymentSignature({ orderId, paymentId, signature });
        if (!sigOk) {
            await recordTransaction({
                dealToken: token,
                type: "payment.signature.failed",
                source: "client_callback",
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                metadata: { reason: "HMAC mismatch" },
            });
            return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
        }

        // ─── Step 2: load deal + payment row ──────────────────────────────
        const deal = await getDeal(token);
        if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

        const paymentRow = await getPaymentByOrderId(orderId);
        if (!paymentRow) {
            return NextResponse.json({
                error: "Payment row not found for this Razorpay order — webhook may have failed earlier",
            }, { status: 404 });
        }
        if (paymentRow.deal_token !== token) {
            await recordTransaction({
                dealToken: token,
                paymentId: paymentRow.id,
                type: "payment.token.mismatch",
                source: "client_callback",
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                metadata: { expected: paymentRow.deal_token, got: token },
            });
            return NextResponse.json({ error: "Token/order mismatch" }, { status: 400 });
        }
        if (paymentRow.phase !== paymentPhase) {
            return NextResponse.json({
                error: `Phase mismatch — payment row phase ${paymentRow.phase}, request phase ${paymentPhase}`,
            }, { status: 400 });
        }

        // ─── Step 3: amount cross-check (server-side recompute) ───────────
        const expectedRupees = paymentAmountFor(deal.totalPrice || 0, paymentPhase);
        const expectedPaise = rupeesToPaise(expectedRupees);
        if (paymentRow.amount_paise !== expectedPaise) {
            await recordTransaction({
                dealToken: token,
                paymentId: paymentRow.id,
                type: "payment.amount.mismatch",
                source: "client_callback",
                amountPaise: paymentRow.amount_paise,
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                metadata: { expectedPaise, actualPaise: paymentRow.amount_paise, dealTotal: deal.totalPrice },
            });
            return NextResponse.json({
                error: "Amount mismatch — payment locked for review",
            }, { status: 400 });
        }

        // ─── Step 4: idempotent paid mark ──────────────────────────────────
        if (paymentRow.status === "paid") {
            // Already paid — no-op, return success
            return NextResponse.json({ ok: true, alreadyPaid: true, paymentId: paymentRow.id });
        }

        const updatedPayment = await markPaymentPaid({
            paymentId: paymentRow.id,
            razorpayPaymentId: paymentId,
        });

        // ─── Step 5: log transaction event ─────────────────────────────────
        await recordTransaction({
            dealToken: token,
            paymentId: paymentRow.id,
            type: `payment.captured.phase${paymentPhase}`,
            source: "client_callback",
            amountPaise: updatedPayment.amount_paise,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            metadata: { method: "razorpay" },
        });

        // ─── Step 6: deal transition (pure) + persist ─────────────────────
        const ctx = { paymentId, orderId, source: "webhook" as const };
        const result: TransitionResult =
            paymentPhase === 3 ? t3_advancePaid(deal, ctx) :
            paymentPhase === 4 ? t4_midPaymentPaid(deal, ctx) :
            paymentPhase === 6 ? t6_finalPaid(deal, ctx) :
            { ok: false, reason: "Unreachable" };

        if (!result.ok) {
            // Payment is captured in Supabase but transition failed — flagged for reconciliation
            await recordTransaction({
                dealToken: token,
                paymentId: paymentRow.id,
                type: "payment.transition.failed",
                source: "client_callback",
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                metadata: { reason: (result as TransitionFail).reason },
            });
            return NextResponse.json({
                ok: true,
                paymentCaptured: true,
                transitionFailed: (result as TransitionFail).reason,
            });
        }

        // Sync legacy deal.payments[] array (UI compatibility)
        const legacyPayments = (result.deal.payments || []).map(p =>
            p.phase === paymentPhase
                ? { ...p, status: "paid" as const, sessionId: orderId, paidAt: Date.now() }
                : p
        );
        if (!legacyPayments.find(p => p.phase === paymentPhase)) {
            legacyPayments.push({
                phase: paymentPhase,
                percentage: PAYMENT_SPLIT[paymentPhase].percentage,
                amount: expectedRupees,
                status: "paid",
                sessionId: orderId,
                paidAt: Date.now(),
            });
        }

        const persisted = await updateDeal(token, () => ({
            ...result.deal,
            payments: legacyPayments,
            lastInteractionAt: Date.now(),
        }));

        // ─── Step 7: side effects (invoice only — emails handled by webhook) ──
        // Webhook is source of truth for emails. This avoids double-send race
        // when both verify (client callback) AND webhook fire on same payment.
        // Invoice gen IS idempotent so safe to run here for fast UX (client sees
        // invoice link immediately after pay).
        Promise.resolve()
            .then(async () => {
                try {
                    await generateAndPersistInvoice({
                        dealToken: token,
                        paymentId: paymentRow.id,
                    });
                } catch (e) {
                    await recordTransaction({
                        dealToken: token,
                        paymentId: paymentRow.id,
                        type: "invoice.generation.failed",
                        source: "system",
                        metadata: { error: e instanceof Error ? e.message : String(e) },
                    });
                }
            }).catch(() => { /* swallowed */ });

        return NextResponse.json({ ok: true, deal: persisted, paymentId: paymentRow.id });
    } catch (err) {
        console.error("[razorpay/verify] error:", err);
        const msg = err instanceof Error ? err.message : "Payment verification failed";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
