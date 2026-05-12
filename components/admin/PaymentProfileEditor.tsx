"use client";

// ─── ADMIN PAYMENT PROFILE EDITOR ────────────────────────────────────────────
// Lets the admin intentionally configure how a deal will be charged BEFORE the
// client opens a payment phase. Persists through PATCH /api/deals (camelCase
// fields → server snake_cases them). Visible in every phase of the admin
// Client Workspace right column.
//
// Fields managed:
//   - clientCountry          (ISO-ish, used to decide INR vs USD international)
//   - currency               (quote currency: INR or USD)
//   - paymentProvider        (razorpay or stripe; Razorpay is primary)
//   - acceptInternationalCards (must be true for non-IN Razorpay path)

import React, { useMemo, useState } from "react";
import { Globe2, IndianRupee, DollarSign, CreditCard, AlertTriangle, Check, Lock } from "lucide-react";
import { resolveRazorpayCurrency } from "@/lib/payments/currency";

interface PaymentProfileDeal {
    token: string;
    currency?: "INR" | "USD";
    paymentProvider?: "razorpay" | "stripe";
    acceptInternationalCards?: boolean;
    clientCountry?: string;
    payments?: { status: string }[];
}

export interface PaymentProfileUpdates {
    clientCountry?: string;
    currency: "INR" | "USD";
    paymentProvider: "razorpay" | "stripe";
    acceptInternationalCards: boolean;
}

interface Props {
    deal: PaymentProfileDeal;
    onSaved: (updates: PaymentProfileUpdates) => void;
}

export default function PaymentProfileEditor({ deal, onSaved }: Props) {
    const [country, setCountry] = useState(deal.clientCountry || "");
    const [currency, setCurrency] = useState<"INR" | "USD">(deal.currency || "INR");
    const [provider, setProvider] = useState<"razorpay" | "stripe">(deal.paymentProvider || "razorpay");
    const [intlCards, setIntlCards] = useState<boolean>(!!deal.acceptInternationalCards);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasPaidPayment = (deal.payments || []).some(p => p.status === "paid");

    const effectiveCharge = useMemo(
        () => resolveRazorpayCurrency({ currency, acceptInternationalCards: intlCards, clientCountry: country }),
        [currency, intlCards, country],
    );

    const dirty =
        country !== (deal.clientCountry || "") ||
        currency !== (deal.currency || "INR") ||
        provider !== (deal.paymentProvider || "razorpay") ||
        intlCards !== !!deal.acceptInternationalCards;

    const wantsInternational = currency === "USD" || (intlCards && country && country.trim().toUpperCase() !== "IN");
    const missingCountryForIntl = wantsInternational && !country.trim();
    const usdWithoutIntlCards = currency === "USD" && !intlCards;

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const updates = {
                clientCountry: country.trim() || null,
                currency,
                paymentProvider: provider,
                acceptInternationalCards: intlCards,
            };
            const res = await fetch("/api/deals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: deal.token, ...updates }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || `Save failed (HTTP ${res.status})`);
            }
            onSaved({
                clientCountry: country.trim() || undefined,
                currency,
                paymentProvider: provider,
                acceptInternationalCards: intlCards,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-4 pt-4 border-t border-white/6">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] tracking-widest uppercase text-white/30 flex items-center gap-1.5">
                    <Globe2 size={10} /> Payment Profile
                </p>
                {hasPaidPayment && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-amber-400/80" title="Edits won't affect already-paid rows">
                        <Lock size={9} /> Live
                    </span>
                )}
            </div>

            {/* Country */}
            <div className="mb-3">
                <label className="text-[9px] tracking-wider uppercase text-white/40">Client country</label>
                <input
                    type="text"
                    value={country}
                    onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="IN, US, GB, AE…"
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#11B8EA]/40 font-mono tracking-wider"
                />
            </div>

            {/* Currency */}
            <div className="mb-3">
                <p className="text-[9px] tracking-wider uppercase text-white/40 mb-1">Quote currency</p>
                <div className="grid grid-cols-2 gap-1.5">
                    <button
                        type="button"
                        onClick={() => setCurrency("INR")}
                        className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] font-semibold border transition-all ${currency === "INR" ? "bg-[#11B8EA]/15 border-[#11B8EA]/40 text-[#11B8EA]" : "bg-white/5 border-white/10 text-white/40"}`}
                    >
                        <IndianRupee size={10} /> INR — rupees
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrency("USD")}
                        className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] font-semibold border transition-all ${currency === "USD" ? "bg-[#11B8EA]/15 border-[#11B8EA]/40 text-[#11B8EA]" : "bg-white/5 border-white/10 text-white/40"}`}
                    >
                        <DollarSign size={10} /> USD — dollars
                    </button>
                </div>
            </div>

            {/* Provider */}
            <div className="mb-3">
                <p className="text-[9px] tracking-wider uppercase text-white/40 mb-1">Payment provider</p>
                <div className="grid grid-cols-2 gap-1.5">
                    <button
                        type="button"
                        onClick={() => setProvider("razorpay")}
                        className={`rounded-md py-1.5 text-[10px] font-semibold border transition-all ${provider === "razorpay" ? "bg-[#3B6AE8]/15 border-[#3B6AE8]/40 text-[#3B6AE8]" : "bg-white/5 border-white/10 text-white/40"}`}
                    >
                        Razorpay
                    </button>
                    <button
                        type="button"
                        onClick={() => setProvider("stripe")}
                        className={`rounded-md py-1.5 text-[10px] font-semibold border transition-all ${provider === "stripe" ? "bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#8B5CF6]" : "bg-white/5 border-white/10 text-white/40"}`}
                    >
                        Stripe
                    </button>
                </div>
            </div>

            {/* International cards flag */}
            <button
                type="button"
                onClick={() => setIntlCards(v => !v)}
                className={`mb-3 w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-2 border transition-all ${intlCards ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10"}`}
            >
                <span className="flex items-center gap-2 text-[10px] font-semibold tracking-wide text-white/70">
                    <CreditCard size={11} /> Accept international cards
                </span>
                <span className={`text-[9px] font-bold tracking-wider uppercase ${intlCards ? "text-emerald-400" : "text-white/30"}`}>
                    {intlCards ? "On" : "Off"}
                </span>
            </button>

            {/* Effective charge preview */}
            <div className="mb-3 rounded-md bg-white/[0.03] border border-white/10 px-2.5 py-2 text-[10px] text-white/60">
                <span className="text-white/40">Razorpay will charge:</span>{" "}
                <span className="font-bold text-white">{effectiveCharge}</span>
                {effectiveCharge !== currency && (
                    <span className="text-amber-400/70"> (quote {currency} → falls back to {effectiveCharge})</span>
                )}
            </div>

            {/* Warnings */}
            {(missingCountryForIntl || usdWithoutIntlCards) && (
                <div className="mb-3 rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-2 text-[10px] text-amber-300 leading-relaxed">
                    <div className="flex items-start gap-1.5">
                        <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                        <div>
                            {missingCountryForIntl && (
                                <div>International path selected — set client country (US/GB/AE…) so the order doesn't fall back to INR.</div>
                            )}
                            {usdWithoutIntlCards && (
                                <div>USD quote needs "Accept international cards" turned on, else the order will fall back to INR.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-3 rounded-md bg-red-500/10 border border-red-500/30 px-2.5 py-2 text-[10px] text-red-300">
                    {error}
                </div>
            )}

            <button
                onClick={save}
                disabled={!dirty || saving}
                className={`w-full px-3 py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-40 ${saved ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300" : "bg-[#11B8EA]/15 border border-[#11B8EA]/40 text-[#11B8EA]"}`}
            >
                {saving ? "Saving…" : saved ? (
                    <span className="inline-flex items-center gap-1"><Check size={10} /> Saved</span>
                ) : dirty ? "Save profile" : "No changes"}
            </button>
        </div>
    );
}
