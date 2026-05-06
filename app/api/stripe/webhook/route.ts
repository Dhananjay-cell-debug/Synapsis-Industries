// ─── STRIPE WEBHOOK (server-to-server, source of truth for foreign payments) ─
// Stripe POSTs payment events here. We verify the stripe-signature header
// using STRIPE_WEBHOOK_SECRET (via Stripe SDK), then process atomically.
//
// Bulletproof rules (mirror razorpay/webhook):
// • RAW body for HMAC verification (Stripe SDK handles this)
// • Idempotency on event id (UNIQUE INDEX on stripe_event_id in DB)
// • Return 200 for non-retryable failures so Stripe doesn't retry-storm us
// • Production guard: missing/placeholder secret → 503 (loud failure)
//
// Event coverage:
// • checkout.session.completed (paid synchronously: cards, wallets, link)
// • payment_intent.succeeded     (delayed payment methods: ACH, SEPA settle 3-7d)
// • payment_intent.payment_failed
// • charge.refunded (logged for manual reconciliation)

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyStripeWebhook, isStripeConfigured } from "@/lib/stripe";
import {
    t3_advancePaid,
    t4_midPaymentPaid,
    t6_finalPaid,
} from "@/lib/phases/transitions";
import type { TransitionResult, TransitionFail } from "@/lib/phases/transitions";
import { PAYMENT_SPLIT } from "@/lib/phases/constants";
import { getDeal, updateDeal } from "@/lib/deals/store";
import {
    getPaymentByStripeSessionId,
    getPaymentByStripePaymentIntentId,
    markPaymentPaid,
    markPaymentFailed,
    recordTransaction,
    type PaymentRow,
} from "@/lib/payments/db";
import { generateAndPersistInvoice } from "@/lib/invoice/generate";
import { sendPaymentVerifiedEmails } from "@/lib/email/payment-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ack = (note: string, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ received: true, note, ...extra });

export async function POST(req: NextRequest) {
    const isProd = process.env.NODE_ENV === "production";
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const isPlaceholderSecret = !secret || secret === "whsec_placeholder_replace_after_setup" || secret.includes("xxx");

    // Production: refuse to operate with placeholder secret. Loud failure beats silent retries.
    if (isProd && isPlaceholderSecret) {
        console.error("[stripe/webhook] PRODUCTION secret missing/placeholder — refusing to process");
        return NextResponse.json({ error: "Stripe webhook secret not configured" }, { status: 503 });
    }
    if (!isStripeConfigured()) {
        return NextResponse.json(
            { error: "Stripe not configured (foreign-client flow disabled)" },
            { status: 503 }
        );
    }

    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    let event: Stripe.Event;
    try {
        event = verifyStripeWebhook(rawBody, signature);
    } catch (err) {
        console.error("[stripe/webhook] signature verify failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Always log the event (idempotent on stripe_event_id — UNIQUE INDEX prevents dupes)
    const dealTokenFromEvent = extractDealToken(event);
    try {
        await recordTransaction({
            dealToken: dealTokenFromEvent || "unknown",
            type: `webhook.${event.type}`,
            source: "webhook",
            provider: "stripe",
            stripeEventId: event.id,
            metadata: { type: event.type, livemode: event.livemode },
        });
    } catch (e) {
        console.error("[stripe/webhook] recordTransaction failed", e);
        return NextResponse.json({ error: "Audit log write failed" }, { status: 500 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed":
                return await handleCheckoutCompleted(event);

            case "payment_intent.succeeded":
                // Real handler — covers ACH/SEPA delayed-settle that don't finalize on session.completed
                return await handlePaymentIntentSucceeded(event);

            case "payment_intent.payment_failed":
                return await handlePaymentFailed(event);

            case "charge.refunded":
                return ack(`refund event logged — manual reconciliation required`);

            default:
                return ack(`ignored event type: ${event.type}`);
        }
    } catch (err) {
        console.error("[stripe/webhook] handler error:", err);
        return NextResponse.json({ error: "Handler failed" }, { status: 500 });
    }
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(event: Stripe.Event): Promise<NextResponse> {
    const session = event.data.object as Stripe.Checkout.Session;
    const md = session.metadata || {};
    const token = md.token;
    const phase = Number(md.paymentPhase) as 3 | 4 | 6;
    const sessionId = session.id;
    const piId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!token || !phase) {
        return ack("missing metadata — cannot reconcile", { token, phase });
    }

    // For delayed payment methods (ACH/SEPA), session.completed fires with payment_status='unpaid'.
    // We persist the PI id on the row so payment_intent.succeeded can find it later.
    const paymentRow = await getPaymentByStripeSessionId(sessionId);
    if (!paymentRow) return ack(`payment row not found for session=${sessionId}`);

    if (session.payment_status !== "paid") {
        // Stash the PI id on the row so the later payment_intent.succeeded webhook can mark paid.
        if (piId && !paymentRow.stripe_payment_intent_id) {
            await updatePaymentStripePI(paymentRow.id, piId);
        }
        await recordTransaction({
            dealToken: token,
            paymentId: paymentRow.id,
            type: "payment.stripe.session.awaiting_payment",
            source: "webhook",
            provider: "stripe",
            stripeSessionId: sessionId,
            stripePaymentIntentId: piId,
            metadata: { paymentStatus: session.payment_status, paymentMethod: session.payment_method_types },
        });
        return ack(`session awaiting payment (status=${session.payment_status}) — will mark paid on payment_intent.succeeded`, { sessionId, piId });
    }

    // Synchronous path (cards/wallets) — finalize now
    return finalizePaidPayment({
        token, phase, paymentRow, sessionId, piId, event,
    });
}

async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<NextResponse> {
    const pi = event.data.object as Stripe.PaymentIntent;
    const piId = pi.id;
    const md = pi.metadata || {};
    const token = md.token;
    const phase = Number(md.paymentPhase) as 3 | 4 | 6;

    if (!token || !phase) {
        // Could be a Checkout-created PI without our metadata (older flows). Try by PI id.
        const row = await getPaymentByStripePaymentIntentId(piId);
        if (!row) return ack(`pi succeeded but no metadata + no matching payment row (pi=${piId})`);
        return finalizePaidPayment({
            token: row.deal_token,
            phase: row.phase,
            paymentRow: row,
            sessionId: row.stripe_session_id || piId,
            piId,
            event,
        });
    }

    // Look up by PI id first (set during checkout.session.completed for delayed methods),
    // fall back to scanning by token+phase via getPaymentByStripeSessionId not available — use by-PI.
    let paymentRow = await getPaymentByStripePaymentIntentId(piId);
    if (!paymentRow) {
        // Older flow: PI not yet stored. Webhook ordering edge case.
        return ack(`pi.succeeded received but payment row not found (pi=${piId}) — checkout.session.completed may arrive shortly`);
    }

    return finalizePaidPayment({
        token, phase, paymentRow,
        sessionId: paymentRow.stripe_session_id || piId,
        piId, event,
    });
}

async function finalizePaidPayment(args: {
    token: string;
    phase: 3 | 4 | 6;
    paymentRow: PaymentRow;
    sessionId: string;
    piId: string | undefined;
    event: Stripe.Event;
}): Promise<NextResponse> {
    const { token, phase, paymentRow, sessionId, piId, event } = args;

    const deal = await getDeal(token);
    if (!deal) return ack(`deal not found for token=${token}`);

    // Idempotency: already paid → no-op
    if (paymentRow.status === "paid") {
        return ack("already paid", { idempotent: true, phase });
    }

    // Mark paid
    await markPaymentPaid({
        paymentId: paymentRow.id,
        stripePaymentIntentId: piId || undefined,
    });

    // Run pure transition + persist deal
    const ctx = { paymentId: piId, orderId: sessionId, source: "webhook" as const };
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
            provider: "stripe",
            stripeEventId: `${event.id}_transition_fail`,
            stripeSessionId: sessionId,
            stripePaymentIntentId: piId,
            metadata: { reason },
        });
        return ack(`transition_failed: ${reason}`);
    }

    // Sync legacy deal.payments[]
    const legacyAmountMajor = (paymentRow.amount_paise || 0) / 100;     // cents → dollars
    const legacyPayments = (result.deal.payments || []).map(p =>
        p.phase === phase
            ? { ...p, status: "paid" as const, sessionId, paidAt: Date.now(), amount: legacyAmountMajor }
            : p
    );
    if (!legacyPayments.find(p => p.phase === phase)) {
        legacyPayments.push({
            phase,
            percentage: PAYMENT_SPLIT[phase].percentage,
            amount: legacyAmountMajor,
            status: "paid",
            sessionId,
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
            provider: "stripe",
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
            provider: "stripe",
            metadata: { error: e instanceof Error ? e.message : String(e) },
        });
    }

    console.log(`[stripe/webhook] ✅ phase=${phase} deal=${token} amount=$${legacyAmountMajor}`);
    return ack("captured", { phase, paymentId: paymentRow.id });
}

async function handlePaymentFailed(event: Stripe.Event): Promise<NextResponse> {
    const pi = event.data.object as Stripe.PaymentIntent;

    // Look up by PI id directly — we always store it on the payment row.
    const paymentRow = await getPaymentByStripePaymentIntentId(pi.id);

    if (paymentRow && paymentRow.status === "pending") {
        await markPaymentFailed(
            paymentRow.id,
            pi.last_payment_error?.message || "payment_intent.payment_failed event"
        );
    }
    return ack("failure logged");
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractDealToken(event: Stripe.Event): string | null {
    const obj = event.data.object as { metadata?: Record<string, string> };
    return obj?.metadata?.token || null;
}

async function updatePaymentStripePI(paymentId: string, piId: string): Promise<void> {
    const { supabase } = await import("@/lib/supabase");
    await supabase
        .from("payments")
        .update({ stripe_payment_intent_id: piId })
        .eq("id", paymentId)
        .is("stripe_payment_intent_id", null);     // only set if not yet set (first-write wins)
}
