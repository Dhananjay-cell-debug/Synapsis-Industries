"use client";

// ─── BUILD ADMIN VIEW (Phase 4) ─────────────────────────────────────────────
// Admin's surface for Phase 4: mid-payment status, sprint report composer,
// change-order composer, and the Submit Final Build gate (advances to P5).
//
// Three primary mutations:
//   1. PATCH phaseDataPatch.sprintReports — append new sprint report
//   2. PATCH phaseDataPatch.changeOrders — append new change order
//   3. POST  submitFinal — advance P4 → P5 (requires ≥1 sprint + mid-paid if large)
//
// Mid-payment manual override mirrors the IgnitionAdminView flow.

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, Hourglass, Plus, FileText, AlertCircle, Send, Receipt, GitBranch,
    Clock, IndianRupee, ArrowRight, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { CURRENCY_SYMBOL, paymentAmountFor, LARGE_PROJECT_THRESHOLD } from "@/lib/phases/constants";
import type { SprintReport, ChangeOrder } from "@/lib/phases/schema";

interface DealBare {
    token: string;
    name: string;
    company: string;
    phase: number;
    totalPrice?: number;
    payments?: { phase: number; status: string; amount: number; paidAt?: number; sessionId?: string }[];
    phaseData?: any;
}

interface Props {
    deal: DealBare;
    adminEmail: string;
    onUpdated: (deal: DealBare) => void;
}

export default function BuildAdminView({ deal, adminEmail, onUpdated }: Props) {
    const p4 = deal.phaseData?.phase4 || {};
    const sprintReports: SprintReport[] = p4.sprintReports || [];
    const changeOrders: ChangeOrder[] = p4.changeOrders || [];
    const stagingUrl: string = p4.stagingUrl || "";

    const isLarge = (deal.totalPrice || 0) >= LARGE_PROJECT_THRESHOLD;
    const midAmount = deal.totalPrice ? paymentAmountFor(deal.totalPrice, 4) : 0;
    const midPayment = (deal.payments || []).find(p => p.phase === 4);
    const midPaid = !!midPayment && midPayment.status === "paid";

    const canSubmitFinal = sprintReports.length > 0 && (!isLarge || midPaid);
    const finalBlockReason = sprintReports.length === 0
        ? "Post at least one sprint report before submitting final"
        : (isLarge && !midPaid ? `Project ≥ ${CURRENCY_SYMBOL}${(LARGE_PROJECT_THRESHOLD / 1000)}k — mid-payment required first` : null);

    const refresh = async () => {
        const res = await fetch(`/api/deals?token=${deal.token}`);
        if (res.ok) onUpdated(await res.json());
    };

    return (
        <div className="max-w-3xl mx-auto py-2 px-2">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#11B8EA] font-bold mb-2">BUILD · Phase 4</p>
                <h1 className="font-serif text-3xl text-white tracking-tight">{deal.name} · {deal.company}</h1>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                    Post weekly sprint reports, manage change orders, capture mid-payment, then submit the final build to advance to delivery.
                </p>
            </motion.div>

            {/* Status Strip */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                <StatBox label="Sprints posted" value={sprintReports.length} accent="#11B8EA" />
                <StatBox label="Change orders" value={changeOrders.length} accent="#3B6AE8" />
                <StatBox label="Mid payment" value={midPaid ? "Paid" : isLarge ? "Pending" : "N/A"} accent={midPaid ? "#10B981" : isLarge ? "#F59E0B" : "#94A3B8"} />
            </div>

            {/* SPRINT REPORTS */}
            <Section title="Sprint Reports" icon={<FileText size={14} />}>
                {sprintReports.length === 0 ? (
                    <EmptyState text="No sprint reports yet. Post your first one below." />
                ) : (
                    <div className="space-y-3 mb-4">
                        {sprintReports.map((sr, i) => (
                            <SprintReportCard key={sr.id} report={sr} index={i + 1} />
                        ))}
                    </div>
                )}
                <SprintReportComposer
                    token={deal.token}
                    adminEmail={adminEmail}
                    existingReports={sprintReports}
                    currentStaging={stagingUrl}
                    onPosted={onUpdated}
                />
            </Section>

            {/* CHANGE ORDERS */}
            <Section title="Change Orders" icon={<GitBranch size={14} />}>
                {changeOrders.length === 0 ? (
                    <EmptyState text="No change orders. Create one if scope shifts mid-build." />
                ) : (
                    <div className="space-y-3 mb-4">
                        {changeOrders.map(co => (
                            <ChangeOrderCard key={co.id} co={co} />
                        ))}
                    </div>
                )}
                <ChangeOrderComposer
                    token={deal.token}
                    adminEmail={adminEmail}
                    existingOrders={changeOrders}
                    onCreated={onUpdated}
                />
            </Section>

            {/* MID PAYMENT */}
            {isLarge && (
                <Section title={`Mid Payment · ${CURRENCY_SYMBOL}${midAmount.toLocaleString("en-IN")}`} icon={<Receipt size={14} />}>
                    {midPaid ? (
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3">
                            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                            <div>
                                <p className="text-emerald-300 text-sm font-semibold">
                                    Mid-payment received — {CURRENCY_SYMBOL}{midPayment?.amount.toLocaleString("en-IN")}
                                </p>
                                {midPayment?.paidAt && (
                                    <p className="text-white/50 text-xs mt-0.5">
                                        Paid {new Date(midPayment.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <MidPaymentPending
                            deal={deal}
                            midAmount={midAmount}
                            adminEmail={adminEmail}
                            onUpdated={onUpdated}
                        />
                    )}
                </Section>
            )}

            {/* SUBMIT FINAL */}
            <Section title="Submit Final Build" icon={<Send size={14} />}>
                <SubmitFinalGate
                    token={deal.token}
                    canSubmit={canSubmitFinal}
                    blockReason={finalBlockReason}
                    currentStaging={stagingUrl}
                    onSubmitted={onUpdated}
                />
            </Section>

            {/* Refresh */}
            <button onClick={refresh} className="mt-6 text-xs text-white/40 hover:text-white/70 underline">
                Refresh state
            </button>
        </div>
    );
}

// ─── Section + helpers ──────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#11B8EA]">
                    {icon}
                </div>
                <h2 className="text-white text-sm font-semibold tracking-tight">{title}</h2>
            </div>
            <div>{children}</div>
        </div>
    );
}

function StatBox({ label, value, accent }: { label: string; value: number | string; accent: string }) {
    return (
        <div className="rounded-xl border bg-white/[0.02] p-3" style={{ borderColor: `${accent}30` }}>
            <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1">{label}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: accent }}>{value}</p>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-6 flex items-center gap-3 text-white/40">
            <AlertCircle size={14} />
            <span className="text-xs">{text}</span>
        </div>
    );
}

// ─── Sprint Report Card (display) ───────────────────────────────────────────

function SprintReportCard({ report, index }: { report: SprintReport; index: number }) {
    const [open, setOpen] = useState(false);
    const responded = !!report.clientResponse;
    const needsResponse = (report.needFromClient?.length || 0) > 0;
    const overdue = !responded && needsResponse && !!report.responseDeadline && Date.now() > report.responseDeadline;
    const borderColor = overdue ? "border-red-500/40" : "border-white/10";
    return (
        <div className={`rounded-xl border ${borderColor} bg-white/[0.02] overflow-hidden`}>
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#11B8EA]/10 border border-[#11B8EA]/30 flex items-center justify-center text-[#11B8EA] text-xs font-bold shrink-0">
                        {index}
                    </div>
                    <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white text-sm font-medium truncate">
                                Sprint #{index} · Week of {new Date(report.weekOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                            {overdue && (
                                <span className="text-[8px] tracking-[0.3em] uppercase font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/40">
                                    Overdue
                                </span>
                            )}
                        </div>
                        <p className="text-white/40 text-xs">
                            {report.progressPct}% progress · {responded ? "Client responded" : overdue ? "Response overdue" : "Awaiting response"}
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/10 overflow-hidden">
                        <div className="p-4 space-y-3 text-xs">
                            <ReportSection label="Done" items={report.done} />
                            <ReportSection label="Next" items={report.next} />
                            <ReportSection label="Need from client" items={report.needFromClient} />
                            {report.stagingUrl && (
                                <div>
                                    <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1">Staging</p>
                                    <a href={report.stagingUrl} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[#11B8EA] hover:text-[#11B8EA]/80 underline">
                                        {report.stagingUrl} <ExternalLink size={10} />
                                    </a>
                                </div>
                            )}
                            {responded && (
                                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 mt-3">
                                    <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-400 mb-1">Client response</p>
                                    <p className="text-white/75 leading-relaxed whitespace-pre-wrap">{report.clientResponse}</p>
                                    {report.clientRespondedAt && (
                                        <p className="text-white/40 text-[10px] mt-1">
                                            {new Date(report.clientRespondedAt).toLocaleString("en-IN")}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ReportSection({ label, items }: { label: string; items: string[] }) {
    if (!items || items.length === 0) return null;
    return (
        <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1.5">{label}</p>
            <ul className="space-y-1">
                {items.map((it, i) => (
                    <li key={i} className="text-white/75 leading-relaxed flex items-start gap-2">
                        <span className="text-[#11B8EA]/60 mt-0.5">•</span>
                        <span>{it}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Sprint Report Composer ─────────────────────────────────────────────────

function SprintReportComposer({ token, adminEmail, existingReports, currentStaging, onPosted }: {
    token: string; adminEmail: string; existingReports: SprintReport[]; currentStaging: string;
    onPosted: (deal: DealBare) => void;
}) {
    const [open, setOpen] = useState(false);
    const [done, setDone] = useState("");
    const [next, setNext] = useState("");
    const [needs, setNeeds] = useState("");
    const [progress, setProgress] = useState(20);
    const [staging, setStaging] = useState(currentStaging);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        const doneItems = done.split("\n").map(s => s.trim()).filter(Boolean);
        const nextItems = next.split("\n").map(s => s.trim()).filter(Boolean);
        const needsItems = needs.split("\n").map(s => s.trim()).filter(Boolean);

        if (doneItems.length === 0) {
            setError("At least one 'Done' item required.");
            return;
        }

        setBusy(true); setError(null);
        try {
            const newReport: SprintReport = {
                id: `sr_${Date.now()}`,
                weekOf: Date.now(),
                postedAt: Date.now(),
                done: doneItems,
                next: nextItems,
                needFromClient: needsItems,
                responseDeadline: Date.now() + 48 * 3600 * 1000,
                progressPct: progress,
                stagingUrl: staging.trim() || undefined,
            };
            const updatedReports = [...existingReports, newReport];

            const res = await fetch(`/api/deals/${token}/phase/4`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { sprintReports: updatedReports, stagingUrl: staging.trim() || undefined },
                    auditAction: "sprint.posted",
                    note: `Sprint #${updatedReports.length} posted by ${adminEmail}`,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Post failed");
            const data = await res.json();
            onPosted(data.deal);
            setDone(""); setNext(""); setNeeds(""); setProgress(20);
            setOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Post failed");
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="w-full rounded-xl border border-dashed border-[#11B8EA]/30 bg-[#11B8EA]/[0.03] hover:bg-[#11B8EA]/[0.06] text-[#11B8EA] text-xs font-medium py-3 flex items-center justify-center gap-2 transition-colors">
                <Plus size={14} /> Post new sprint report
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-[#11B8EA]/30 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#11B8EA] font-bold">New Sprint Report</p>

            <Field label="What's done this sprint (one per line)">
                <textarea value={done} onChange={e => setDone(e.target.value)} rows={4}
                    placeholder="Setup auth flow&#10;Built dashboard skeleton&#10;Wired up payment gate"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-y" />
            </Field>

            <Field label="What's next (one per line)">
                <textarea value={next} onChange={e => setNext(e.target.value)} rows={3}
                    placeholder="Build invoice generator&#10;Add Razorpay webhook"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-y" />
            </Field>

            <Field label="Need from client (one per line, optional)">
                <textarea value={needs} onChange={e => setNeeds(e.target.value)} rows={2}
                    placeholder="Final logo SVG&#10;Brand voice notes"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-y" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label={`Progress: ${progress}%`}>
                    <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(Number(e.target.value))}
                        className="w-full accent-[#11B8EA]" />
                </Field>
                <Field label="Staging URL (optional)">
                    <input value={staging} onChange={e => setStaging(e.target.value)} placeholder="https://staging…"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
                </Field>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2">
                <button onClick={submit} disabled={busy}
                    className="flex-1 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold py-2.5 disabled:opacity-30">
                    {busy ? "Posting…" : "Post sprint report"}
                </button>
                <button onClick={() => setOpen(false)} disabled={busy}
                    className="px-4 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/5">
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── Change Order Card (display) ────────────────────────────────────────────

function ChangeOrderCard({ co }: { co: ChangeOrder }) {
    const [open, setOpen] = useState(false);
    const accent = co.status === "approved" ? "#10B981" : co.status === "declined" ? "#EF4444" : "#F59E0B";
    return (
        <div className="rounded-xl border bg-white/[0.02]" style={{ borderColor: `${accent}30` }}>
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0 text-left">
                    <span className="text-[9px] tracking-[0.3em] uppercase font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>
                        {co.status}
                    </span>
                    <p className="text-white text-sm font-medium truncate">{co.title}</p>
                </div>
                {open ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t overflow-hidden" style={{ borderColor: `${accent}30` }}>
                        <div className="p-4 space-y-3 text-xs">
                            <p className="text-white/75 whitespace-pre-wrap leading-relaxed">{co.description}</p>
                            <div className="grid grid-cols-3 gap-2">
                                <Stat label="Scope" value={co.scopeImpact} />
                                <Stat label="Timeline" value={`+${co.timelineImpactDays}d`} />
                                <Stat label="Cost" value={`${CURRENCY_SYMBOL}${co.costImpact.toLocaleString("en-IN")}`} />
                            </div>
                            {co.clientNote && (
                                <div className="rounded-lg bg-white/[0.03] p-2.5">
                                    <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1">Client note</p>
                                    <p className="text-white/70">{co.clientNote}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2">
            <p className="text-[9px] tracking-[0.2em] uppercase text-white/40">{label}</p>
            <p className="text-white/85 text-xs font-semibold mt-0.5 break-words">{value}</p>
        </div>
    );
}

// ─── Change Order Composer ──────────────────────────────────────────────────

function ChangeOrderComposer({ token, adminEmail, existingOrders, onCreated }: {
    token: string; adminEmail: string; existingOrders: ChangeOrder[];
    onCreated: (deal: DealBare) => void;
}) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [scopeImpact, setScopeImpact] = useState("");
    const [timelineImpactDays, setTimelineImpactDays] = useState(0);
    const [costImpact, setCostImpact] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!title.trim() || !description.trim() || !scopeImpact.trim()) {
            setError("Title, description, and scope impact are required.");
            return;
        }
        setBusy(true); setError(null);
        try {
            const newCO: ChangeOrder = {
                id: `co_${Date.now()}`,
                createdAt: Date.now(),
                title: title.trim(),
                description: description.trim(),
                scopeImpact: scopeImpact.trim(),
                timelineImpactDays,
                costImpact,
                status: "pending",
            };
            const updatedOrders = [...existingOrders, newCO];

            const res = await fetch(`/api/deals/${token}/phase/4`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { changeOrders: updatedOrders },
                    auditAction: "changeOrder.created",
                    note: `Change order "${title.trim()}" by ${adminEmail}`,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Create failed");
            const data = await res.json();
            onCreated(data.deal);
            setTitle(""); setDescription(""); setScopeImpact(""); setTimelineImpactDays(0); setCostImpact(0);
            setOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Create failed");
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="w-full rounded-xl border border-dashed border-[#3B6AE8]/30 bg-[#3B6AE8]/[0.03] hover:bg-[#3B6AE8]/[0.06] text-[#3B6AE8] text-xs font-medium py-3 flex items-center justify-center gap-2 transition-colors">
                <Plus size={14} /> Create change order
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-[#3B6AE8]/30 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#3B6AE8] font-bold">New Change Order</p>

            <Field label="Title">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Add multi-language support"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3B6AE8]/40" />
            </Field>

            <Field label="Description">
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                    placeholder="Why this is needed and what it involves"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3B6AE8]/40 resize-y" />
            </Field>

            <Field label="Scope impact (what changes)">
                <input value={scopeImpact} onChange={e => setScopeImpact(e.target.value)} placeholder="Adds 4 new pages + locale switcher"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3B6AE8]/40" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Timeline impact (days)">
                    <input type="number" value={timelineImpactDays} onChange={e => setTimelineImpactDays(Number(e.target.value) || 0)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3B6AE8]/40" />
                </Field>
                <Field label={`Cost impact (${CURRENCY_SYMBOL})`}>
                    <input type="number" value={costImpact} onChange={e => setCostImpact(Number(e.target.value) || 0)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3B6AE8]/40" />
                </Field>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2">
                <button onClick={submit} disabled={busy}
                    className="flex-1 rounded-lg bg-[#3B6AE8]/15 border border-[#3B6AE8]/30 text-[#3B6AE8] text-xs font-semibold py-2.5 disabled:opacity-30">
                    {busy ? "Creating…" : "Send change order to client"}
                </button>
                <button onClick={() => setOpen(false)} disabled={busy}
                    className="px-4 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/5">
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── Mid-Payment Pending (manual override) ──────────────────────────────────

function MidPaymentPending({ deal, midAmount, adminEmail, onUpdated }: {
    deal: DealBare; midAmount: number; adminEmail: string;
    onUpdated: (deal: DealBare) => void;
}) {
    const [showManual, setShowManual] = useState(false);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const markManual = async () => {
        if (note.trim().length < 10) {
            setError("Note must be at least 10 characters.");
            return;
        }
        setBusy(true); setError(null);
        try {
            // 1. Patch phase 4 with manual paid timestamp
            const res = await fetch(`/api/deals/${deal.token}/phase/4`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { midPaymentPaidAt: Date.now(), midPaymentAmount: midAmount, manualMidPaymentNote: note.trim() },
                    auditAction: "payment.captured.mid.manual",
                    note: note.trim(),
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Patch failed");

            // 2. Flip payment row in deal-level payments to paid
            const updatedPayments = (deal.payments || []).map(p =>
                p.phase === 4 ? { ...p, status: "paid", paidAt: Date.now() } : p
            );
            const dealRes = await fetch("/api/deals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: deal.token, payments: updatedPayments }),
            });
            if (dealRes.ok) {
                const updated = await dealRes.json();
                onUpdated(updated);
            } else {
                const data = await res.json();
                onUpdated(data.deal);
            }
            setShowManual(false);
            setNote("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Override failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-center gap-3 mb-3">
                <Hourglass size={18} className="text-amber-400 shrink-0" />
                <div>
                    <p className="text-white text-sm font-semibold">
                        Awaiting mid-payment of {CURRENCY_SYMBOL}{midAmount.toLocaleString("en-IN")}
                    </p>
                    <p className="text-white/50 text-xs mt-0.5">
                        Client pays via the Razorpay gate on their portal. Submit Final stays locked until this lands.
                    </p>
                </div>
            </div>
            {!showManual ? (
                <button onClick={() => setShowManual(true)} className="text-xs text-white/50 hover:text-white/80 underline">
                    Mark as paid manually (offline)
                </button>
            ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] tracking-[0.3em] uppercase text-amber-400 mb-2 font-bold">Manual Override</p>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                        placeholder="Reason / reference (≥10 chars). Required for audit."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400/40 resize-y mb-2" />
                    {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                    <div className="flex gap-2">
                        <button onClick={markManual} disabled={busy}
                            className="flex-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold py-2 disabled:opacity-30">
                            {busy ? "Marking…" : "Mark mid-payment as paid"}
                        </button>
                        <button onClick={() => setShowManual(false)} disabled={busy}
                            className="px-3 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/5">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Submit Final Build Gate ────────────────────────────────────────────────

function SubmitFinalGate({ token, canSubmit, blockReason, currentStaging, onSubmitted }: {
    token: string; canSubmit: boolean; blockReason: string | null; currentStaging: string;
    onSubmitted: (deal: DealBare) => void;
}) {
    const [stagingUrl, setStagingUrl] = useState(currentStaging);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);

    const submit = async () => {
        if (!stagingUrl.trim()) {
            setError("Staging URL required.");
            return;
        }
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/deals/${token}/phase/4`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "submitFinal", ctx: { stagingUrl: stagingUrl.trim() } }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Submit failed");
            const data = await res.json();
            onSubmitted(data.deal);
            setConfirming(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Submit failed");
        } finally {
            setBusy(false);
        }
    };

    if (!canSubmit) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/10 p-4 flex items-center gap-3 text-white/50">
                <AlertCircle size={16} className="shrink-0" />
                <span className="text-sm">{blockReason || "Not ready"}</span>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <p className="text-emerald-300 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} /> Ready to submit final build
            </p>
            <Field label="Final staging / build URL">
                <input value={stagingUrl} onChange={e => setStagingUrl(e.target.value)} placeholder="https://staging.client.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/40" />
            </Field>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {!confirming ? (
                <button onClick={() => setConfirming(true)} disabled={!stagingUrl.trim()}
                    className="w-full rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold py-2.5 disabled:opacity-30 flex items-center justify-center gap-2">
                    Submit final → Advance to Phase 5 <ArrowRight size={12} />
                </button>
            ) : (
                <div className="space-y-2">
                    <p className="text-amber-300 text-xs">Confirm: This advances the deal to Phase 5 (Deliver). Client will see the build for review.</p>
                    <div className="flex gap-2">
                        <button onClick={submit} disabled={busy}
                            className="flex-1 rounded-lg bg-emerald-500/25 border border-emerald-500/50 text-emerald-200 text-xs font-bold py-2.5 disabled:opacity-30">
                            {busy ? "Submitting…" : "Yes, advance to Phase 5"}
                        </button>
                        <button onClick={() => setConfirming(false)} disabled={busy}
                            className="px-4 rounded-lg border border-white/10 text-white/50 text-xs hover:bg-white/5">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Field wrapper ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-[9px] tracking-[0.3em] uppercase text-white/50 block mb-1.5 font-semibold">{label}</span>
            {children}
        </label>
    );
}
