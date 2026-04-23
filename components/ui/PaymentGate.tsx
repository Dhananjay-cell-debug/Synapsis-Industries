"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Zap, CheckCircle, CreditCard, Lock } from "lucide-react";

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
}

const PHASE_CONFIG = {
    3: { title: "Advance Payment", percentage: 30, color: "#11B8EA" },
    4: { title: "Milestone Payment", percentage: 30, color: "#3B6AE8" },
    6: { title: "Final Payment", percentage: 40, color: "#11B8EA" },
};

export default function PaymentGate({
    token,
    paymentPhase,
    totalPrice,
    payments = [],
    label,
    description,
}: PaymentGateProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const config = PHASE_CONFIG[paymentPhase];
    const amountUSD = Math.round((totalPrice * config.percentage) / 100);
    const existingPayment = payments.find((p) => p.phase === paymentPhase);
    const isPaid = existingPayment?.status === "paid";

    const handlePay = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, paymentPhase }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Payment failed");
            if (data.url) window.location.href = data.url;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
            setLoading(false);
        }
    };

    if (isPaid) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6 flex items-center gap-4"
            >
                <CheckCircle className="w-8 h-8 text-green-400 shrink-0" />
                <div>
                    <div className="text-green-400 font-semibold text-sm tracking-widest uppercase">{config.title} · Received</div>
                    <div className="text-white/60 text-sm mt-0.5">
                        ${amountUSD.toLocaleString()} USD · {config.percentage}% of project total
                    </div>
                    {existingPayment?.paidAt && (
                        <div className="text-white/40 text-xs mt-1">
                            Paid {new Date(existingPayment.paidAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                    )}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-[#0D1526] p-6"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4" style={{ color: config.color }} />
                        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: config.color }}>
                            {config.title}
                        </span>
                    </div>
                    <div className="text-white font-semibold text-lg">{label}</div>
                    <div className="text-white/50 text-sm mt-1">{description}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                    <div className="text-2xl font-bold text-white">${amountUSD.toLocaleString()}</div>
                    <div className="text-white/40 text-xs">{config.percentage}% of ${totalPrice.toLocaleString()}</div>
                </div>
            </div>

            {/* Security note */}
            <div className="flex items-center gap-2 mb-4 text-white/30 text-xs">
                <Lock className="w-3 h-3" />
                <span>Secured by Stripe · USD · Card payment</span>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* CTA */}
            <button
                onClick={handlePay}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    background: loading ? "#1a2a4a" : `linear-gradient(135deg, ${config.color}22, ${config.color}44)`,
                    border: `1px solid ${config.color}44`,
                    color: config.color,
                }}
            >
                <CreditCard className="w-4 h-4" />
                {loading ? "Redirecting to Stripe..." : `Pay $${amountUSD.toLocaleString()} via Stripe`}
            </button>
        </motion.div>
    );
}
