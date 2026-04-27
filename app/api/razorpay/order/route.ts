// ─── RAZORPAY ORDER CREATION ────────────────────────────────────────────────
// Client hits this when they're ready to pay. We create a Razorpay order,
// persist the order_id on the deal, and return the checkout params. The
// actual payment happens in the Razorpay-hosted checkout iframe.
//
// POST body: { token: string, paymentPhase: 3 | 4 | 6 }
// Response:  { orderId, amount, currency, keyId, phaseLabel }

import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { razorpay, rupeesToPaise } from "@/lib/razorpay";
import { PAYMENT_SPLIT, paymentAmountFor, CURRENCY } from "@/lib/phases/constants";
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
        const { token, paymentPhase } = await req.json();

        if (!token || !paymentPhase) {
            return NextResponse.json({ error: "Missing token or paymentPhase" }, { status: 400 });
        }

        const cfg = PAYMENT_SPLIT[paymentPhase as 3 | 4 | 6];
        if (!cfg) {
            return NextResponse.json({ error: "Invalid paymentPhase — must be 3, 4, or 6" }, { status: 400 });
        }

        const deals = await readDeals();
        const idx = deals.findIndex(d => d.token === token);
        if (idx === -1) {
            return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        }
        const deal = deals[idx];

        if (!deal.totalPrice) {
            return NextResponse.json({ error: "Project total not set yet — awaiting Blueprint approval" }, { status: 400 });
        }

        // Guard against double-billing
        const alreadyPaid = deal.payments?.find(p => p.phase === paymentPhase && p.status === "paid");
        if (alreadyPaid) {
            return NextResponse.json({ error: "This payment has already been completed" }, { status: 400 });
        }

        const amountINR = paymentAmountFor(deal.totalPrice, paymentPhase);
        const amountPaise = rupeesToPaise(amountINR);

        // Create the Razorpay order
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: CURRENCY,
            receipt: `deal_${token}_p${paymentPhase}`,
            notes: {
                token,
                paymentPhase: String(paymentPhase),
                clientName: deal.name,
                company: deal.company,
                phaseLabel: cfg.label,
            },
        });

        // Persist orderId on the deal so we can reconcile later
        const phaseKey = paymentPhase === 3 ? "phase3" : paymentPhase === 4 ? "phase4" : "phase6";
        const phaseData = deal.phaseData || {};
        const current = (phaseData as Record<string, Record<string, unknown> | undefined>)[phaseKey] || {};
        const orderIdField =
            paymentPhase === 3 ? "advanceRazorpayOrderId" :
            paymentPhase === 4 ? "midRazorpayOrderId" :
            "finalRazorpayOrderId";
        (phaseData as Record<string, Record<string, unknown>>)[phaseKey] = {
            ...current,
            [orderIdField]: order.id,
        };

        // Also upsert a "pending" payment row so admin UI sees intent
        const payments = deal.payments || [];
        const paymentIdx = payments.findIndex(p => p.phase === paymentPhase);
        const paymentRow = {
            phase: paymentPhase,
            percentage: cfg.percentage,
            amount: amountINR,
            status: "pending" as const,
            sessionId: order.id,
        };
        if (paymentIdx >= 0) {
            payments[paymentIdx] = { ...payments[paymentIdx], ...paymentRow };
        } else {
            payments.push(paymentRow);
        }

        deals[idx] = { ...deal, phaseData, payments };
        await writeDeals(deals);

        return NextResponse.json({
            orderId: order.id,
            amount: amountPaise,       // paise, for Razorpay checkout widget
            amountRupees: amountINR,   // for display
            currency: CURRENCY,
            keyId: process.env.RAZORPAY_KEY_ID,
            phaseLabel: cfg.label,
            percentage: cfg.percentage,
            clientName: deal.name,
            email: "", // V2: collect from questionnaire
            contact: "", // V2
        });
    } catch (err) {
        console.error("[razorpay/order] error:", err);
        return NextResponse.json({ error: "Failed to create Razorpay order" }, { status: 500 });
    }
}
