import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import {
    t3_advancePaid,
    t4_midPaymentPaid,
    t6_finalPaid,
} from "@/lib/phases/transitions";
import type { TransitionFail, TransitionResult } from "@/lib/phases/transitions";
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

        const token: string | undefined = body.token;
        const orderId: string | undefined = body.orderId ?? body.razorpay_order_id;
        const paymentId: string | undefined = body.paymentId ?? body.razorpay_payment_id;
        const signature: string | undefined = body.signature ?? body.razorpay_signature;
        const paymentPhase = Number(body.paymentPhase) as 3 | 4 | 6;

        if (!token || !orderId || !paymentId || !signature || !paymentPhase) {
            return NextResponse.json(
                { error: "Missing required fields: token, orderId, paymentId, signature, paymentPhase" },
                { status: 400 }
            );
        }

        if (![3, 4, 6].includes(paymentPhase)) {
            return NextResponse.json({ error: `Invalid paymentPhase ${paymentPhase}` }, { status: 400 });
        }

        const signatureOk = verifyPaymentSignature({ orderId, paymentId, signature });
        if (!signatureOk) {
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

        const deal = await getDeal(token);
        if (!deal) {
            return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        }

        const paymentRow = await getPaymentByOrderId(orderId);
        if (!paymentRow) {
            return NextResponse.json(
                { error: "Payment row not found for this Razorpay order - webhook may have failed earlier" },
                { status: 404 }
            );
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
            return NextResponse.json(
                { error: `Phase mismatch - payment row phase ${paymentRow.phase}, request phase ${paymentPhase}` },
                { status: 400 }
            );
        }

        const expectedMajor = paymentAmountFor(deal.totalPrice || 0, paymentPhase);
        const expectedMinor = Math.round(expectedMajor * 100);
        if (paymentRow.amount_paise !== expectedMinor) {
            await recordTransaction({
                dealToken: token,
                paymentId: paymentRow.id,
                type: "payment.amount.mismatch",
                source: "client_callback",
                amountPaise: paymentRow.amount_paise,
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                metadata: {
                    expectedMinor,
                    actualMinor: paymentRow.amount_paise,
                    dealTotalMajor: deal.totalPrice,
                    currency: paymentRow.currency || deal.currency || "INR",
                },
            });
            return NextResponse.json({ error: "Amount mismatch - payment locked for review" }, { status: 400 });
        }

        if (paymentRow.status === "paid") {
            return NextResponse.json({ ok: true, alreadyPaid: true, paymentId: paymentRow.id });
        }

        const updatedPayment = await markPaymentPaid({
            paymentId: paymentRow.id,
            razorpayPaymentId: paymentId,
        });

        await recordTransaction({
            dealToken: token,
            paymentId: paymentRow.id,
            type: `payment.captured.phase${paymentPhase}`,
            source: "client_callback",
            provider: updatedPayment.provider,
            amountPaise: updatedPayment.amount_paise,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            metadata: {
                method: "razorpay",
                currency: updatedPayment.currency || deal.currency || "INR",
            },
        });

        const ctx = { paymentId, orderId, source: "webhook" as const };
        const result: TransitionResult =
            paymentPhase === 3 ? t3_advancePaid(deal, ctx) :
            paymentPhase === 4 ? t4_midPaymentPaid(deal, ctx) :
            paymentPhase === 6 ? t6_finalPaid(deal, ctx) :
            { ok: false, reason: "Unreachable" };

        if (!result.ok) {
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

        const legacyPayments = (result.deal.payments || []).map((payment) =>
            payment.phase === paymentPhase
                ? { ...payment, status: "paid" as const, sessionId: orderId, paidAt: Date.now(), amount: expectedMajor }
                : payment
        );

        if (!legacyPayments.find((payment) => payment.phase === paymentPhase)) {
            legacyPayments.push({
                phase: paymentPhase,
                percentage: PAYMENT_SPLIT[paymentPhase].percentage,
                amount: expectedMajor,
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

        Promise.resolve()
            .then(async () => {
                try {
                    await generateAndPersistInvoice({
                        dealToken: token,
                        paymentId: paymentRow.id,
                    });
                } catch (error) {
                    await recordTransaction({
                        dealToken: token,
                        paymentId: paymentRow.id,
                        type: "invoice.generation.failed",
                        source: "system",
                        metadata: { error: error instanceof Error ? error.message : String(error) },
                    });
                }
            })
            .catch(() => {});

        return NextResponse.json({ ok: true, deal: persisted, paymentId: paymentRow.id });
    } catch (error) {
        console.error("[razorpay/verify] error:", error);
        const message = error instanceof Error ? error.message : "Payment verification failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
