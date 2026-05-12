"use client";

import React from "react";
import RazorpayCheckout from "./RazorpayCheckout";
import StripeCheckout from "./StripeCheckout";
import { resolveRazorpayCurrency } from "@/lib/payments/currency";

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
    paymentProvider?: "razorpay" | "stripe";
    currency?: "INR" | "USD";
    acceptInternationalCards?: boolean;
    clientCountry?: string;
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
    acceptInternationalCards = false,
    clientCountry,
}: PaymentGateProps) {
    const percentage = PHASE_PERCENTAGE[paymentPhase];
    const amount = Math.round((totalPrice * percentage) / 100);
    const existing = payments.find((payment) => payment.phase === paymentPhase);
    const isPaid = existing?.status === "paid";
    const resolvedCurrency = resolveRazorpayCurrency({
        currency,
        acceptInternationalCards,
        clientCountry,
    });

    if (paymentProvider === "stripe") {
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

    return (
        <RazorpayCheckout
            token={token}
            paymentPhase={paymentPhase}
            amount={amount}
            currency={resolvedCurrency}
            label={label}
            description={description}
            clientName={clientName}
            clientEmail={clientEmail}
            acceptInternationalCards={acceptInternationalCards}
            clientCountry={clientCountry}
            isPaid={isPaid}
            paidAt={existing?.paidAt}
            onPaid={() => window.location.reload()}
        />
    );
}
