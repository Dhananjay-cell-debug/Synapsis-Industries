"use client";

// ─── PAYMENT GATE — provider router (Razorpay INR / Stripe USD / Razorpay International) ─
// Reads deal.paymentProvider + deal.currency to decide which checkout to render.
// Defaults: provider='razorpay', currency='INR' (back-compat with existing deals).

import React from "react";
import RazorpayCheckout from "./RazorpayCheckout";
import StripeCheckout from "./StripeCheckout";

interface Payment {
    phase: number;
    percentage: number;
    amount: number;
    status: "pending" | "paid";
    paidAt?: number;
}

interface PaymentGateProps {
    token: string;
    paymentPhase: 3 | 4 | 6;
    totalPrice: number;
    payments?: Payment[];
    label: string;
    description: string;
    clientName?: string;
    clientEmail?: string;
    paymentProvider?: "razorpay" | "stripe";    // default 'razorpay'
    currency?: "INR" | "USD";                   // default 'INR'
}

const PHASE_PERCENTAGE: Record<3 | 4 | 6, number> = { 3: 30, 4: 30, 6: 40 };

export default function PaymentGate({
    token,
    paymentPhase,
    totalPrice,
    payments = [],
    label,
    description,
    clientName = "",
    clientEmail,
    paymentProvider = "razorpay",
    currency = "INR",
}: PaymentGateProps) {
    const percentage = PHASE_PERCENTAGE[paymentPhase];
    const amount = Math.round((totalPrice * percentage) / 100);
    const existing = payments.find((p) => p.phase === paymentPhase);
    const isPaid = existing?.status === "paid";

    // Provider routing — Stripe ONLY when explicitly set as provider.
    // Razorpay handles INR (domestic) AND foreign cards when International is enabled in dashboard.
    if (paymentProvider === "stripe") {
        // Sanity: Stripe path expects USD pricing on the deal
        void currency;

        return (
            <StripeCheckout
                token={token}
                paymentPhase={paymentPhase}
                amount={amount}
                label={label}
                description={description}
                clientName={clientName}
                clientEmail={clientEmail}
                isPaid={isPaid}
                paidAt={existing?.paidAt}
                onPaid={() => window.location.reload()}
            />
        );
    }

    // Default: Razorpay (INR or international cards via Razorpay if enabled in dashboard)
    return (
        <RazorpayCheckout
            token={token}
            paymentPhase={paymentPhase}
            amount={amount}
            label={label}
            description={description}
            clientName={clientName}
            clientEmail={clientEmail}
            isPaid={isPaid}
            paidAt={existing?.paidAt}
            onPaid={() => window.location.reload()}
        />
    );
}
