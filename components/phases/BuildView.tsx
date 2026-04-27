"use client";

// ─── BUILD VIEW (CLIENT) — Phase 4 ──────────────────────────────────────────
// Client's surface during the build:
//   1. Read sprint reports + respond to "Need from client" items
//   2. Mid-payment Razorpay gate (only for large projects ≥ ₹2L)
//   3. Decide on pending change orders (approve/decline)
//
// All mutations are PATCH to /api/deals/[token]/phase/4 (responses + CO decisions
// don't change phase). Mid-payment goes through RazorpayCheckout (paymentPhase=4).

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, Clock, AlertCircle, ExternalLink, ChevronDown, ChevronUp,
    GitBranch, Hourglass, MessageSquare, CheckCheck, X,
} from "lucide-react";
import RazorpayCheckout from "@/components/ui/RazorpayCheckout";
import { CURRENCY_SYMBOL, paymentAmountFor, LARGE_PROJECT_THRESHOLD } from "@/lib/phases/constants";
import type { SprintReport, ChangeOrder } from "@/lib/phases/schema";

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

export default function BuildView({ deal, onUpdated }: Props) {
    const p4 = deal.phaseData?.phase4 || {};
    const sprintReports: SprintReport[] = p4.sprintReports || [];
    const changeOrders: ChangeOrder[] = p4.changeOrders || [];
    const stagingUrl: string = p4.stagingUrl || "";

    const isLarge = (deal.totalPrice || 0) >= LARGE_PROJECT_THRESHOLD;
    const midAmount = deal.totalPrice ? paymentAmountFor(deal.totalPrice, 4) : 0;
    const midPayment = (deal.payments || []).find(p => p.phase === 4);
    const midPaid = !!midPayment && midPayment.status === "paid";

    const pendingCOs = changeOrders.filter(co => co.status === "pending");

    const refreshDeal = async () => {
        const res = await fetch(`/api/deals?token=${deal.token}`);
        if (res.ok) onUpdated(await res.json());
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#11B8EA] font-bold mb-2">BUILD · Phase 4</p>
                <h1 className="font-serif text-4xl text-white tracking-tight">The build is live.</h1>
                <p className="text-white/50 text-sm mt-2 max-w-xl leading-relaxed">
                    Weekly sprint reports below. Read them, respond to anything that needs your input,
                    and approve change orders if scope shifts mid-build.
                </p>
            </motion.div>

            {/* Current staging strip */}
            {stagingUrl && (
                <div className="rounded-xl border border-[#11B8EA]/30 bg-[#11B8EA]/[0.04] p-4 mb-6 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[9px] tracking-[0.3em] uppercase text-[#11B8EA] font-bold mb-1">Live staging</p>
                        <p className="text-white text-sm font-mono truncate">{stagingUrl}</p>
                    </div>
                    <a href={stagingUrl} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold hover:bg-[#11B8EA]/25 transition-colors">
                        Preview <ExternalLink size={11} />
                    </a>
                </div>
            )}

            {/* Pending Change Orders */}
            {pendingCOs.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <GitBranch size={14} className="text-[#3B6AE8]" />
                        <h2 className="text-white text-base font-semibold">
                            Pending change orders <span className="text-amber-400 ml-1">({pendingCOs.length})</span>
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {pendingCOs.map(co => (
                            <ChangeOrderDecision
                                key={co.id}
                                co={co}
                                token={deal.token}
                                allOrders={changeOrders}
                                onUpdated={onUpdated}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Mid-Payment Gate */}
            {isLarge && (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Hourglass size={14} className="text-[#3B6AE8]" />
                        <h2 className="text-white text-base font-semibold">
                            Mid-project payment {midPaid && <span className="text-emerald-400 text-xs ml-2">· Received</span>}
                        </h2>
                    </div>
                    <RazorpayCheckout
                        token={deal.token}
                        paymentPhase={4}
                        amount={midAmount}
                        label="Mid-project milestone payment"
                        description="Confirms direction is right. Unlocks the final delivery sprint."
                        clientName={deal.name}
                        isPaid={midPaid}
                        paidAt={midPayment?.paidAt}
                        onPaid={refreshDeal}
                    />
                </div>
            )}

            {/* Sprint Reports Feed */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <Clock size={14} className="text-[#11B8EA]" />
                    <h2 className="text-white text-base font-semibold">Sprint feed</h2>
                </div>
                {sprintReports.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 flex items-center gap-3 text-white/40">
                        <AlertCircle size={14} />
                        <span className="text-sm">No sprint reports yet. First update incoming soon.</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {[...sprintReports].reverse().map((sr, idx) => (
                            <SprintReportRow
                                key={sr.id}
                                report={sr}
                                index={sprintReports.length - idx}
                                token={deal.token}
                                allReports={sprintReports}
                                onUpdated={onUpdated}
                                defaultOpen={idx === 0}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sprint Report Row (with response) ──────────────────────────────────────

function SprintReportRow({ report, index, token, allReports, onUpdated, defaultOpen }: {
    report: SprintReport; index: number; token: string;
    allReports: SprintReport[]; onUpdated: (deal: DealBare) => void;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen || false);
    const [response, setResponse] = useState(report.clientResponse || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const responded = !!report.clientResponse;
    const needsAction = report.needFromClient.length > 0 && !responded;
    const overdue = needsAction && !!report.responseDeadline && Date.now() > report.responseDeadline;
    const hoursLeft = report.responseDeadline
        ? Math.max(0, Math.floor((report.responseDeadline - Date.now()) / (3600 * 1000)))
        : null;

    const submitResponse = async () => {
        if (!response.trim()) return;
        setBusy(true); setError(null);
        try {
            const updatedReports = allReports.map(r =>
                r.id === report.id
                    ? { ...r, clientResponse: response.trim(), clientRespondedAt: Date.now() }
                    : r
            );
            const res = await fetch(`/api/deals/${token}/phase/4`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { sprintReports: updatedReports },
                    auditAction: "sprint.client_responded",
                    note: `Sprint #${index} responded by client`,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Save failed");
            const data = await res.json();
            onUpdated(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`rounded-xl border ${overdue ? "border-red-500/40" : "border-white/10"} bg-white/[0.02] overflow-hidden`}>
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4 hover:bg-white/[0.02]">
                <div className="flex items-center gap-3 min-w-0 text-left">
                    <div className="w-9 h-9 rounded-xl bg-[#11B8EA]/10 border border-[#11B8EA]/30 flex items-center justify-center text-[#11B8EA] text-sm font-bold shrink-0">
                        {index}
                    </div>
                    <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">
                            Sprint #{index} · Week of {new Date(report.weekOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-[#11B8EA]" style={{ width: `${report.progressPct}%` }} />
                            </div>
                            <span className="text-[10px] text-white/50 tabular-nums">{report.progressPct}%</span>
                            {responded ? (
                                <span className="text-[9px] tracking-[0.25em] uppercase text-emerald-400 font-bold ml-1">Responded</span>
                            ) : overdue ? (
                                <span className="text-[9px] tracking-[0.25em] uppercase text-red-300 font-bold ml-1 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/40">Overdue</span>
                            ) : needsAction ? (
                                <span className="text-[9px] tracking-[0.25em] uppercase text-amber-400 font-bold ml-1">
                                    Action needed{hoursLeft !== null ? ` · ${hoursLeft}h` : ""}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
                {open ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/10 overflow-hidden">
                        <div className="p-4 space-y-4 text-xs">
                            <ReportSection label="What's done" items={report.done} accent="#10B981" />
                            <ReportSection label="What's next" items={report.next} accent="#11B8EA" />
                            {report.needFromClient.length > 0 && (
                                <ReportSection label="Need from you" items={report.needFromClient} accent="#F59E0B" />
                            )}
                            {report.stagingUrl && (
                                <div>
                                    <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1">Staging</p>
                                    <a href={report.stagingUrl} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[#11B8EA] hover:text-[#11B8EA]/80 underline">
                                        {report.stagingUrl} <ExternalLink size={10} />
                                    </a>
                                </div>
                            )}

                            {/* Response */}
                            <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare size={11} className="text-white/40" />
                                    <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 font-bold">Your response</p>
                                </div>
                                {responded ? (
                                    <div>
                                        <p className="text-white/80 leading-relaxed whitespace-pre-wrap mb-2">{report.clientResponse}</p>
                                        <p className="text-emerald-400/70 text-[10px]">
                                            ✓ Submitted {report.clientRespondedAt && new Date(report.clientRespondedAt).toLocaleString("en-IN")}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <textarea value={response} onChange={e => setResponse(e.target.value)} rows={3}
                                            placeholder="Anything to flag, blockers, answers to 'need from you'…"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-y" />
                                        {error && <p className="text-red-400 text-xs">{error}</p>}
                                        <button onClick={submitResponse} disabled={busy || !response.trim()}
                                            className="px-4 py-2 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold disabled:opacity-30">
                                            {busy ? "Saving…" : "Submit response"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ReportSection({ label, items, accent }: { label: string; items: string[]; accent: string }) {
    if (!items || items.length === 0) return null;
    return (
        <div>
            <p className="text-[9px] tracking-[0.3em] uppercase mb-1.5 font-bold" style={{ color: accent }}>{label}</p>
            <ul className="space-y-1">
                {items.map((it, i) => (
                    <li key={i} className="text-white/80 leading-relaxed flex items-start gap-2">
                        <span style={{ color: accent }}>•</span>
                        <span>{it}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Change Order Decision (approve/decline) ────────────────────────────────

function ChangeOrderDecision({ co, token, allOrders, onUpdated }: {
    co: ChangeOrder; token: string; allOrders: ChangeOrder[];
    onUpdated: (deal: DealBare) => void;
}) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const decide = async (decision: "approved" | "declined") => {
        setBusy(true); setError(null);
        try {
            const updatedOrders = allOrders.map(o =>
                o.id === co.id
                    ? { ...o, status: decision, decidedAt: Date.now(), clientNote: note.trim() || undefined }
                    : o
            );
            const res = await fetch(`/api/deals/${token}/phase/4`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { changeOrders: updatedOrders },
                    auditAction: `changeOrder.${decision}`,
                    note: `${decision} by client: ${co.title}${note.trim() ? ` — ${note.trim()}` : ""}`,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Save failed");
            const data = await res.json();
            onUpdated(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-amber-300 text-xs font-bold tracking-[0.2em] uppercase mb-1">Change request from Synapsis</p>
                    <p className="text-white text-base font-semibold">{co.title}</p>
                </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{co.description}</p>

            <div className="grid grid-cols-3 gap-2">
                <ImpactStat label="Scope" value={co.scopeImpact} />
                <ImpactStat label="Timeline" value={`+${co.timelineImpactDays} days`} />
                <ImpactStat label="Cost" value={`${CURRENCY_SYMBOL}${co.costImpact.toLocaleString("en-IN")}`} />
            </div>

            <div>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="Note (optional)"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400/40 resize-y" />
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2">
                <button onClick={() => decide("approved")} disabled={busy}
                    className="flex-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold py-2.5 flex items-center justify-center gap-2 disabled:opacity-30">
                    <CheckCheck size={12} /> Approve change
                </button>
                <button onClick={() => decide("declined")} disabled={busy}
                    className="flex-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold py-2.5 flex items-center justify-center gap-2 disabled:opacity-30">
                    <X size={12} /> Decline
                </button>
            </div>
        </div>
    );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-white/[0.05] border border-white/10 p-2">
            <p className="text-[9px] tracking-[0.2em] uppercase text-white/40">{label}</p>
            <p className="text-white text-xs font-semibold mt-0.5 break-words">{value}</p>
        </div>
    );
}
