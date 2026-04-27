"use client";

// ─── BLUEPRINT VIEWER — Phase 2 client read view + 3 actions ────────────────
// Rendered inside the client portal (/client/[token]) when deal.phase === 2
// and blueprint.status === "sent". Also reused inside admin's "Preview as
// Client" toggle.
//
// Three actions for client:
//   - Approve   → POST action=approveBlueprint        (T2 → 3)
//   - Request Changes (with feedback)                 (stays in P2; capped)
//   - Decline   → POST action=declineBlueprint        (terminal)

import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, MessageCircleWarning, XCircle, IndianRupee, Calendar, Layers, Code2, ListChecks, FileText, ShieldCheck } from "lucide-react";
import { CURRENCY_SYMBOL, BLUEPRINT_CHANGE_ROUNDS_MAX, PHASE_NAMES } from "@/lib/phases/constants";
import type { Blueprint } from "@/lib/phases/schema";

interface DealBare {
    token: string;
    name: string;
    company: string;
    phase: number;
    phaseData?: { phase2?: { blueprint?: Blueprint; changeRequestCount?: number } };
}

interface Props {
    deal: DealBare;
    onUpdated: (deal: DealBare) => void;
    readOnly?: boolean; // admin "preview as client" mode disables actions
}

export default function BlueprintViewer({ deal, onUpdated, readOnly }: Props) {
    const bp = deal.phaseData?.phase2?.blueprint;
    const [busy, setBusy] = useState<"approve" | "changes" | "decline" | null>(null);
    const [showChanges, setShowChanges] = useState(false);
    const [showDecline, setShowDecline] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [declineReason, setDeclineReason] = useState("");
    const [error, setError] = useState<string | null>(null);

    if (!bp) {
        return (
            <div className="p-12 text-center">
                <p className="text-white/40 text-sm">Blueprint is being prepared. You'll see it here when ready.</p>
            </div>
        );
    }

    const changeRounds = deal.phaseData?.phase2?.changeRequestCount || 0;
    const cap = changeRounds >= BLUEPRINT_CHANGE_ROUNDS_MAX;
    const sentAlready = bp.status === "sent" || bp.status === "changes_requested";
    const finalised = bp.status === "approved" || bp.status === "declined";

    // ─── API calls ──────────────────────────────────────────────────────────
    const callAction = async (action: string, ctx: Record<string, unknown> = {}) => {
        setBusy(action.includes("Changes") ? "changes" : action.includes("decline") ? "decline" : "approve");
        setError(null);
        try {
            const res = await fetch(`/api/deals/${deal.token}/phase/2`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ctx }),
            });
            if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
            const data = await res.json();
            onUpdated(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#11B8EA] font-bold mb-2">
                    {PHASE_NAMES[2]} · v{bp.version}
                </p>
                <h1 className="font-serif text-4xl text-white tracking-tight">Project Blueprint</h1>
                <p className="text-white/50 text-sm mt-2">Prepared for {deal.name} · {deal.company}</p>

                {bp.status === "approved" && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                        <ShieldCheck size={13} /> Approved {bp.approvedAt && new Date(bp.approvedAt).toLocaleDateString("en-IN")}
                    </div>
                )}
                {bp.status === "declined" && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                        <XCircle size={13} /> Declined
                    </div>
                )}
            </motion.div>

            {/* Sections */}
            <Section icon={FileText} title="The Problem">
                <p className="text-white/85 whitespace-pre-line leading-relaxed">{bp.problemStatement}</p>
            </Section>

            <Section icon={Layers} title="The Solution">
                <p className="text-white/85 whitespace-pre-line leading-relaxed">{bp.solutionArchitecture}</p>
            </Section>

            {(bp.scopeIn.length > 0 || bp.scopeOut.length > 0) && (
                <Section icon={Layers} title="Scope">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bp.scopeIn.length > 0 && (
                            <div>
                                <p className="text-[9px] tracking-[0.4em] uppercase text-emerald-400 mb-2 font-bold">In Scope</p>
                                <ul className="space-y-1">
                                    {bp.scopeIn.map((s, i) => (
                                        <li key={i} className="text-white/85 text-sm flex items-start gap-2">
                                            <span className="text-emerald-400 mt-1">+</span> {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {bp.scopeOut.length > 0 && (
                            <div>
                                <p className="text-[9px] tracking-[0.4em] uppercase text-red-400 mb-2 font-bold">Out of Scope</p>
                                <ul className="space-y-1">
                                    {bp.scopeOut.map((s, i) => (
                                        <li key={i} className="text-white/65 text-sm flex items-start gap-2">
                                            <span className="text-red-400 mt-1">−</span> {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </Section>
            )}

            {bp.techStack.length > 0 && (
                <Section icon={Code2} title="Tech Stack">
                    <div className="space-y-2">
                        {bp.techStack.map((t, i) => (
                            <div key={i} className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                <span className="font-mono text-[#11B8EA] text-sm shrink-0 md:w-32">{t.tech}</span>
                                <span className="text-white/65 text-sm">{t.rationale}</span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {bp.timeline.length > 0 && (
                <Section icon={Calendar} title="Timeline">
                    <div className="space-y-2">
                        {bp.timeline.map((t, i) => (
                            <div key={i} className="flex items-baseline gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 font-bold shrink-0">Sprint {t.sprintNumber}</span>
                                <span className="text-white/85 text-sm flex-1">{t.goal}</span>
                                <span className="text-white/50 text-xs font-mono shrink-0">{t.durationWeeks}w</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-white/40 mt-2 font-mono">
                        Total: {bp.timeline.reduce((s, t) => s + t.durationWeeks, 0)} weeks
                    </p>
                </Section>
            )}

            <Section icon={IndianRupee} title="Investment">
                <div className="space-y-1">
                    {bp.investment.map((l, i) => (
                        <div key={i} className="flex items-baseline justify-between py-2 border-b border-white/5">
                            <span className="text-white/75 text-sm">{l.label}</span>
                            <span className="font-mono text-white/85 text-sm">
                                {CURRENCY_SYMBOL}{l.amount.toLocaleString("en-IN")}
                            </span>
                        </div>
                    ))}
                    <div className="flex items-baseline justify-between pt-3 mt-2 border-t-2 border-[#11B8EA]/30">
                        <span className="text-white text-sm tracking-[0.2em] uppercase font-bold">Total</span>
                        <span className="font-mono text-white text-2xl">
                            {CURRENCY_SYMBOL}{bp.investmentTotal.toLocaleString("en-IN")}
                        </span>
                    </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-[#11B8EA]/5 border border-[#11B8EA]/15">
                    <p className="text-[10px] tracking-[0.4em] uppercase text-[#11B8EA] font-bold mb-2">Payment Schedule</p>
                    <div className="space-y-1.5">
                        {bp.paymentStructure.map((p, i) => (
                            <div key={i} className="flex items-baseline justify-between text-sm">
                                <span className="text-white/85">{p.label} <span className="text-white/40">· Phase {p.phase}</span></span>
                                <span className="font-mono text-white/85">
                                    {p.percentage}% · {CURRENCY_SYMBOL}{Math.round((bp.investmentTotal * p.percentage) / 100).toLocaleString("en-IN")}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {bp.requiredFromClient.length > 0 && (
                <Section icon={ListChecks} title="What we'll need from you">
                    <ul className="space-y-1">
                        {bp.requiredFromClient.map((r, i) => (
                            <li key={i} className="text-white/85 text-sm flex items-start gap-2">
                                <span className="text-[#11B8EA] mt-0.5">→</span> {r}
                            </li>
                        ))}
                    </ul>
                    <p className="text-[10px] text-white/40 mt-3">These become your asset checklist in Phase 3 once you approve.</p>
                </Section>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3 rounded-lg mt-4">
                    {error}
                </div>
            )}

            {/* Actions — only when sent or changes_requested, and not in readOnly preview */}
            {!readOnly && !finalised && sentAlready && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="sticky bottom-0 bg-[#0A0F1E]/95 backdrop-blur-md border-t border-white/8 -mx-6 px-6 py-4 mt-8"
                >
                    {!showChanges && !showDecline && (
                        <div className="flex flex-col sm:flex-row gap-2 justify-end">
                            <button
                                onClick={() => setShowDecline(true)}
                                disabled={busy !== null}
                                className="px-4 py-2.5 rounded-lg text-xs font-medium text-white/60 hover:text-red-300 border border-white/10 hover:border-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <XCircle size={13} /> Decline
                            </button>
                            <button
                                onClick={() => setShowChanges(true)}
                                disabled={busy !== null || cap}
                                className="px-4 py-2.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                title={cap ? `Reached ${BLUEPRINT_CHANGE_ROUNDS_MAX} change rounds — further revisions may be billable` : ""}
                            >
                                <MessageCircleWarning size={13} /> Request Changes {cap && "(cap reached)"}
                            </button>
                            <button
                                onClick={() => callAction("approveBlueprint")}
                                disabled={busy !== null}
                                className="px-5 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase bg-[#11B8EA] hover:bg-[#11B8EA]/90 text-[#0A0F1E] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <CheckCircle2 size={13} /> {busy === "approve" ? "Approving..." : "Approve & Proceed"}
                            </button>
                        </div>
                    )}

                    {showChanges && (
                        <div>
                            <p className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">What needs to change?</p>
                            <textarea
                                rows={3}
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#11B8EA]/40"
                                placeholder="Be specific — pricing, scope, timeline, etc..."
                            />
                            <div className="flex gap-2 justify-end mt-2">
                                <button onClick={() => setShowChanges(false)} className="px-4 py-2 rounded-lg text-xs text-white/60 hover:text-white/85 transition-all">
                                    Cancel
                                </button>
                                <button
                                    onClick={() => feedback.trim() && callAction("requestChanges", { feedback: feedback.trim() })}
                                    disabled={!feedback.trim() || busy !== null}
                                    className="px-4 py-2 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-500/90 text-[#0A0F1E] transition-all disabled:opacity-50"
                                >
                                    {busy === "changes" ? "Sending..." : "Send Feedback"}
                                </button>
                            </div>
                        </div>
                    )}

                    {showDecline && (
                        <div>
                            <p className="text-[10px] tracking-[0.3em] uppercase text-red-400 mb-2 font-bold">Decline blueprint</p>
                            <p className="text-white/60 text-xs mb-2">This terminates the engagement. Optional reason will help us improve.</p>
                            <textarea
                                rows={2}
                                value={declineReason}
                                onChange={e => setDeclineReason(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/40"
                                placeholder="Optional"
                            />
                            <div className="flex gap-2 justify-end mt-2">
                                <button onClick={() => setShowDecline(false)} className="px-4 py-2 rounded-lg text-xs text-white/60 hover:text-white/85 transition-all">
                                    Cancel
                                </button>
                                <button
                                    onClick={() => callAction("declineBlueprint", { reason: declineReason.trim() || undefined })}
                                    disabled={busy !== null}
                                    className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-500/90 text-white transition-all disabled:opacity-50"
                                >
                                    {busy === "decline" ? "Declining..." : "Confirm Decline"}
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6"
        >
            <div className="flex items-center gap-2 mb-3">
                <Icon size={14} className="text-[#11B8EA]" />
                <h3 className="text-[10px] tracking-[0.4em] uppercase text-white/60 font-bold">{title}</h3>
            </div>
            <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5">
                {children}
            </div>
        </motion.div>
    );
}
