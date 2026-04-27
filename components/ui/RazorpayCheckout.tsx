"use client";

// ─── RAZORPAY CHECKOUT — INR payment gate ───────────────────────────────────
// Loads Razorpay SDK, creates order via /api/razorpay/order, opens checkout,
// verifies HMAC via /api/razorpay/verify. On success, the verify route fires
// the appropriate transition (t3_advancePaid / t4_midPaymentPaid / t6_finalPaid)
// which mutates the deal — caller polls and observes phase advancement.

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, CheckCircle, IndianRupee, AlertCircle } from "lucide-react";
import { CURRENCY_SYMBOL } from "@/lib/phases/constants";

type PaymentPhase = 3 | 4 | 6;

interface Props {
    token: string;
    paymentPhase: PaymentPhase;
    amount: number;            // in INR (rupees)
    label: string;             // e.g. "30% Advance — kicks off the build"
    description: string;
    clientName: string;
    clientEmail?: string;
    isPaid: boolean;
    paidAt?: number;
    onPaid: () => void;        // called after successful verify (caller refetches deal)
}

const PHASE_TONE: Record<PaymentPhase, { color: string; title: string }> = {
    3: { color: "#11B8EA", title: "Advance Payment" },
    4: { color: "#3B6AE8", title: "Milestone Payment" },
    6: { color: "#10B981", title: "Final Payment" },
};

// ─── SDK loader (idempotent) ───────────────────────────────────────────────
function loadRazorpaySdk(): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    if ((window as any).Razorpay) return Promise.resolve(true);
    return new Promise(resolve => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function RazorpayCheckout({
    token, paymentPhase, amount, label, description,
    clientName, clientEmail, isPaid, paidAt, onPaid,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sdkReady, setSdkReady] = useState(false);
    const tone = PHASE_TONE[paymentPhase];

    useEffect(() => { loadRazorpaySdk().then(setSdkReady); }, []);

    const startCheckout = async () => {
        setBusy(true); setError(null);
        try {
            // 1. Create order on server
            const orderRes = await fetch("/api/razorpay/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, paymentPhase }),
            });
            if (!orderRes.ok) {
                const e = await orderRes.json().catch(() => ({}));
                throw new Error(e.error || `Order create failed (HTTP ${orderRes.status})`);
            }
            const { orderId, amount: amountPaise, currency, keyId } = await orderRes.json();

            // 2. Open Razorpay checkout
            if (!(window as any).Razorpay) {
                const ok = await loadRazorpaySdk();
                if (!ok) throw new Error("Razorpay SDK failed to load — check your internet.");
            }

            const rzp = new (window as any).Razorpay({
                key: keyId,
                order_id: orderId,
                amount: amountPaise,
                currency,
                name: "Synapsis Industries",
                description: label,
                prefill: { name: clientName, email: clientEmail || "" },
                theme: { color: tone.color },
                handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
                    // 3. Verify on server (HMAC + transition dispatch)
                    try {
                        const verifyRes = await fetch("/api/razorpay/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                token,
                                paymentPhase,
                                orderId: resp.razorpay_order_id,
                                paymentId: resp.razorpay_payment_id,
                                signature: resp.razorpay_signature,
                            }),
                        });
                        if (!verifyRes.ok) {
                            const e = await verifyRes.json().catch(() => ({}));
                            throw new Error(e.error || "Verification failed");
                        }
                        onPaid();
                    } catch (e) {
                        setError(e instanceof Error ? e.message : "Verification failed");
                    } finally {
                        setBusy(false);
                    }
                },
                modal: {
                    ondismiss: () => setBusy(false),
                },
            });
            rzp.open();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Payment failed to start");
            setBusy(false);
        }
    };

    if (isPaid) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 flex items-center gap-4"
            >
                <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
                <div className="flex-1">
                    <div className="text-emerald-400 font-semibold text-sm tracking-widest uppercase">{tone.title} · Received</div>
                    <div className="text-white/70 text-sm mt-0.5">
                        {CURRENCY_SYMBOL}{amount.toLocaleString("en-IN")}
                    </div>
                    {paidAt && (
                        <div className="text-white/40 text-xs mt-1">
                            Paid {new Date(paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                    )}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-[#0D1526] p-6"
        >
            <div className="flex items-start justify-between mb-4 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <IndianRupee className="w-4 h-4" style={{ color: tone.color }} />
                        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: tone.color }}>
                            {tone.title}
                        </span>
                    </div>
                    <div className="text-white font-semibold text-lg">{label}</div>
                    <div className="text-white/50 text-sm mt-1">{description}</div>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-3xl font-bold text-white font-mono">
                        {CURRENCY_SYMBOL}{amount.toLocaleString("en-IN")}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-4 text-white/30 text-xs">
                <Lock className="w-3 h-3" />
                <span>Secured by Razorpay · INR · UPI/Card/NetBanking</span>
            </div>

            {error && (
                <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-red-400 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <button
                onClick={startCheckout}
                disabled={busy || !sdkReady}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    background: `linear-gradient(135deg, ${tone.color}25, ${tone.color}40)`,
                    border: `1px solid ${tone.color}55`,
                    color: tone.color,
                }}
            >
                <IndianRupee className="w-4 h-4" />
                {busy ? "Opening checkout…" : !sdkReady ? "Loading Razorpay…" : `Pay ${CURRENCY_SYMBOL}${amount.toLocaleString("en-IN")}`}
            </button>
        </motion.div>
    );
}
