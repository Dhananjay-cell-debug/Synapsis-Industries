"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    AlertCircle,
    Building2,
    CheckCircle,
    CreditCard,
    ExternalLink,
    FileText,
    Globe2,
    IndianRupee,
    Lock,
} from "lucide-react";
import { CURRENCY_SYMBOL } from "@/lib/phases/constants";
import ManualPaymentForm from "./ManualPaymentForm";

type PaymentPhase = 3 | 4 | 6;

interface Props {
    token: string;
    paymentPhase: PaymentPhase;
    amount: number;
    currency?: "INR" | "USD";
    label: string;
    description: string;
    clientName: string;
    clientEmail?: string;
    acceptInternationalCards?: boolean;
    clientCountry?: string;
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

type DomesticTier = 1 | 2 | 3 | 4 | 5;
function classifyDomesticTier(amount: number): DomesticTier {
    if (amount <= 50_000) return 1;
    if (amount <= 1_00_000) return 2;
    if (amount <= 5_00_000) return 3;
    if (amount <= 10_00_000) return 4;
    return 5;
}

const DOMESTIC_HINTS: Record<DomesticTier, { hint: string; recommendNeft: boolean }> = {
    1: { hint: "UPI, cards, netbanking and wallets are all viable.", recommendNeft: false },
    2: { hint: "Cards or netbanking are safer if the buyer hits the UPI 1L cap.", recommendNeft: false },
    3: { hint: "Cards and netbanking stay primary; NEFT/RTGS remains available below.", recommendNeft: true },
    4: { hint: "Netbanking or NEFT/RTGS is usually cleaner for this amount.", recommendNeft: true },
    5: { hint: "RTGS is the practical default at this ticket size.", recommendNeft: true },
};

type InternationalTier = 1 | 2 | 3 | 4;
function classifyInternationalTier(amount: number): InternationalTier {
    if (amount <= 1_000) return 1;
    if (amount <= 10_000) return 2;
    if (amount <= 50_000) return 3;
    return 4;
}

const INTERNATIONAL_HINTS: Record<InternationalTier, string> = {
    1: "International cards work everywhere. Local methods auto-surface based on your region.",
    2: "Cards, Trustly, GiroPay and Sofort are available — Razorpay shows what fits your region.",
    3: "ACH (US), SEPA (EU), CHAPS (UK), SWIFT — bank-transfer rails active for larger amounts.",
    4: "Wire transfer and SWIFT recommended for this ticket — Razorpay surfaces them automatically.",
};

function loadRazorpaySdk(): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);

    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

function formatAmount(amount: number, currency: "INR" | "USD"): string {
    if (currency === "USD") {
        return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${CURRENCY_SYMBOL}${amount.toLocaleString("en-IN")}`;
}

export default function RazorpayCheckout({
    token,
    paymentPhase,
    amount,
    currency = "INR",
    label,
    description,
    clientName,
    clientEmail,
    acceptInternationalCards = false,
    clientCountry,
    isPaid,
    paidAt,
    invoiceNumber,
    onPaid,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sdkReady, setSdkReady] = useState(false);
    const [showNeft, setShowNeft] = useState(false);

    const tone = PHASE_TONE[paymentPhase];
    const isInternational = currency === "USD";
    const domesticTier = classifyDomesticTier(amount);
    const internationalTier = classifyInternationalTier(amount);
    const domesticHint = DOMESTIC_HINTS[domesticTier];
    const amountLabel = formatAmount(amount, currency);

    useEffect(() => {
        loadRazorpaySdk().then(setSdkReady);
    }, []);

    useEffect(() => {
        if (!isInternational && domesticTier >= 4) {
            setShowNeft(true);
        }
    }, [domesticTier, isInternational]);

    const startCheckout = async () => {
        setBusy(true);
        setError(null);

        try {
            const orderRes = await fetch("/api/razorpay/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, paymentPhase }),
            });

            if (!orderRes.ok) {
                const payload = await orderRes.json().catch(() => ({}));
                throw new Error(payload.error || `Order create failed (HTTP ${orderRes.status})`);
            }

            const { orderId, amount: amountMinor, currency: responseCurrency, keyId } = await orderRes.json();

            if (!(window as unknown as { Razorpay?: unknown }).Razorpay) {
                const loaded = await loadRazorpaySdk();
                if (!loaded) throw new Error("Razorpay SDK failed to load.");
            }

            const prefill: Record<string, string> = {};
            if (clientName) prefill.name = clientName;
            if (clientEmail) prefill.email = clientEmail;

            const RazorpayCtor = (
                window as unknown as {
                    Razorpay: new (opts: Record<string, unknown>) => { open: () => void };
                }
            ).Razorpay;

            const instance = new RazorpayCtor({
                key: keyId,
                order_id: orderId,
                amount: amountMinor,
                currency: responseCurrency,
                name: "Synapsis Industries",
                description: label,
                ...(Object.keys(prefill).length ? { prefill } : {}),
                theme: { color: tone.color },
                handler: async (response: {
                    razorpay_order_id: string;
                    razorpay_payment_id: string;
                    razorpay_signature: string;
                }) => {
                    try {
                        const verifyRes = await fetch("/api/razorpay/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                token,
                                paymentPhase,
                                orderId: response.razorpay_order_id,
                                paymentId: response.razorpay_payment_id,
                                signature: response.razorpay_signature,
                            }),
                        });

                        if (!verifyRes.ok) {
                            const payload = await verifyRes.json().catch(() => ({}));
                            throw new Error(payload.error || "Verification failed");
                        }

                        onPaid();
                    } catch (cause) {
                        setError(cause instanceof Error ? cause.message : "Verification failed");
                    } finally {
                        setBusy(false);
                    }
                },
                modal: {
                    ondismiss: () => setBusy(false),
                },
            });

            instance.open();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Payment failed to start");
            setBusy(false);
        }
    };

    if (isPaid) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6"
            >
                <CheckCircle className="h-8 w-8 shrink-0 text-emerald-400" />
                <div className="flex-1">
                    <div className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
                        {tone.title} · Received
                    </div>
                    <div className="mt-0.5 text-sm text-white/70">{amountLabel}</div>
                    {paidAt && (
                        <div className="mt-1 text-xs text-white/40">
                            Paid {new Date(paidAt).toLocaleDateString(isInternational ? "en-US" : "en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                            })}
                        </div>
                    )}
                </div>
                {invoiceNumber && (
                    <a
                        href={`/api/invoices/${invoiceNumber}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                        <FileText className="h-3.5 w-3.5" />
                        Invoice
                        <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </motion.div>
        );
    }

    return (
        <div className="space-y-4">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-[#0D1526] p-6"
            >
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <div className="mb-1 flex items-center gap-2">
                            {isInternational ? (
                                <Globe2 className="h-4 w-4" style={{ color: tone.color }} />
                            ) : (
                                <IndianRupee className="h-4 w-4" style={{ color: tone.color }} />
                            )}
                            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tone.color }}>
                                {tone.title}{isInternational ? " · International" : ""}
                            </span>
                        </div>
                        <div className="text-lg font-semibold text-white">{label}</div>
                        <div className="mt-1 text-sm text-white/50">{description}</div>
                        {isInternational && (
                            <div className="mt-2 text-[11px] leading-relaxed text-white/35">
                                Razorpay International is the active rail.
                                {acceptInternationalCards ? " Cards, ACH, SEPA, CHAPS, SWIFT, Trustly, GiroPay and Sofort are live on this merchant." : ""}
                                {clientCountry ? ` Buyer region: ${clientCountry}.` : ""}
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 text-right">
                        <div className="font-mono text-3xl font-bold text-white">{amountLabel}</div>
                        {isInternational && <div className="mt-1 text-xs text-white/40">USD</div>}
                    </div>
                </div>

                <div className="mb-3 flex items-center gap-2 text-xs text-white/40">
                    <Lock className="h-3 w-3" />
                    <span>{isInternational ? INTERNATIONAL_HINTS[internationalTier] : domesticHint.hint}</span>
                </div>

                {error && (
                    <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <button
                    onClick={startCheckout}
                    disabled={busy || !sdkReady}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                        background: `linear-gradient(135deg, ${tone.color}25, ${tone.color}40)`,
                        border: `1px solid ${tone.color}55`,
                        color: tone.color,
                    }}
                >
                    {isInternational ? <CreditCard className="h-4 w-4" /> : <IndianRupee className="h-4 w-4" />}
                    {busy ? "Opening checkout..." : !sdkReady ? "Loading Razorpay..." : `Pay ${amountLabel} via Razorpay`}
                </button>

                {isInternational ? (
                    <div className="mt-3 text-center text-[11px] leading-relaxed text-white/30">
                        International cards work immediately. ACH, SEPA, CHAPS, SWIFT, Trustly, GiroPay and Sofort surface
                        automatically based on your region.
                    </div>
                ) : domesticHint.recommendNeft ? (
                    <button
                        onClick={() => setShowNeft((current) => !current)}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        {showNeft ? "Hide NEFT/RTGS option" : "Pay via NEFT / RTGS instead"}
                    </button>
                ) : null}
            </motion.div>

            {!isInternational && showNeft && (
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
