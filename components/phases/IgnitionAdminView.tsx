"use client";

// ─── IGNITION ADMIN VIEW — Phase 3 admin workspace panel ────────────────────
// Three sections (top → bottom):
//   1. Advance payment status (pending | paid | manual override)
//   2. Asset checklist review (per-item: approve/reject with reason)
//   3. Final gate: "Confirm Assets → Begin Build" (calls confirmAssets transition)
//
// Reject is a PATCH (not a transition) — sets rejectedReason on the item and
// flips submitted=false so client sees it back in their queue.

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, AlertCircle, IndianRupee, ExternalLink, X, ShieldCheck,
    ChevronRight, Hourglass, RefreshCw,
} from "lucide-react";
import { CURRENCY_SYMBOL, paymentAmountFor } from "@/lib/phases/constants";
import type { AssetChecklistItem } from "@/lib/phases/schema";

interface DealBare {
    token: string;
    name: string;
    company: string;
    phase: number;
    totalPrice?: number;
    payments?: { phase: number; status: string; amount: number; paidAt?: number; sessionId?: string; orderId?: string }[];
    phaseData?: any;
}

interface Props {
    deal: DealBare;
    adminEmail: string;
    onUpdated: (deal: DealBare) => void;
}

export default function IgnitionAdminView({ deal, adminEmail, onUpdated }: Props) {
    const p3 = deal.phaseData?.phase3 || {};
    const advancePaid = !!p3.advancePaidAt;
    const checklist: AssetChecklistItem[] = p3.assetChecklist || [];
    const advanceAmount = deal.totalPrice ? paymentAmountFor(deal.totalPrice, 3) : (p3.advanceAmount || 0);
    const advancePayment = (deal.payments || []).find(p => p.phase === 3);

    const required = checklist.filter(a => a.required);
    const requiredSubmitted = required.filter(a => a.submitted).length;
    const allRequiredSubmitted = required.length > 0 && requiredSubmitted === required.length;
    const canConfirm = advancePaid && allRequiredSubmitted;

    const [confirmBusy, setConfirmBusy] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [showManualPay, setShowManualPay] = useState(false);
    const [manualNote, setManualNote] = useState("");
    const [manualBusy, setManualBusy] = useState(false);

    // ─── Manual payment override (rare — only when client paid offline) ──
    const markManualPaid = async () => {
        if (manualNote.trim().length < 10) {
            alert("Manual payment note must be at least 10 characters (audit requirement).");
            return;
        }
        setManualBusy(true);
        try {
            const res = await fetch(`/api/deals/${deal.token}/phase/3`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: {
                        advancePaidAt: Date.now(),
                        manualPaymentNote: manualNote.trim(),
                    },
                    auditAction: "payment.advance.manual_override",
                    note: manualNote.trim(),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(`Override failed: ${err.error || res.statusText}`);
            } else {
                const data = await res.json();
                // Also flip the payment row to paid for UI consistency
                const updated = {
                    ...data.deal,
                    payments: (data.deal.payments || []).map((p: any) =>
                        p.phase === 3 ? { ...p, status: "paid", paidAt: Date.now() } : p
                    ),
                };
                // Persist payment row update too via PATCH /api/deals
                await fetch("/api/deals", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: deal.token, payments: updated.payments }),
                });
                onUpdated(updated);
                setShowManualPay(false);
                setManualNote("");
            }
        } finally {
            setManualBusy(false);
        }
    };

    // ─── Final confirm gate ────────────────────────────────────────────
    const confirmAssets = async () => {
        setConfirmBusy(true); setConfirmError(null);
        try {
            const res = await fetch(`/api/deals/${deal.token}/phase/3`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "confirmAssets",
                    ctx: { adminEmail },
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Confirm failed");
            }
            const data = await res.json();
            onUpdated(data.deal);
        } catch (e) {
            setConfirmError(e instanceof Error ? e.message : "Confirm failed");
        } finally {
            setConfirmBusy(false);
        }
    };

    // ─── Reject single asset ───────────────────────────────────────────
    const rejectAsset = async (item: AssetChecklistItem, reason: string) => {
        const updated = checklist.map(a =>
            a.id === item.id ? { ...a, submitted: false, rejectedReason: reason, url: undefined } : a
        );
        const res = await fetch(`/api/deals/${deal.token}/phase/3`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phaseDataPatch: { assetChecklist: updated },
                auditAction: "asset.rejected",
                note: `${item.label}: ${reason}`,
            }),
        });
        if (res.ok) {
            const data = await res.json();
            onUpdated(data.deal);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header banner */}
            <div className="bg-[#3B6AE8]/10 border border-[#3B6AE8]/30 rounded-xl p-4">
                <p className="text-[10px] tracking-[0.4em] uppercase text-[#11B8EA] font-bold">Ignition Console · Phase 3</p>
                <p className="text-white/85 text-sm mt-1">
                    For <span className="font-semibold">{deal.name}</span> · {deal.company}
                </p>
            </div>

            {/* ── Stage 1: Advance payment status ────────────────────── */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <IndianRupee size={14} className="text-[#11B8EA]" />
                        <p className="text-[10px] tracking-[0.4em] uppercase text-white/60 font-bold">Advance Payment</p>
                    </div>
                    {advancePaid && <span className="text-[10px] tracking-widest uppercase text-emerald-400 font-bold">Received</span>}
                </div>

                {advancePaid ? (
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold">
                                {CURRENCY_SYMBOL}{advanceAmount.toLocaleString("en-IN")} received
                            </p>
                            <p className="text-white/50 text-xs mt-0.5">
                                Paid {p3.advancePaidAt && new Date(p3.advancePaidAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                {p3.advanceRazorpayPaymentId && ` · ${p3.advanceRazorpayPaymentId}`}
                                {p3.manualPaymentNote && " · manual override"}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-center gap-3 mb-3">
                            <Hourglass size={20} className="text-amber-400 shrink-0" />
                            <div className="flex-1">
                                <p className="text-white text-sm font-semibold">
                                    Awaiting {CURRENCY_SYMBOL}{advanceAmount.toLocaleString("en-IN")} from {deal.name}
                                </p>
                                <p className="text-white/50 text-xs mt-0.5">
                                    {advancePayment?.sessionId ? `Order ${advancePayment.sessionId} created — checkout pending.` : "Client hasn't initiated payment yet."}
                                </p>
                            </div>
                        </div>
                        {!showManualPay ? (
                            <button onClick={() => setShowManualPay(true)}
                                className="text-xs text-white/50 hover:text-white/80 underline">
                                Mark as paid manually (offline)
                            </button>
                        ) : (
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[10px] tracking-[0.3em] uppercase text-amber-400 mb-2 font-bold">Manual Override</p>
                                <textarea
                                    value={manualNote}
                                    onChange={e => setManualNote(e.target.value)}
                                    rows={2}
                                    placeholder="Why are you marking this paid? (min 10 chars — audit trail)"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none"
                                />
                                <div className="flex gap-2 justify-end mt-2">
                                    <button onClick={() => { setShowManualPay(false); setManualNote(""); }}
                                        className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white">
                                        Cancel
                                    </button>
                                    <button onClick={markManualPaid} disabled={manualBusy || manualNote.trim().length < 10}
                                        className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold disabled:opacity-30">
                                        {manualBusy ? "Saving…" : "Confirm Manual Payment"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Stage 2: Asset checklist review ────────────────────── */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-[#11B8EA]" />
                        <p className="text-[10px] tracking-[0.4em] uppercase text-white/60 font-bold">Asset Checklist</p>
                    </div>
                    <span className="text-xs text-white/50 font-mono">
                        {requiredSubmitted}/{required.length} required submitted
                    </span>
                </div>

                {checklist.length === 0 ? (
                    <p className="text-white/40 text-sm py-4">No assets requested in the blueprint.</p>
                ) : (
                    <div className="space-y-2">
                        {checklist.map(item => (
                            <AssetReviewRow key={item.id} item={item} onReject={rejectAsset} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Stage 3: Confirm gate ──────────────────────────────── */}
            <div className="rounded-2xl border bg-gradient-to-br p-5"
                style={{
                    borderColor: canConfirm ? "rgba(17,184,234,0.3)" : "rgba(255,255,255,0.08)",
                    background: canConfirm
                        ? "linear-gradient(135deg, rgba(17,184,234,0.08), rgba(59,106,232,0.05))"
                        : "rgba(255,255,255,0.02)",
                }}>
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                            background: canConfirm ? "rgba(17,184,234,0.15)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${canConfirm ? "rgba(17,184,234,0.3)" : "rgba(255,255,255,0.08)"}`,
                        }}>
                        <ShieldCheck size={18} style={{ color: canConfirm ? "#11B8EA" : "rgba(255,255,255,0.25)" }} />
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-semibold">Confirm assets → Begin Phase 4 (Build)</p>
                        <p className="text-white/50 text-sm mt-1">
                            Locks the asset set, marks Phase 3 complete, and opens the build workspace. This is irreversible without admin override.
                        </p>
                        {!canConfirm && (
                            <p className="text-amber-400/80 text-xs mt-2">
                                Gate blocked:
                                {!advancePaid && " advance not received."}
                                {advancePaid && !allRequiredSubmitted && ` ${required.length - requiredSubmitted} required asset(s) still pending.`}
                            </p>
                        )}
                        {confirmError && <p className="text-red-400 text-xs mt-2">{confirmError}</p>}
                    </div>
                </div>
                <div className="flex justify-end mt-4">
                    <button
                        onClick={confirmAssets}
                        disabled={!canConfirm || confirmBusy}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                            background: canConfirm ? "#11B8EA" : "rgba(255,255,255,0.04)",
                            color: canConfirm ? "#0A0F1E" : "rgba(255,255,255,0.3)",
                        }}>
                        {confirmBusy ? "Confirming…" : "Confirm Assets → Build"}
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Asset row (admin review mode) ──────────────────────────────────────────
function AssetReviewRow({ item, onReject }: {
    item: AssetChecklistItem;
    onReject: (item: AssetChecklistItem, reason: string) => Promise<void>;
}) {
    const [showReject, setShowReject] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    const handleReject = async () => {
        if (!reason.trim()) return;
        setBusy(true);
        try {
            await onReject(item, reason.trim());
            setShowReject(false); setReason("");
        } finally {
            setBusy(false);
        }
    };

    const accent = item.submitted ? "#10B981" : item.rejectedReason ? "#EF4444" : "#94A3B8";

    return (
        <div className="rounded-xl border bg-white/[0.02] p-3"
            style={{ borderColor: `${accent}30` }}>
            <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}>
                    {item.submitted ? <CheckCircle2 size={12} style={{ color: accent }} />
                        : item.rejectedReason ? <AlertCircle size={12} style={{ color: accent }} />
                        : <X size={12} style={{ color: accent }} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white text-sm font-medium">{item.label}</p>
                        {item.required && <span className="text-[9px] tracking-wider uppercase text-amber-400 font-bold">Required</span>}
                        {item.submitted && <span className="text-[9px] tracking-wider uppercase text-emerald-400 font-bold">Submitted</span>}
                        {item.rejectedReason && <span className="text-[9px] tracking-wider uppercase text-red-400 font-bold">Awaiting Re-submit</span>}
                    </div>
                    {item.description && <p className="text-white/45 text-xs mt-0.5">{item.description}</p>}

                    {item.submitted && item.url && (
                        <div className="mt-2 flex items-center gap-3">
                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                                className="text-[#11B8EA] hover:text-[#11B8EA]/80 text-xs underline flex items-center gap-1">
                                <ExternalLink size={11} /> Open submission
                            </a>
                            <span className="text-white/30 text-[10px]">
                                {item.submittedAt && new Date(item.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                            {!showReject && (
                                <button onClick={() => setShowReject(true)}
                                    className="text-red-400 hover:text-red-300 text-xs underline">
                                    Reject (request re-submit)
                                </button>
                            )}
                        </div>
                    )}

                    {item.rejectedReason && !showReject && (
                        <p className="text-red-300 text-xs mt-1">
                            <span className="font-semibold">Reason given:</span> {item.rejectedReason}
                        </p>
                    )}

                    <AnimatePresence>
                        {showReject && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                className="mt-2">
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    rows={2}
                                    placeholder="Why is this being rejected? Client will see this verbatim."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-red-400/50"
                                />
                                <div className="flex gap-2 justify-end mt-2">
                                    <button onClick={() => { setShowReject(false); setReason(""); }}
                                        className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white">
                                        Cancel
                                    </button>
                                    <button onClick={handleReject} disabled={busy || !reason.trim()}
                                        className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold disabled:opacity-30">
                                        {busy ? "Sending…" : "Send to Client"}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
