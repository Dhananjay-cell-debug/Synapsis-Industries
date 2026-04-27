// ─── RAZORPAY WEBHOOK (server-to-server, source of truth) ───────────────────
// Razorpay POSTs payment events here. We verify the X-Razorpay-Signature
// header using RAZORPAY_WEBHOOK_SECRET, then fire the matching transition.
// This is idempotent — if the deal already shows the payment paid, we no-op.
//
// Configure in Razorpay Dashboard → Webhooks:
//   URL: https://<your-domain>/api/razorpay/webhook
//   Events: payment.captured, payment.failed, order.paid
//   Secret: matches RAZORPAY_WEBHOOK_SECRET in .env.local

import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { verifyWebhookSignature, paiseToRupees } from "@/lib/razorpay";
import { t3_advancePaid, t4_midPaymentPaid, t6_finalPaid } from "@/lib/phases/transitions";
import type { TransitionResult, TransitionFail } from "@/lib/phases/transitions";
import type { Deal } from "@/app/api/deals/route";

const DATA_FILE = path.join(process.cwd(), "data", "deals.json");

async function readDeals(): Promise<Deal[]> {
    try {
        const raw = await readFile(DATA_FILE, "utf8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function writeDeals(deals: Deal[]) {
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(deals, null, 2));
}

export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const inDevBypass = !secret || secret === "whsec_placeholder_replace_after_setup";

    if (!inDevBypass) {
        const valid = verifyWebhookSignature({ rawBody, signature });
        if (!valid) {
            return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
        }
    }

    let event: {
        event: string;
        payload: {
            payment?: { entity: { id: string; order_id: string; amount: number; notes: Record<string, string> } };
            order?: { entity: { id: string; notes: Record<string, string> } };
        };
    };
    try {
        event = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // We act on payment.captured — everything else is logged and ignored.
    if (event.event !== "payment.captured" && event.event !== "order.paid") {
        console.log(`[razorpay/webhook] ignored event: ${event.event}`);
        return NextResponse.json({ received: true });
    }

    const payment = event.payload.payment?.entity;
    const orderEntity = event.payload.order?.entity;

    const orderId = payment?.order_id || orderEntity?.id;
    const paymentId = payment?.id;
    const notes = payment?.notes || orderEntity?.notes || {};
    const token = notes.token;
    const paymentPhase = Number(notes.paymentPhase);
    const amount = payment?.amount ? paiseToRupees(payment.amount) : 0;

    if (!token || !paymentPhase || !orderId) {
        console.warn("[razorpay/webhook] missing metadata; skipping", { token, paymentPhase, orderId });
        return NextResponse.json({ received: true });
    }

    const deals = await readDeals();
    const idx = deals.findIndex(d => d.token === token);
    if (idx === -1) {
        console.warn(`[razorpay/webhook] deal not found for token ${token}`);
        return NextResponse.json({ received: true });
    }
    const deal = deals[idx];

    // Idempotency check — if already paid, skip
    const existing = deal.payments?.find(p => p.phase === paymentPhase && p.status === "paid");
    if (existing) {
        console.log(`[razorpay/webhook] phase ${paymentPhase} already marked paid for ${token}`);
        return NextResponse.json({ received: true, idempotent: true });
    }

    const ctx = { paymentId, orderId, source: "webhook" as const };
    const result: TransitionResult =
        paymentPhase === 3 ? t3_advancePaid(deal, ctx) :
        paymentPhase === 4 ? t4_midPaymentPaid(deal, ctx) :
        paymentPhase === 6 ? t6_finalPaid(deal, ctx) :
        { ok: false, reason: `Invalid paymentPhase ${paymentPhase}` };

    if (!result.ok) {
        const reason = (result as TransitionFail).reason;
        console.error(`[razorpay/webhook] transition failed: ${reason}`);
        return NextResponse.json({ error: reason }, { status: 500 });
    }

    // Mark payment row paid
    const payments = (result.deal.payments || []).map(p =>
        p.phase === paymentPhase
            ? { ...p, status: "paid" as const, sessionId: orderId, paidAt: Date.now(), amount: amount || p.amount }
            : p
    );
    if (!payments.find(p => p.phase === paymentPhase)) {
        payments.push({
            phase: paymentPhase,
            percentage: paymentPhase === 6 ? 40 : 30,
            amount,
            status: "paid",
            sessionId: orderId,
            paidAt: Date.now(),
        });
    }

    deals[idx] = { ...result.deal, payments, lastInteractionAt: Date.now() };
    await writeDeals(deals);

    console.log(`[razorpay/webhook] ✅ Payment captured: deal=${token} phase=${paymentPhase} amount=₹${amount}`);
    return NextResponse.json({ received: true, phase: paymentPhase });
}
