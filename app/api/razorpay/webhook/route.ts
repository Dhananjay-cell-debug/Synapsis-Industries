// ─── RAZORPAY WEBHOOK (server-to-server, source of truth) ───────────────────
// Razorpay POSTs payment events here. We verify the X-Razorpay-Signature
// header using RAZORPAY_WEBHOOK_SECRET, then process atomically.
//
// Bulletproof rules:
// • RAW body for HMAC verification
// • Idempotency on event id (UNIQUE INDEX in DB)
// • Return 200 for non-retryable failures (deal not found, wrong phase) so
//   Razorpay doesn't retry-storm us. Return 5xx only for transient errors.
// • Production guard: placeholder secret throws (configured in lib/supabase.ts)
//
// Configure in Razorpay Dashboard → Webhooks:
//   URL: https://<your-domain>/api/razorpay/webhook
//   Events: payment.captured, payment.failed, order.paid
//   Secret: RAZORPAY_WEBHOOK_SECRET (env)

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import {
    t3_advancePaid,
    t4_midPaymentPaid,
    t6_finalPaid,
} from "@/lib/phases/transitions";
import type { TransitionResult, TransitionFail } from "@/lib/phases/transitions";
import { PAYMENT_SPLIT } from "@/lib/phases/constants";
import { getDeal, updateDeal } from "@/lib/deals/store";
import {
    getPaymentByOrderId,
    markPaymentPaid,
    markPaymentFailed,
    recordTransaction,
} from "@/lib/payments/db";
import { generateAndPersistInvoice } from "@/lib/invoice/generate";
import { sendPaymentVerifiedEmails } from "@/lib/email/payment-notifications";

// Force Node runtime — we need RAW body access and crypto
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RazorpayWebhookEvent {
    event: string;
    id?: string;
    created_at?: number;
    payload: {
        payment?: {
            entity: {
                id: string;
                order_id: string;
                amount: number;
                status: string;
                method?: string;
                error_description?: string;
                notes: Record<string, string>;
            };
        };
        order?: {
            entity: {
                id: string;
                amount: number;
                status: string;
                notes: Record<string, string>;
            };
        };
    };
}

// Helper: 200 for non-retryable, so Razorpay won't retry forever
const ack = (note: string, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ received: true, note, ...extra });

export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const eventIdHeader = req.headers.get("x-razorpay-event-id") || null;

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const isProd = process.env.NODE_ENV === "production";
    const isPlaceholderSecret = !secret || secret === "whsec_placeholder_replace_after_setup" || secret.includes("xxx");

    // Production: refuse to operate with placeholder secret. Test/dev: allow bypass.
    if (isProd && isPlaceholderSecret) {
        console.error("[razorpay/webhook] PRODUCTION secret missing/placeholder — refusing to process");
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
    }
    if (!isPlaceholderSecret) {
        const valid = verifyWebhookSignature({ rawBody, signature });
        if (!valid) {
            return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
        }
    }

    let event: RazorpayWebhookEvent;
    try { event = JSON.parse(rawBody); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const payment = event.payload.payment?.entity;
    const orderEntity = event.payload.order?.entity;
    const orderId = payment?.order_id || orderEntity?.id;
    const paymentId = payment?.id;
    const notes = payment?.notes || orderEntity?.notes || {};
    const token = notes.token;
    const phase = Number(notes.paymentPhase) as 3 | 4 | 6;
    const eventId = eventIdHeader || `${event.event}_${paymentId || orderId || Date.now()}`;
    const amountPaise = payment?.amount ?? orderEntity?.amount ?? 0;

    // Always log the event (idempotent on eventId — UNIQUE INDEX prevents dupes)
    try {
        await recordTransaction({
            dealToken: token || "unknown",
            type: `webhook.${event.event}`,
            source: "webhook",
            amountPaise,
            razorpayEventId: eventId,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            metadata: { event: event.event, notes, status: payment?.status, method: payment?.method },
        });
    } catch (e) {
        // If recordTransaction itself fails (DB issue), return 5xx so Razorpay retries
        console.error("[webhook] recordTransaction failed", e);
        return NextResponse.json({ error: "Audit log write failed" }, { status: 500 });
    }

    // ─── Handle FAILED ─────────────────────────────────────────────────────
    if (event.event === "payment.failed") {
        if (orderId) {
            const row = await getPaymentByOrderId(orderId);
            if (row && row.status === "pending") {
                await markPaymentFailed(row.id, payment?.error_description || "payment.failed event");
            }
        }
        return ack("failure logged");
    }

    // ─── Handle CAPTURED / ORDER PAID ──────────────────────────────────────
    if (event.event !== "payment.captured" && event.event !== "order.paid") {
        return ack(`ignored event type: ${event.event}`);
    }

    if (!token || !phase || !orderId) {
        return ack("missing notes metadata — cannot reconcile", { token, phase, orderId });
    }

    const deal = await getDeal(token);
    if (!deal) {
        return ack(`deal not found for token=${token}`);          // 200 — non-retryable
    }

    const paymentRow = await getPaymentByOrderId(orderId);
    if (!paymentRow) {
        return ack(`payment row not found for order=${orderId}`); // 200 — non-retryable
    }

    // Idempotency: already paid → no-op
    if (paymentRow.status === "paid") {
        return ack("already paid", { idempotent: true, phase });
    }

    // Mark paid
    await markPaymentPaid({
        paymentId: paymentRow.id,
        razorpayPaymentId: paymentId || "",
    });

    // Run pure transition + persist deal
    const ctx = { paymentId, orderId, source: "webhook" as const };
    const result: TransitionResult =
        phase === 3 ? t3_advancePaid(deal, ctx) :
        phase === 4 ? t4_midPaymentPaid(deal, ctx) :
        phase === 6 ? t6_finalPaid(deal, ctx) :
        { ok: false, reason: `Invalid phase ${phase}` };

    if (!result.ok) {
        const reason = (result as TransitionFail).reason;
        await recordTransaction({
            dealToken: token,
            paymentId: paymentRow.id,
            type: "payment.transition.failed",
            source: "webhook",
            razorpayEventId: `${eventId}_transition_fail`,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            metadata: { reason },
        });
        return ack(`transition_failed: ${reason}`);               // 200 — non-retryable
    }

    // Sync legacy deal.payments[]
    const legacyAmount = Math.round(paymentRow.amount_paise) / (paymentRow.minor_per_major || 100);
    const legacyPayments = (result.deal.payments || []).map(p =>
        p.phase === phase
            ? { ...p, status: "paid" as const, sessionId: orderId, paidAt: Date.now(), amount: legacyAmount }
            : p
    );
    if (!legacyPayments.find(p => p.phase === phase)) {
        legacyPayments.push({
            phase,
            percentage: PAYMENT_SPLIT[phase].percentage,
            amount: legacyAmount,
            status: "paid",
            sessionId: orderId,
            paidAt: Date.now(),
        });
    }

    await updateDeal(token, () => ({
        ...result.deal,
        payments: legacyPayments,
        lastInteractionAt: Date.now(),
    }));

    // Side effects: invoice + email (best-effort)
    try {
        await generateAndPersistInvoice({ dealToken: token, paymentId: paymentRow.id });
    } catch (e) {
        await recordTransaction({
            dealToken: token, paymentId: paymentRow.id,
            type: "invoice.generation.failed",
            source: "system",
            metadata: { error: e instanceof Error ? e.message : String(e) },
        });
    }
    try {
        await sendPaymentVerifiedEmails({ dealToken: token, paymentId: paymentRow.id });
    } catch (e) {
        await recordTransaction({
            dealToken: token, paymentId: paymentRow.id,
            type: "email.notification.failed",
            source: "system",
            metadata: { error: e instanceof Error ? e.message : String(e) },
        });
    }

    const currencySymbol = paymentRow.currency === "USD" ? "$" : "₹";
    console.log(`[webhook] ✅ phase=${phase} deal=${token} amount=${currencySymbol}${legacyAmount} (${paymentRow.currency})`);
    return ack("captured", { phase, paymentId: paymentRow.id });
}
