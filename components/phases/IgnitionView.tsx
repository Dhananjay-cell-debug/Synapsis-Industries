"use client";

// ─── IGNITION VIEW (CLIENT) — Phase 3 ───────────────────────────────────────
// Two-stage process:
//   Stage 1: 30% advance via Razorpay (gate). Until paid, asset upload is locked.
//   Stage 2: Per-item asset checklist. Each upload hits /api/upload, then
//            /api/deals/[token]/phase/3 with action=submitAsset.
//
// When all required items are submitted, client sees "Awaiting admin review".
// Admin's confirmAssets action advances to Phase 4 — caller polls and re-renders.

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, Upload, Lock, AlertCircle, FileCheck2, Hourglass, RefreshCw,
} from "lucide-react";
import RazorpayCheckout from "@/components/ui/RazorpayCheckout";
import { CURRENCY_SYMBOL, paymentAmountFor } from "@/lib/phases/constants";
import type { AssetChecklistItem } from "@/lib/phases/schema";

interface DealBare {
    token: string;
    name: string;
    company: string;
    phase: number;
    totalPrice?: number;
    payments?: { phase: number; status: string; amount: number; paidAt?: number }[];
    phaseData?: any;
}

interface Props {
    deal: DealBare;
    onUpdated: (deal: DealBare) => void;
}

export default function IgnitionView({ deal, onUpdated }: Props) {
    const p3 = deal.phaseData?.phase3 || {};
    const advancePaid = !!p3.advancePaidAt;
    const checklist: AssetChecklistItem[] = p3.assetChecklist || [];
    const advancePayment = (deal.payments || []).find(p => p.phase === 3);
    const advanceAmount = deal.totalPrice ? paymentAmountFor(deal.totalPrice, 3) : (p3.advanceAmount || 0);

    const required = checklist.filter(a => a.required);
    const requiredSubmitted = required.filter(a => a.submitted).length;
    const allRequiredDone = required.length > 0 && requiredSubmitted === required.length;

    const refreshDeal = async () => {
        const res = await fetch(`/api/deals?token=${deal.token}`);
        if (res.ok) onUpdated(await res.json());
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#11B8EA] font-bold mb-2">IGNITION · Phase 3</p>
                <h1 className="font-serif text-4xl text-white tracking-tight">Kickoff &amp; Assets.</h1>
                <p className="text-white/50 text-sm mt-2 max-w-xl leading-relaxed">
                    Two steps to unlock the build. First the 30% advance, then the materials we need from you. As soon as both are in,
                    we begin Phase 4.
                </p>
            </motion.div>

            {/* STEP 1 — Advance Payment */}
            <Section
                step={1}
                title="Pay 30% advance"
                done={advancePaid}
            >
                <RazorpayCheckout
                    token={deal.token}
                    paymentPhase={3}
                    amount={advanceAmount}
                    label="Advance — kicks off the build"
                    description="Locks your slot, unlocks asset submission, and triggers Phase 4 once your materials land."
                    clientName={deal.name}
                    isPaid={advancePaid}
                    paidAt={advancePayment?.paidAt}
                    onPaid={refreshDeal}
                />
            </Section>

            {/* STEP 2 — Asset Checklist */}
            <Section
                step={2}
                title="Submit project assets"
                done={allRequiredDone}
                locked={!advancePaid}
            >
                {!advancePaid ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 flex items-center gap-3 text-white/40">
                        <Lock size={16} />
                        <span className="text-sm">Unlocks once advance is received.</span>
                    </div>
                ) : checklist.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 flex items-center gap-3 text-white/50">
                        <AlertCircle size={16} />
                        <span className="text-sm">No assets requested for this project. Admin will confirm shortly.</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {checklist.map(item => (
                            <AssetRow
                                key={item.id}
                                item={item}
                                token={deal.token}
                                onUpdated={onUpdated}
                            />
                        ))}
                    </div>
                )}
            </Section>

            {/* Completion banner */}
            {advancePaid && allRequiredDone && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 flex items-start gap-4"
                >
                    <Hourglass size={20} className="text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-emerald-300 font-semibold text-sm">All set on your end.</p>
                        <p className="text-white/60 text-sm mt-1">
                            Advance received and every required asset is in. Awaiting admin confirmation — once approved,
                            you&apos;ll auto-advance to Phase 4 (Build).
                        </p>
                        <button
                            onClick={refreshDeal}
                            className="mt-3 inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 text-xs font-medium"
                        >
                            <RefreshCw size={11} /> Refresh status
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// ─── Section wrapper ────────────────────────────────────────────────────────
function Section({ step, title, children, done, locked }: {
    step: number; title: string; children: React.ReactNode; done?: boolean; locked?: boolean;
}) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
                <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                        background: done ? "rgba(16,185,129,0.15)" : locked ? "rgba(255,255,255,0.05)" : "rgba(17,184,234,0.15)",
                        border: `1px solid ${done ? "rgba(16,185,129,0.4)" : locked ? "rgba(255,255,255,0.1)" : "rgba(17,184,234,0.4)"}`,
                        color: done ? "#10B981" : locked ? "rgba(255,255,255,0.3)" : "#11B8EA",
                    }}
                >
                    {done ? <CheckCircle2 size={14} /> : step}
                </div>
                <h2 className="text-white text-lg font-semibold tracking-tight">{title}</h2>
                {done && <span className="text-[10px] tracking-[0.3em] uppercase text-emerald-400 font-bold">Done</span>}
                {locked && <span className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-bold">Locked</span>}
            </div>
            <div className="ml-10">{children}</div>
        </div>
    );
}

// ─── Asset row — handles upload + submit per item ──────────────────────────
function AssetRow({ item, token, onUpdated }: {
    item: AssetChecklistItem; token: string; onUpdated: (deal: DealBare) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [textValue, setTextValue] = useState("");

    const submitUrl = async (url: string) => {
        const res = await fetch(`/api/deals/${token}/phase/3`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "submitAsset", ctx: { itemId: item.id, url } }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Submit failed");
        const data = await res.json();
        onUpdated(data.deal);
    };

    const handleFile = async (file: File) => {
        setBusy(true); setError(null);
        try {
            const form = new FormData();
            form.append("file", file);
            const upRes = await fetch("/api/upload", { method: "POST", body: form });
            if (!upRes.ok) throw new Error((await upRes.json()).error || "Upload failed");
            const { url } = await upRes.json();
            await submitUrl(url);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed");
        } finally {
            setBusy(false);
        }
    };

    const handleTextSubmit = async () => {
        if (!textValue.trim()) return;
        setBusy(true); setError(null);
        try {
            await submitUrl(textValue.trim());
            setTextValue("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Submit failed");
        } finally {
            setBusy(false);
        }
    };

    const accent = item.submitted ? "#10B981" : item.rejectedReason ? "#EF4444" : "#11B8EA";

    return (
        <div className="rounded-xl border bg-white/[0.02] p-4 transition-colors"
            style={{ borderColor: `${accent}30` }}>
            <div className="flex items-start gap-3 mb-2">
                <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}
                >
                    {item.submitted ? <CheckCircle2 size={12} style={{ color: accent }} />
                        : item.rejectedReason ? <AlertCircle size={12} style={{ color: accent }} />
                        : <FileCheck2 size={12} style={{ color: accent }} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{item.label}</p>
                        {item.required && <span className="text-[9px] tracking-wider uppercase text-amber-400 font-bold">Required</span>}
                    </div>
                    {item.description && <p className="text-white/45 text-xs mt-0.5">{item.description}</p>}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {item.submitted ? (
                    <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="ml-9 mt-2 flex items-center justify-between gap-3 text-xs">
                        <span className="text-emerald-400/80">
                            Submitted {item.submittedAt && new Date(item.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                        {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                                className="text-[#11B8EA] hover:text-[#11B8EA]/80 underline truncate max-w-[200px]">
                                View
                            </a>
                        )}
                    </motion.div>
                ) : (
                    <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="ml-9 mt-2 space-y-2">
                        {item.rejectedReason && (
                            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs">
                                <span className="text-red-300 font-semibold">Admin requested re-submit:</span>{" "}
                                <span className="text-white/80">{item.rejectedReason}</span>
                            </div>
                        )}
                        <div className="flex gap-2 items-center">
                            <label className="flex-1 cursor-pointer">
                                <div className="rounded-lg border border-dashed border-white/15 hover:border-[#11B8EA]/50 hover:bg-white/[0.03] px-3 py-2 flex items-center gap-2 text-xs text-white/60 transition-all">
                                    <Upload size={12} />
                                    <span>{busy ? "Uploading…" : "Choose file"}</span>
                                </div>
                                <input
                                    type="file" className="hidden"
                                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                                    disabled={busy}
                                />
                            </label>
                            <span className="text-white/25 text-[10px]">or paste link</span>
                            <input
                                value={textValue}
                                onChange={e => setTextValue(e.target.value)}
                                placeholder="https://…"
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40"
                                disabled={busy}
                            />
                            <button onClick={handleTextSubmit} disabled={busy || !textValue.trim()}
                                className="px-3 py-2 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold disabled:opacity-30">
                                Submit
                            </button>
                        </div>
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
