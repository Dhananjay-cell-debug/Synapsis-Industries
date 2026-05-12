"use client";

// ─── ADMIN PAYMENT PROFILE EDITOR (Domestic ↔ International toggle) ─────────
// Two-button design: Domestic (INR · Razorpay UPI/Cards/NB/NEFT) or
// International (USD · Razorpay Intl cards + region methods).
//
// The choice persists across Phase 3 (advance), Phase 4 (mid), and Phase 6
// (final). Every phase tab reads deal.currency / deal.paymentProvider /
// deal.acceptInternationalCards / deal.clientCountry, so one toggle here
// locks the entire payment lifecycle of this deal.
//
// Once a paid payment exists, the toggle is soft-locked (greyed) to prevent
// accidental mid-deal currency switch — admin can explicitly Unlock to override.

import React, { useMemo, useState } from "react";
import {
    Globe2, IndianRupee, AlertTriangle, Check, Lock, Unlock, Building2, CreditCard,
} from "lucide-react";
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

type Mode = "domestic" | "international";

function deriveMode(deal: PaymentProfileDeal): Mode {
    if (deal.currency === "USD" || deal.acceptInternationalCards) return "international";
    const country = (deal.clientCountry || "").trim().toUpperCase();
    if (country && country !== "IN" && country !== "INDIA") return "international";
    return "domestic";
}

export default function PaymentProfileEditor({ deal, onSaved }: Props) {
    const initialMode = deriveMode(deal);
    const [mode, setMode] = useState<Mode>(initialMode);
    const [country, setCountry] = useState(deal.clientCountry || "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [unlocked, setUnlocked] = useState(false);

    const hasPaidPayment = (deal.payments || []).some(p => p.status === "paid");
    const locked = hasPaidPayment && !unlocked;

    const initialCountry = (deal.clientCountry || "").trim().toUpperCase();
    const dirty =
        mode !== initialMode ||
        (mode === "international" && country.trim().toUpperCase() !== initialCountry);

    // Effective charge currency (echoes server-side resolution)
    const effectiveCharge = useMemo(() => {
        if (mode === "domestic") {
            return resolveRazorpayCurrency({
                currency: "INR",
                acceptInternationalCards: false,
                clientCountry: "IN",
            });
        }
        return resolveRazorpayCurrency({
            currency: "USD",
            acceptInternationalCards: true,
            clientCountry: country || undefined,
        });
    }, [mode, country]);

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const updates: PaymentProfileUpdates =
                mode === "domestic"
                    ? {
                        clientCountry: "IN",
                        currency: "INR",
                        paymentProvider: "razorpay",
                        acceptInternationalCards: false,
                    }
                    : {
                        clientCountry: country.trim() || undefined,
                        currency: "USD",
                        paymentProvider: "razorpay",
                        acceptInternationalCards: true,
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
            onSaved(updates);
            setSaved(true);
            setUnlocked(false);
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
                    locked ? (
                        <button
                            onClick={() => setUnlocked(true)}
                            className="inline-flex items-center gap-1 text-[9px] text-amber-400/80 hover:text-amber-300"
                            title="A payment has already been captured — switching mode here only affects future phases"
                        >
                            <Lock size={9} /> Live · Unlock
                        </button>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-300">
                            <Unlock size={9} /> Editable
                        </span>
                    )
                )}
            </div>

            {/* TWO BIG BUTTONS — Domestic / International */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                    type="button"
                    onClick={() => !locked && setMode("domestic")}
                    disabled={locked}
                    className={`group flex flex-col items-center gap-1 rounded-lg py-3 px-2 border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        mode === "domestic"
                            ? "bg-[#11B8EA]/15 border-[#11B8EA]/50 text-[#11B8EA]"
                            : "bg-white/5 border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
                    }`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-base">🇮🇳</span>
                        <IndianRupee size={12} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase">Domestic</span>
                    <span className="text-[9px] tracking-wide opacity-70">INR · Indian client</span>
                </button>
                <button
                    type="button"
                    onClick={() => !locked && setMode("international")}
                    disabled={locked}
                    className={`group flex flex-col items-center gap-1 rounded-lg py-3 px-2 border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        mode === "international"
                            ? "bg-[#3B6AE8]/15 border-[#3B6AE8]/50 text-[#3B6AE8]"
                            : "bg-white/5 border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
                    }`}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-base">🌐</span>
                        <Globe2 size={12} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase">International</span>
                    <span className="text-[9px] tracking-wide opacity-70">USD · Foreign client</span>
                </button>
            </div>

            {/* Mode-specific reveal */}
            {mode === "domestic" ? (
                <div className="mb-3 rounded-md bg-white/[0.03] border border-white/10 px-2.5 py-2.5 text-[10px] text-white/65 leading-relaxed">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Building2 size={10} className="text-[#11B8EA]" />
                        <span className="text-[#11B8EA] font-bold tracking-wider uppercase text-[9px]">Razorpay Domestic</span>
                    </div>
                    Charges in <span className="font-bold text-white">INR (₹)</span>. Client sees:
                    UPI · Cards · Netbanking · Wallets. NEFT/RTGS appears for tickets above ₹5L.
                    Settles to your Indian bank account.
                </div>
            ) : (
                <>
                    <div className="mb-3">
                        <label className="text-[9px] tracking-wider uppercase text-white/40">
                            Client country <span className="text-white/25">(ISO code, recommended)</span>
                        </label>
                        <input
                            type="text"
                            value={country}
                            disabled={locked}
                            onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 6))}
                            placeholder="US, GB, AE, DE…"
                            className="mt-1 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#3B6AE8]/40 font-mono tracking-wider disabled:opacity-50"
                        />
                    </div>
                    <div className="mb-3 rounded-md bg-white/[0.03] border border-white/10 px-2.5 py-2.5 text-[10px] text-white/65 leading-relaxed">
                        <div className="flex items-center gap-1.5 mb-1">
                            <CreditCard size={10} className="text-[#3B6AE8]" />
                            <span className="text-[#3B6AE8] font-bold tracking-wider uppercase text-[9px]">Razorpay International</span>
                        </div>
                        Charges in <span className="font-bold text-white">USD ($)</span>. Razorpay's checkout
                        shows region-appropriate methods:
                        <ul className="mt-1.5 space-y-0.5 pl-3">
                            <li>· International cards (everywhere)</li>
                            <li>· US clients → cards + ACH</li>
                            <li>· EU clients → cards + SEPA / Sofort / GiroPay</li>
                            <li>· UK clients → cards + Trustly / CHAPS</li>
                            <li>· Wire / SWIFT for enterprise tickets</li>
                        </ul>
                        <p className="mt-2 text-white/50">
                            Settles to your Indian bank in <span className="font-bold text-white">INR</span> after Razorpay's FX conversion. Invoice marked LUT zero-rated export.
                        </p>
                    </div>
                </>
            )}

            {/* Effective charge preview */}
            <div className="mb-3 rounded-md bg-white/[0.03] border border-white/10 px-2.5 py-2 text-[10px] text-white/60">
                <span className="text-white/40">Razorpay will charge:</span>{" "}
                <span className="font-bold text-white">{effectiveCharge}</span>
                {mode === "international" && !country.trim() && (
                    <span className="text-amber-400/70 block mt-1">⚠ Country empty — set it so Razorpay surfaces local methods (ACH/SEPA/etc.) for the buyer.</span>
                )}
            </div>

            {/* Lock warning */}
            {locked && (
                <div className="mb-3 rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-2 text-[10px] text-amber-300 leading-relaxed">
                    <div className="flex items-start gap-1.5">
                        <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                        <div>
                            A payment for this deal is already paid. Switching mode here only affects <span className="font-bold">future phase payments</span> on this deal — previously paid rows keep their original currency. Click "Live · Unlock" above to override.
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
                disabled={!dirty || saving || locked}
                className={`w-full px-3 py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    saved
                        ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300"
                        : mode === "international"
                            ? "bg-[#3B6AE8]/15 border border-[#3B6AE8]/40 text-[#3B6AE8]"
                            : "bg-[#11B8EA]/15 border border-[#11B8EA]/40 text-[#11B8EA]"
                }`}
            >
                {saving ? "Saving…" : saved ? (
                    <span className="inline-flex items-center gap-1"><Check size={10} /> Saved</span>
                ) : dirty ? `Save · ${mode === "international" ? "Mark International" : "Mark Domestic"}` : "No changes"}
            </button>
        </div>
    );
}
