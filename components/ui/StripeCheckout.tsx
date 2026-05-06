"use client";

// ─── STRIPE CHECKOUT — USD payment gate (foreign clients) ───────────────────
// Calls /api/stripe/checkout to create a Checkout Session, then redirects.
// On return, success path: ?payment=success&phase=N&provider=stripe&session_id=...
// PaymentGate reloads after redirect; webhook is the source of truth.

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Lock, CheckCircle, DollarSign, AlertCircle, CreditCard, FileText, ExternalLink } from "lucide-react";

type PaymentPhase = 3 | 4 | 6;

interface Props {
    token: string;
    paymentPhase: PaymentPhase;
    amount: number;            // in USD (dollars)
    label: string;
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

// ─── Tier classification (USD bands) ────────────────────────────────────────
type Tier = 1 | 2 | 3 | 4;
function classifyTier(amount: number): Tier {
    if (amount <= 1_000)  return 1;        // small: cards + wallets primary
    if (amount <= 10_000) return 2;        // mid: + ACH/SEPA
    if (amount <= 50_000) return 3;        // large: bank transfer hero
    return 4;                              // enterprise: invoicing primary
}
const TIER_HINTS: Record<Tier, { hint: string }> = {
    1: { hint: "Cards · Apple/Google Pay · Link · all available" },
    2: { hint: "Cards or ACH/SEPA recommended for this amount" },
    3: { hint: "ACH (US) / SEPA (EU) recommended — wire transfer also available via Stripe" },
    4: { hint: "Wire transfer / Stripe Invoicing recommended for enterprise amounts" },
};

const fmtUSD = (amount: number) =>
    `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StripeCheckout({
    token, paymentPhase, amount, label, description,
    clientName, isPaid, paidAt, invoiceNumber, onPaid,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const tone = PHASE_TONE[paymentPhase];
    const tier = classifyTier(amount);
    const tierHint = TIER_HINTS[tier];

    const startCheckout = async () => {
        setBusy(true); setError(null);
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, paymentPhase }),
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e.error || `Checkout failed (HTTP ${res.status})`);
            }
            const { url } = await res.json();
            if (!url) throw new Error("Stripe returned no checkout URL");
            // onPaid will fire after the success redirect when PaymentGate reloads
            void onPaid;
            void clientName;
            window.location.href = url;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Checkout failed to start");
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
                    <div className="text-white/70 text-sm mt-0.5">{fmtUSD(amount)}</div>
                    {paidAt && (
                        <div className="text-white/40 text-xs mt-1">
                            Paid {new Date(paidAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
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
                            <DollarSign className="w-4 h-4" style={{ color: tone.color }} />
                            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: tone.color }}>
                                {tone.title} · International
                            </span>
                        </div>
                        <div className="text-white font-semibold text-lg">{label}</div>
                        <div className="text-white/50 text-sm mt-1">{description}</div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-3xl font-bold text-white font-mono">{fmtUSD(amount)}</div>
                        <div className="text-white/40 text-xs mt-1">USD</div>
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

                <button
                    onClick={startCheckout}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        background: `linear-gradient(135deg, ${tone.color}25, ${tone.color}40)`,
                        border: `1px solid ${tone.color}55`,
                        color: tone.color,
                    }}
                >
                    <CreditCard className="w-4 h-4" />
                    {busy ? "Opening Stripe…" : `Pay ${fmtUSD(amount)} via Stripe`}
                </button>

                <div className="text-center text-white/30 text-[11px] mt-3 leading-relaxed">
                    Secured by Stripe. We never see your card details.
                    Apple Pay · Google Pay · Link · ACH · SEPA · Cards accepted.
                </div>
            </motion.div>
        </div>
    );
}
