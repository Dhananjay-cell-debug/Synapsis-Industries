"use client";

// ─── RAZORPAY CHECKOUT — INR payment gate ───────────────────────────────────
// Loads Razorpay SDK, creates order via /api/razorpay/order, opens checkout,
// verifies HMAC via /api/razorpay/verify. On success, the verify route fires
// the appropriate transition (t3_advancePaid / t4_midPaymentPaid / t6_finalPaid).
//
// Tier-aware UI: based on amount, shows different method recommendations
// (Indian banking realities: ₹1L UPI cap, RTGS for large amounts).

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, CheckCircle, IndianRupee, AlertCircle, Building2, FileText, ExternalLink } from "lucide-react";
import { CURRENCY_SYMBOL } from "@/lib/phases/constants";
import ManualPaymentForm from "./ManualPaymentForm";

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
    invoiceNumber?: string;
    onPaid: () => void;
}

const PHASE_TONE: Record<PaymentPhase, { color: string; title: string }> = {
    3: { color: "#11B8EA", title: "Advance Payment" },
    4: { color: "#3B6AE8", title: "Milestone Payment" },
    6: { color: "#10B981", title: "Final Payment" },
};

// ─── Tier classification (Indian banking realities) ─────────────────────────
type Tier = 1 | 2 | 3 | 4 | 5;
function classifyTier(amount: number): Tier {
    if (amount <= 50_000) return 1;      // all methods
    if (amount <= 1_00_000) return 2;    // UPI warned
    if (amount <= 5_00_000) return 3;    // NEFT visible
    if (amount <= 10_00_000) return 4;   // NEFT primary
    return 5;                             // RTGS hero
}
const TIER_HINTS: Record<Tier, { hint: string; recommendNeft: boolean }> = {
    1: { hint: "UPI · Cards · NetBanking · Wallets — all available", recommendNeft: false },
    2: { hint: "Cards/NetBanking recommended (UPI ₹1L NPCI cap may apply)", recommendNeft: false },
    3: { hint: "Cards/NetBanking primary. NEFT/RTGS available below.",      recommendNeft: true  },
    4: { hint: "NetBanking or NEFT/RTGS recommended for this amount.",      recommendNeft: true  },
    5: { hint: "RTGS (instant settlement) is the standard for this amount.", recommendNeft: true  },
};

// ─── SDK loader (idempotent) ───────────────────────────────────────────────
function loadRazorpaySdk(): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
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
    clientName, clientEmail, isPaid, paidAt, invoiceNumber, onPaid,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sdkReady, setSdkReady] = useState(false);
    const [showNeft, setShowNeft] = useState(false);
    const tone = PHASE_TONE[paymentPhase];
    const tier = classifyTier(amount);
    const tierHint = TIER_HINTS[tier];

    useEffect(() => { loadRazorpaySdk().then(setSdkReady); }, []);
    useEffect(() => { if (tier >= 4) setShowNeft(true); }, [tier]);

    const startCheckout = async () => {
        setBusy(true); setError(null);
        try {
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

            if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
                const ok = await loadRazorpaySdk();
                if (!ok) throw new Error("Razorpay SDK failed to load — check your internet.");
            }

            const RazorpayCtor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;
            const rzp = new RazorpayCtor({
                key: keyId,
                order_id: orderId,
                amount: amountPaise,
                currency,
                name: "Synapsis Industries",
                description: label,
                prefill: { name: clientName, email: clientEmail || "" },
                theme: { color: tone.color },
                handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
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
                modal: { ondismiss: () => setBusy(false) },
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
                {invoiceNumber && (
                    <a
                        href={`/api/invoices/${invoiceNumber}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 flex items-center gap-1.5 transition"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Invoice
                        <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </motion.div>
        );
    }

    return (
        <div className="space-y-4">
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

                <div className="flex items-center gap-2 mb-3 text-white/40 text-xs">
                    <Lock className="w-3 h-3" />
                    <span>{tierHint.hint}</span>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-red-400 text-sm flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {tier <= 4 && (
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
                        {busy ? "Opening checkout…" : !sdkReady ? "Loading Razorpay…" : `Pay ${CURRENCY_SYMBOL}${amount.toLocaleString("en-IN")} via Razorpay`}
                    </button>
                )}

                {tierHint.recommendNeft && (
                    <button
                        onClick={() => setShowNeft(s => !s)}
                        className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition"
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        {showNeft ? "Hide NEFT/RTGS option" : "Pay via NEFT / RTGS instead"}
                    </button>
                )}
            </motion.div>

            {showNeft && (
                <ManualPaymentForm
                    token={token}
                    paymentPhase={paymentPhase}
                    amount={amount}
                    label={label}
                    onSubmitted={onPaid}
                />
            )}
        </div>
    );
}
