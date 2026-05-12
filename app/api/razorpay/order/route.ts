import { NextRequest, NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";
import { PAYMENT_SPLIT, paymentAmountFor } from "@/lib/phases/constants";
import { getDeal } from "@/lib/deals/store";
import {
    getPaymentForPhase,
    recordTransaction,
    upsertPendingPayment,
} from "@/lib/payments/db";
import { resolveRazorpayCurrency } from "@/lib/payments/currency";

export async function POST(req: NextRequest) {
    try {
        const { token, paymentPhase } = await req.json();
        const phase = Number(paymentPhase) as 3 | 4 | 6;

        if (!token || !phase) {
            return NextResponse.json({ error: "Missing token or paymentPhase" }, { status: 400 });
        }

        const config = PAYMENT_SPLIT[phase];
        if (!config) {
            return NextResponse.json({ error: "Invalid paymentPhase - must be 3, 4, or 6" }, { status: 400 });
        }

        const deal = await getDeal(token);
        if (!deal) {
            return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        }

        if (!deal.totalPrice || deal.totalPrice <= 0) {
            return NextResponse.json(
                { error: "Project total not set yet - awaiting Blueprint approval" },
                { status: 400 }
            );
        }

        if (deal.paymentProvider === "stripe") {
            return NextResponse.json(
                { error: "This deal is configured for Stripe. Use /api/stripe/checkout instead." },
                { status: 400 }
            );
        }

        const currency = resolveRazorpayCurrency({
            currency: deal.currency,
            acceptInternationalCards: deal.acceptInternationalCards,
            clientCountry: deal.clientCountry,
        });
        const amountMajor = paymentAmountFor(deal.totalPrice, phase);
        const amountMinor = Math.round(amountMajor * 100);

        const existing = await getPaymentForPhase(token, phase);
        if (existing?.status === "paid") {
            return NextResponse.json({ error: "This payment is already complete" }, { status: 400 });
        }
        if (existing?.status === "pending_admin_verify") {
            return NextResponse.json(
                { error: "A manual payment is currently pending admin verification for this phase" },
                { status: 400 }
            );
        }

        const receipt = `deal_${token}_p${phase}_${currency.toLowerCase()}`;
        const notes = {
            token,
            paymentPhase: String(phase),
            clientName: deal.name,
            company: deal.company,
            phaseLabel: config.label,
            currency,
            clientCountry: deal.clientCountry || "",
        };

        let order;

        if (existing?.status === "pending" && existing.razorpay_order_id) {
            try {
                order = await razorpay.orders.fetch(existing.razorpay_order_id);
                if (order.status === "paid" || order.status === "attempted" || order.currency !== currency || Number(order.amount) !== amountMinor) {
                    order = await razorpay.orders.create({
                        amount: amountMinor,
                        currency,
                        receipt,
                        notes,
                    });
                }
            } catch {
                order = await razorpay.orders.create({
                    amount: amountMinor,
                    currency,
                    receipt,
                    notes,
                });
            }
        } else {
            order = await razorpay.orders.create({
                amount: amountMinor,
                currency,
                receipt,
                notes,
            });
        }

        const paymentRow = await upsertPendingPayment({
            dealToken: token,
            phase,
            totalPriceMajor: deal.totalPrice,
            currency,
            provider: "razorpay",
            razorpayOrderId: order.id,
            receipt,
            method: "razorpay",
        });

        await recordTransaction({
            dealToken: token,
            paymentId: paymentRow.id,
            type: "payment.order.created",
            source: "system",
            provider: "razorpay",
            amountPaise: amountMinor,
            razorpayOrderId: order.id,
            metadata: {
                phase,
                percentage: config.percentage,
                totalPriceMajor: deal.totalPrice,
                currency,
            },
        });

        return NextResponse.json({
            orderId: order.id,
            amount: amountMinor,
            amountMajor,
            currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            phaseLabel: config.label,
            percentage: config.percentage,
            clientName: deal.name,
            paymentRowId: paymentRow.id,
        });
    } catch (error) {
        console.error("[razorpay/order] error:", error);
        const message = error instanceof Error ? error.message : "Failed to create Razorpay order";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
