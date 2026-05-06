// ─── RAZORPAY ORDER CREATION ────────────────────────────────────────────────
// Client hits this when ready to pay. We:
//   1. Look up deal (JSON file source of truth for deal record)
//   2. Server-side recompute amount from totalPrice × percentage (NEVER trust client)
//   3. Idempotently create or reuse a pending payment row in Supabase
//   4. Create a Razorpay order
//   5. Log a platform_transactions event
//   6. Return checkout params to client
//
// POST body: { token: string, paymentPhase: 3 | 4 | 6 }

import { NextRequest, NextResponse } from "next/server";
import { razorpay, rupeesToPaise } from "@/lib/razorpay";
import { PAYMENT_SPLIT, paymentAmountFor, CURRENCY } from "@/lib/phases/constants";
import { getDeal } from "@/lib/deals/store";
import {
    upsertPendingPayment,
    getPaymentForPhase,
    recordTransaction,
} from "@/lib/payments/db";

export async function POST(req: NextRequest) {
    try {
        const { token, paymentPhase } = await req.json();
        const phase = Number(paymentPhase) as 3 | 4 | 6;

        if (!token || !phase) {
            return NextResponse.json({ error: "Missing token or paymentPhase" }, { status: 400 });
        }
        const cfg = PAYMENT_SPLIT[phase];
        if (!cfg) {
            return NextResponse.json({ error: "Invalid paymentPhase — must be 3, 4, or 6" }, { status: 400 });
        }

        // ─── Load deal ─────────────────────────────────────────────────────
        const deal = await getDeal(token);
        if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

        if (!deal.totalPrice || deal.totalPrice <= 0) {
            return NextResponse.json(
                { error: "Project total not set yet — awaiting Blueprint approval" },
                { status: 400 }
            );
        }

        // Defensive: Razorpay path is INR-only. If deal is configured for Stripe (USD),
        // refuse to create a Razorpay order — admin must use Stripe path instead.
        const dealProvider = (deal as { paymentProvider?: string }).paymentProvider;
        const dealCurrency = (deal as { currency?: string }).currency;
        if (dealProvider === "stripe" || dealCurrency === "USD") {
            return NextResponse.json(
                { error: "This deal is configured for Stripe (USD). Use /api/stripe/checkout instead." },
                { status: 400 }
            );
        }

        // ─── Server-side amount recompute (NEVER trust client) ─────────────
        const amountRupees = paymentAmountFor(deal.totalPrice, phase);
        const amountPaise = rupeesToPaise(amountRupees);

        // ─── Idempotency check ─────────────────────────────────────────────
        const existing = await getPaymentForPhase(token, phase);
        if (existing?.status === "paid") {
            return NextResponse.json({ error: "This payment is already complete" }, { status: 400 });
        }
        if (existing?.status === "pending_admin_verify") {
            return NextResponse.json({
                error: "A manual NEFT payment is currently pending admin verification for this phase",
            }, { status: 400 });
        }

        // ─── Reuse or create Razorpay order ────────────────────────────────
        const receipt = `deal_${token}_p${phase}`;
        let order;
        if (existing?.status === "pending" && existing.razorpay_order_id) {
            // Verify upstream order still valid; if not, create fresh
            try {
                order = await razorpay.orders.fetch(existing.razorpay_order_id);
                if (order.status === "paid" || order.status === "attempted") {
                    // Order already used → rare race, create new one
                    order = await razorpay.orders.create({
                        amount: amountPaise,
                        currency: CURRENCY,
                        receipt,
                        notes: {
                            token, paymentPhase: String(phase),
                            clientName: deal.name, company: deal.company, phaseLabel: cfg.label,
                        },
                    });
                }
            } catch {
                order = await razorpay.orders.create({
                    amount: amountPaise,
                    currency: CURRENCY,
                    receipt,
                    notes: {
                        token, paymentPhase: String(phase),
                        clientName: deal.name, company: deal.company, phaseLabel: cfg.label,
                    },
                });
            }
        } else {
            order = await razorpay.orders.create({
                amount: amountPaise,
                currency: CURRENCY,
                receipt,
                notes: {
                    token, paymentPhase: String(phase),
                    clientName: deal.name, company: deal.company, phaseLabel: cfg.label,
                },
            });
        }

        // ─── Upsert pending payment row in Supabase ────────────────────────
        const paymentRow = await upsertPendingPayment({
            dealToken: token,
            phase,
            totalPriceMajor: deal.totalPrice,
            currency: "INR",
            provider: "razorpay",
            razorpayOrderId: order.id,
            receipt,
            method: "razorpay",
        });

        // ─── Audit log ─────────────────────────────────────────────────────
        await recordTransaction({
            dealToken: token,
            paymentId: paymentRow.id,
            type: "payment.order.created",
            source: "system",
            amountPaise,
            razorpayOrderId: order.id,
            metadata: { phase, percentage: cfg.percentage, totalPriceRupees: deal.totalPrice },
        });

        return NextResponse.json({
            orderId: order.id,
            amount: amountPaise,
            amountRupees,
            currency: CURRENCY,
            keyId: process.env.RAZORPAY_KEY_ID,
            phaseLabel: cfg.label,
            percentage: cfg.percentage,
            clientName: deal.name,
            email: "",
            contact: "",
            paymentRowId: paymentRow.id,
        });
    } catch (err) {
        console.error("[razorpay/order] error:", err);
        const msg = err instanceof Error ? err.message : "Failed to create Razorpay order";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
