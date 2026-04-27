// ─── RAZORPAY PAYMENT VERIFICATION (client-side success callback) ──────────
// Razorpay checkout returns {razorpay_order_id, razorpay_payment_id, razorpay_signature}
// on success. We verify the signature here (defence-in-depth alongside the webhook),
// then route the capture through the transition engine so audit + phaseData
// update atomically.
//
// POST body: { token, razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentPhase }

import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { verifyPaymentSignature } from "@/lib/razorpay";
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
    try {
        const body = await req.json();
        const {
            token,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            paymentPhase,
        } = body;

        if (!token || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !paymentPhase) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Step 1 — verify signature
        const ok = verifyPaymentSignature({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature,
        });
        if (!ok) {
            return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
        }

        // Step 2 — load deal
        const deals = await readDeals();
        const idx = deals.findIndex(d => d.token === token);
        if (idx === -1) {
            return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        }
        const deal = deals[idx];

        // Step 3 — route to correct transition based on phase number
        const phaseNum = Number(paymentPhase);
        const ctx = {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            source: "webhook" as const, // client callback is trusted because sig verified
        };

        const result: TransitionResult =
            phaseNum === 3 ? t3_advancePaid(deal, ctx) :
            phaseNum === 4 ? t4_midPaymentPaid(deal, ctx) :
            phaseNum === 6 ? t6_finalPaid(deal, ctx) :
            { ok: false, reason: `Invalid paymentPhase ${phaseNum}` };

        if (!result.ok) {
            return NextResponse.json({ error: (result as TransitionFail).reason }, { status: 400 });
        }

        // Step 4 — mark the payment row as paid (keeps legacy deal.payments[] happy for admin UI)
        const payments = (result.deal.payments || []).map(p =>
            p.phase === phaseNum
                ? { ...p, status: "paid" as const, sessionId: razorpay_order_id, paidAt: Date.now() }
                : p
        );
        if (!payments.find(p => p.phase === phaseNum)) {
            // first time — row doesn't exist, shouldn't happen if order route ran first
            payments.push({
                phase: phaseNum,
                percentage: phaseNum === 6 ? 40 : 30,
                amount: 0,
                status: "paid",
                sessionId: razorpay_order_id,
                paidAt: Date.now(),
            });
        }

        deals[idx] = { ...result.deal, payments, lastInteractionAt: Date.now() };
        await writeDeals(deals);

        return NextResponse.json({ ok: true, deal: deals[idx] });
    } catch (err) {
        console.error("[razorpay/verify] error:", err);
        return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
    }
}
