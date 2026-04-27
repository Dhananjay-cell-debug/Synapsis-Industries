"use client";

// ─── DELIVER VIEW (CLIENT) — Phase 5 ────────────────────────────────────────
// Client's surface for review:
//   - View current build (latest deliverable)
//   - Either submit revision feedback (POST submitRevision) — stays in P5
//   - Or click "Approve final" (POST finalApprove) — advances to P6
//
// First 2 revision rounds free; 3rd onwards becomes a paid round (admin should
// link a Change Order in V2 — for V1 the round is just flagged isFree=false).

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, ExternalLink, AlertCircle, Sparkles, MessageSquare,
    ChevronDown, ChevronUp, Hourglass, Clock, ArrowRight,
} from "lucide-react";
import { FREE_REVISION_ROUNDS } from "@/lib/phases/constants";
import type { Deliverable, RevisionRound } from "@/lib/phases/schema";

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

export default function DeliverView({ deal, onUpdated }: Props) {
    const p5 = deal.phaseData?.phase5 || {};
    const deliverables: Deliverable[] = p5.deliverables || [];
    const rounds: RevisionRound[] = p5.revisionRounds || [];
    const reviewDeadline: number | undefined = p5.reviewDeadline;
    const finalApprovedAt: number | undefined = p5.finalApprovedAt;

    const latestVersion = deliverables.length > 0 ? Math.max(...deliverables.map(d => d.version)) : 0;
    const currentDeliverable = deliverables.find(d => d.version === latestVersion);

    const freeUsed = rounds.filter(r => r.isFree).length;
    const freeRemaining = Math.max(0, FREE_REVISION_ROUNDS - freeUsed);
    const nextRoundFree = freeRemaining > 0;

    const pendingRound = rounds.find(r => !r.resolvedAt);

    const refreshDeal = async () => {
        const res = await fetch(`/api/deals?token=${deal.token}`);
        if (res.ok) onUpdated(await res.json());
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#11B8EA] font-bold mb-2">DELIVER · Phase 5</p>
                <h1 className="font-serif text-4xl text-white tracking-tight">Your build is ready for review.</h1>
                <p className="text-white/50 text-sm mt-2 max-w-xl leading-relaxed">
                    Open the staging link, walk through the system, and either request revisions or approve the final build.
                    {freeRemaining > 0 && ` You have ${freeRemaining} free revision ${freeRemaining === 1 ? "round" : "rounds"} remaining.`}
                </p>
            </motion.div>

            {/* Already approved banner */}
            {finalApprovedAt && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 mb-6 flex items-start gap-4">
                    <CheckCircle2 size={20} className="text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-emerald-300 font-semibold">Final build approved.</p>
                        <p className="text-white/60 text-sm mt-1">
                            Now in Phase 6 — Handover. Final invoice will be raised shortly.
                        </p>
                    </div>
                </div>
            )}

            {/* Pending revision banner */}
            {pendingRound && !finalApprovedAt && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6 flex items-start gap-3">
                    <Hourglass size={18} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-amber-300 text-sm font-semibold">
                            Revision round {pendingRound.roundNumber} submitted — Synapsis is working on it.
                        </p>
                        <p className="text-white/60 text-xs mt-1">
                            New version will appear here when ready. You&apos;ll see a fresh review window.
                        </p>
                    </div>
                </div>
            )}

            {/* Current build preview */}
            {currentDeliverable && (
                <div className="rounded-2xl border border-[#11B8EA]/30 bg-gradient-to-br from-[#11B8EA]/[0.06] to-[#3B6AE8]/[0.04] p-6 mb-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="min-w-0">
                            <p className="text-[10px] tracking-[0.3em] uppercase text-[#11B8EA] font-bold mb-1">v{currentDeliverable.version} · current</p>
                            <p className="text-white font-mono text-sm truncate">{currentDeliverable.url}</p>
                            <p className="text-white/50 text-xs mt-1">{currentDeliverable.description}</p>
                        </div>
                        <a href={currentDeliverable.url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#11B8EA]/20 border border-[#11B8EA]/40 text-[#11B8EA] text-sm font-semibold hover:bg-[#11B8EA]/30 transition-colors">
                            Open build <ExternalLink size={13} />
                        </a>
                    </div>
                </div>
            )}

            {/* Decision panel — only show if not approved */}
            {!finalApprovedAt && currentDeliverable && (
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {/* Approve */}
                    <ApprovePanel token={deal.token} onApproved={onUpdated} disabled={!!pendingRound} />
                    {/* Request revision */}
                    <RevisionPanel token={deal.token}
                        nextRoundFree={nextRoundFree}
                        nextRoundNumber={rounds.length + 1}
                        disabled={!!pendingRound}
                        onSubmitted={onUpdated} />
                </div>
            )}

            {/* Revision history */}
            {rounds.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Clock size={14} className="text-white/40" />
                        <h2 className="text-white text-base font-semibold">Revision history</h2>
                    </div>
                    <div className="space-y-3">
                        {[...rounds].reverse().map(r => (
                            <RevisionHistoryRow key={r.id} round={r} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Approve final panel ────────────────────────────────────────────────────

function ApprovePanel({ token, onApproved, disabled }: {
    token: string; onApproved: (deal: DealBare) => void; disabled: boolean;
}) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const approve = async () => {
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/deals/${token}/phase/5`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "finalApprove" }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Approve failed");
            const data = await res.json();
            onApproved(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Approve failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-emerald-400" />
                <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-400 font-bold">Approve final</p>
            </div>
            <h3 className="text-white text-base font-semibold mb-2">Looks great — ship it.</h3>
            <p className="text-white/55 text-xs mb-4 leading-relaxed">
                Approving advances to Phase 6 (Handover) and triggers the final invoice. No more revisions after this.
            </p>
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            {!confirming ? (
                <button onClick={() => setConfirming(true)} disabled={disabled || busy}
                    className="w-full rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold py-3 flex items-center justify-center gap-2 disabled:opacity-30 hover:bg-emerald-500/25 transition-colors">
                    Approve final build <ArrowRight size={13} />
                </button>
            ) : (
                <div className="space-y-2">
                    <p className="text-amber-300 text-xs">Confirm: this advances to Phase 6 and ends revisions.</p>
                    <div className="flex gap-2">
                        <button onClick={approve} disabled={busy}
                            className="flex-1 rounded-xl bg-emerald-500/25 border border-emerald-500/50 text-emerald-200 text-sm font-bold py-3 disabled:opacity-30">
                            {busy ? "Approving…" : "Yes, approve"}
                        </button>
                        <button onClick={() => setConfirming(false)} disabled={busy}
                            className="px-4 rounded-xl border border-white/10 text-white/50 text-xs">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Request revision panel ─────────────────────────────────────────────────

function RevisionPanel({ token, nextRoundFree, nextRoundNumber, disabled, onSubmitted }: {
    token: string; nextRoundFree: boolean; nextRoundNumber: number; disabled: boolean;
    onSubmitted: (deal: DealBare) => void;
}) {
    const [feedback, setFeedback] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (feedback.trim().length < 20) {
            setError("Feedback must be at least 20 characters — be specific so we can act on it.");
            return;
        }
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/deals/${token}/phase/5`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "submitRevision", ctx: { feedback: feedback.trim() } }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Submit failed");
            const data = await res.json();
            onSubmitted(data.deal);
            setFeedback("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Submit failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-2xl border border-[#11B8EA]/30 bg-[#11B8EA]/[0.04] p-5">
            <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-[#11B8EA]" />
                <p className="text-[10px] tracking-[0.3em] uppercase text-[#11B8EA] font-bold">
                    Request revision · Round {nextRoundNumber} {nextRoundFree ? "(Free)" : "(Paid)"}
                </p>
            </div>
            <h3 className="text-white text-base font-semibold mb-2">Something to fix?</h3>
            <p className="text-white/55 text-xs mb-3 leading-relaxed">
                Be specific. Reference pages, behaviors, or copy. Vague feedback = vague revisions.
                {!nextRoundFree && " Free rounds used — this round may have a cost (admin will confirm via Change Order)."}
            </p>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={5}
                placeholder="e.g. On /pricing, the 'Pro' card overlaps the FAQ on mobile. Hero CTA copy should say 'Start free trial' not 'Sign up'."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-y mb-2" />
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <button onClick={submit} disabled={disabled || busy || feedback.trim().length < 20}
                className="w-full rounded-xl bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-sm font-semibold py-3 disabled:opacity-30 hover:bg-[#11B8EA]/25 transition-colors">
                {busy ? "Submitting…" : `Submit revision feedback`}
            </button>
        </div>
    );
}

// ─── Revision history row ───────────────────────────────────────────────────

function RevisionHistoryRow({ round }: { round: RevisionRound }) {
    const [open, setOpen] = useState(false);
    const resolved = !!round.resolvedAt;
    const accent = resolved ? "#10B981" : round.isFree ? "#F59E0B" : "#EF4444";
    return (
        <div className="rounded-xl border bg-white/[0.02]" style={{ borderColor: `${accent}30` }}>
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3 min-w-0 text-left">
                    <span className="text-[9px] tracking-[0.3em] uppercase font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>
                        Round {round.roundNumber} · {round.isFree ? "Free" : "Paid"}
                    </span>
                    <p className="text-white text-xs truncate">
                        {resolved ? `Resolved ${new Date(round.resolvedAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Pending"}
                    </p>
                </div>
                {open ? <ChevronUp size={12} className="text-white/40" /> : <ChevronDown size={12} className="text-white/40" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t overflow-hidden" style={{ borderColor: `${accent}30` }}>
                        <div className="p-3 text-xs">
                            <p className="text-white/75 whitespace-pre-wrap leading-relaxed">{round.feedback}</p>
                            <p className="text-white/40 text-[10px] mt-1.5">
                                Submitted {new Date(round.submittedAt).toLocaleString("en-IN")}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
