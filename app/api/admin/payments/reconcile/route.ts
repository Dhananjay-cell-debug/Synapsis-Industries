// ─── ADMIN — PAYMENT RECONCILIATION ────────────────────────────────────────
// Cross-checks Razorpay orders against synapsis.payments table to catch:
//   - Missed webhooks (RP shows paid, DB shows pending)
//   - Stale rows (DB shows pending past due date — never paid)
//   - Amount mismatches (rare but security-critical)
//
// GET  /api/admin/payments/reconcile           → returns diff report
// POST /api/admin/payments/reconcile?recover=1 → also fires transitions for missed webhooks

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { razorpay } from "@/lib/razorpay";
import { supabase } from "@/lib/supabase";
import {
    getPaymentByOrderId,
    markPaymentPaid,
    recordTransaction,
} from "@/lib/payments/db";
import { getDeal, updateDeal } from "@/lib/deals/store";
import {
    t3_advancePaid,
    t4_midPaymentPaid,
    t6_finalPaid,
} from "@/lib/phases/transitions";
import { generateAndPersistInvoice } from "@/lib/invoice/generate";
import { sendPaymentVerifiedEmails } from "@/lib/email/payment-notifications";

export const runtime = "nodejs";

interface DiffEntry {
    type: "missed_webhook" | "stale_pending" | "amount_mismatch" | "razorpay_only" | "ok";
    razorpayOrderId: string;
    razorpayStatus?: string;
    razorpayAmountPaise?: number;
    dbStatus?: string;
    dbAmountPaise?: number;
    dealToken?: string;
    phase?: number;
    paymentRowId?: string;
    notes?: string;
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
    }

    const days = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get("days") || 30)));
    const fromTs = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

    const orders = await razorpay.orders.all({ from: fromTs, count: 100 });
    const diffs: DiffEntry[] = [];

    for (const order of orders.items || []) {
        const orderId = order.id;
        const rpStatus = order.status;
        const rpAmount = Number(order.amount);

        const paymentRow = await getPaymentByOrderId(orderId);
        if (!paymentRow) {
            // Razorpay knows about this order but we don't — usually a test/orphan
            diffs.push({
                type: "razorpay_only",
                razorpayOrderId: orderId,
                razorpayStatus: rpStatus,
                razorpayAmountPaise: rpAmount,
                notes: "Order in Razorpay but no payment row in synapsis.payments",
            });
            continue;
        }

        // Amount mismatch?
        if (paymentRow.amount_paise !== rpAmount) {
            diffs.push({
                type: "amount_mismatch",
                razorpayOrderId: orderId,
                razorpayStatus: rpStatus,
                razorpayAmountPaise: rpAmount,
                dbStatus: paymentRow.status,
                dbAmountPaise: paymentRow.amount_paise,
                dealToken: paymentRow.deal_token,
                phase: paymentRow.phase,
                paymentRowId: paymentRow.id,
                notes: "Amount in DB does not match Razorpay order amount",
            });
            continue;
        }

        // Razorpay paid but DB pending → MISSED WEBHOOK
        if (rpStatus === "paid" && paymentRow.status === "pending") {
            diffs.push({
                type: "missed_webhook",
                razorpayOrderId: orderId,
                razorpayStatus: rpStatus,
                razorpayAmountPaise: rpAmount,
                dbStatus: paymentRow.status,
                dbAmountPaise: paymentRow.amount_paise,
                dealToken: paymentRow.deal_token,
                phase: paymentRow.phase,
                paymentRowId: paymentRow.id,
                notes: "Razorpay shows paid but DB still pending — webhook likely missed",
            });
            continue;
        }

        // DB pending too long (>3 days) and RP also pending → stale
        const ageMs = Date.now() - new Date(paymentRow.created_at).getTime();
        if (paymentRow.status === "pending" && ageMs > 3 * 24 * 60 * 60 * 1000) {
            diffs.push({
                type: "stale_pending",
                razorpayOrderId: orderId,
                razorpayStatus: rpStatus,
                dbStatus: paymentRow.status,
                dealToken: paymentRow.deal_token,
                phase: paymentRow.phase,
                paymentRowId: paymentRow.id,
                notes: `Pending for ${Math.round(ageMs / (24 * 60 * 60 * 1000))} days — likely abandoned`,
            });
            continue;
        }

        diffs.push({
            type: "ok",
            razorpayOrderId: orderId,
            razorpayStatus: rpStatus,
            dbStatus: paymentRow.status,
            dealToken: paymentRow.deal_token,
            phase: paymentRow.phase,
        });
    }

    const summary = {
        scannedDays: days,
        ordersChecked: orders.items?.length || 0,
        missedWebhooks: diffs.filter(d => d.type === "missed_webhook").length,
        amountMismatches: diffs.filter(d => d.type === "amount_mismatch").length,
        stalePending: diffs.filter(d => d.type === "stale_pending").length,
        razorpayOnly: diffs.filter(d => d.type === "razorpay_only").length,
        ok: diffs.filter(d => d.type === "ok").length,
    };

    return NextResponse.json({ summary, diffs });
}

// POST — recover missed webhooks
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
    }
    const adminEmail = session!.user!.email!;

    const body = await req.json().catch(() => ({}));
    const orderIds: string[] = Array.isArray(body.orderIds) ? body.orderIds : [];
    if (orderIds.length === 0) {
        return NextResponse.json({ error: "Provide orderIds[] to recover" }, { status: 400 });
    }

    const results: Array<{ orderId: string; ok: boolean; reason?: string }> = [];

    for (const orderId of orderIds) {
        try {
            const order = await razorpay.orders.fetch(orderId);
            if (order.status !== "paid") {
                results.push({ orderId, ok: false, reason: `Razorpay status not 'paid' (${order.status})` });
                continue;
            }

            const paymentRow = await getPaymentByOrderId(orderId);
            if (!paymentRow) {
                results.push({ orderId, ok: false, reason: "Payment row missing" });
                continue;
            }
            if (paymentRow.status === "paid") {
                results.push({ orderId, ok: true, reason: "Already paid (idempotent)" });
                continue;
            }

            // Find razorpay paymentId for this order
            const payments = await razorpay.orders.fetchPayments(orderId);
            const captured = (payments.items || []).find((p) => p.status === "captured");
            const rpPaymentId = captured?.id || `recovered_${Date.now()}`;

            await markPaymentPaid({ paymentId: paymentRow.id, razorpayPaymentId: rpPaymentId });

            await recordTransaction({
                dealToken: paymentRow.deal_token,
                paymentId: paymentRow.id,
                type: "payment.recovered.reconciliation",
                source: "admin_manual",
                actorEmail: adminEmail,
                amountPaise: paymentRow.amount_paise,
                razorpayOrderId: orderId,
                razorpayPaymentId: rpPaymentId,
                metadata: { reason: "missed webhook recovered via reconcile" },
            });

            // Run transition
            const deal = await getDeal(paymentRow.deal_token);
            if (deal && deal.phase === paymentRow.phase) {
                const ctx = { paymentId: rpPaymentId, orderId, source: "manual" as const, adminEmail, note: "Reconciliation recovery" };
                const result =
                    paymentRow.phase === 3 ? t3_advancePaid(deal, ctx) :
                    paymentRow.phase === 4 ? t4_midPaymentPaid(deal, ctx) :
                    paymentRow.phase === 6 ? t6_finalPaid(deal, ctx) :
                    { ok: false as const, reason: "Invalid phase" };

                if (result.ok) {
                    await updateDeal(paymentRow.deal_token, () => ({
                        ...result.deal,
                        lastInteractionAt: Date.now(),
                    }));
                }
            }

            // Side effects
            try { await generateAndPersistInvoice({ dealToken: paymentRow.deal_token, paymentId: paymentRow.id }); } catch { /* logged */ }
            try { await sendPaymentVerifiedEmails({ dealToken: paymentRow.deal_token, paymentId: paymentRow.id }); } catch { /* logged */ }

            results.push({ orderId, ok: true });
        } catch (e) {
            results.push({ orderId, ok: false, reason: e instanceof Error ? e.message : String(e) });
        }
    }

    return NextResponse.json({ results });
}
