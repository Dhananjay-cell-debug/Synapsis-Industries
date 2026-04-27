"use client";

// ─── DELIVER ADMIN VIEW (Phase 5) ───────────────────────────────────────────
// Admin's surface for the review/revision phase:
//   - See review period countdown (5 business days from finalSubmittedAt)
//   - See deliverable history (each revision spawns a new version)
//   - When a revision lands, admin uploads a new deliverable (PATCH adds version)
//   - Mark revision rounds as resolved
//
// Client owns: submitting revisions + final approval (advances to P6).

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, Clock, AlertCircle, ExternalLink, ChevronDown, ChevronUp,
    Upload, FileCheck2, Hourglass, RefreshCw, Plus,
} from "lucide-react";
import { FREE_REVISION_ROUNDS, REVIEW_PERIOD_BUSINESS_DAYS } from "@/lib/phases/constants";
import { CURRENCY_SYMBOL } from "@/lib/phases/constants";
import type { Deliverable, RevisionRound, ChangeOrder } from "@/lib/phases/schema";

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
    adminEmail: string;
    onUpdated: (deal: DealBare) => void;
}

export default function DeliverAdminView({ deal, adminEmail, onUpdated }: Props) {
    const p5 = deal.phaseData?.phase5 || {};
    const deliverables: Deliverable[] = p5.deliverables || [];
    const rounds: RevisionRound[] = p5.revisionRounds || [];
    const reviewStart: number | undefined = p5.reviewPeriodStartedAt;
    const reviewDeadline: number | undefined = p5.reviewDeadline;
    const finalApprovedAt: number | undefined = p5.finalApprovedAt;

    const latestVersion = deliverables.length > 0 ? Math.max(...deliverables.map(d => d.version)) : 0;
    const currentDeliverable = deliverables.find(d => d.version === latestVersion);

    const pendingRounds = rounds.filter(r => !r.resolvedAt);
    const freeUsed = rounds.filter(r => r.isFree).length;
    const freeRemaining = Math.max(0, FREE_REVISION_ROUNDS - freeUsed);

    const refresh = async () => {
        const res = await fetch(`/api/deals?token=${deal.token}`);
        if (res.ok) onUpdated(await res.json());
    };

    return (
        <div className="max-w-3xl mx-auto py-2 px-2">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#11B8EA] font-bold mb-2">DELIVER · Phase 5</p>
                <h1 className="font-serif text-3xl text-white tracking-tight">{deal.name} · {deal.company}</h1>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                    Client is reviewing the build. Manage revisions, upload new versions, and wait for final approval to advance to handover.
                </p>
            </motion.div>

            {/* Status strip */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                <StatBox label="Versions" value={latestVersion} accent="#11B8EA" />
                <StatBox label="Revisions" value={`${rounds.length} (${freeRemaining} free left)`} accent="#3B6AE8" />
                <StatBox
                    label="Status"
                    value={finalApprovedAt ? "Approved" : pendingRounds.length > 0 ? "In revision" : "Awaiting client"}
                    accent={finalApprovedAt ? "#10B981" : pendingRounds.length > 0 ? "#F59E0B" : "#94A3B8"}
                />
            </div>

            {/* Review window */}
            {reviewDeadline && !finalApprovedAt && (
                <ReviewWindow start={reviewStart!} deadline={reviewDeadline} />
            )}

            {/* Final approved banner */}
            {finalApprovedAt && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 mb-6 flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    <div>
                        <p className="text-emerald-300 text-sm font-semibold">Final approved by client</p>
                        <p className="text-white/50 text-xs mt-0.5">
                            Approved {new Date(finalApprovedAt).toLocaleString("en-IN")}. Now in Phase 6 — Handover.
                        </p>
                    </div>
                </div>
            )}

            {/* Current deliverable */}
            {currentDeliverable && (
                <Section title="Current build" icon={<FileCheck2 size={14} />}>
                    <div className="rounded-xl border border-[#11B8EA]/30 bg-[#11B8EA]/[0.04] p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-[9px] tracking-[0.3em] uppercase text-[#11B8EA] font-bold mb-1">v{currentDeliverable.version} · latest</p>
                            <p className="text-white text-sm font-mono truncate">{currentDeliverable.url}</p>
                            <p className="text-white/40 text-xs mt-0.5">{currentDeliverable.description}</p>
                        </div>
                        <a href={currentDeliverable.url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold">
                            Open <ExternalLink size={11} />
                        </a>
                    </div>
                </Section>
            )}

            {/* Revision rounds */}
            <Section title="Revision rounds" icon={<Clock size={14} />}>
                {rounds.length === 0 ? (
                    <EmptyState text="No revisions yet. Client is still reviewing." />
                ) : (
                    <div className="space-y-3">
                        {[...rounds].reverse().map(r => (
                            <RevisionRoundCard
                                key={r.id}
                                round={r}
                                deal={deal}
                                token={deal.token}
                                allRounds={rounds}
                                allDeliverables={deliverables}
                                adminEmail={adminEmail}
                                onUpdated={onUpdated}
                            />
                        ))}
                    </div>
                )}
            </Section>

            {/* Deliverable history */}
            {deliverables.length > 1 && (
                <Section title="Version history" icon={<FileCheck2 size={14} />}>
                    <div className="space-y-2">
                        {[...deliverables].reverse().map(d => (
                            <div key={d.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-white text-xs font-semibold">v{d.version} · {d.description}</p>
                                    <p className="text-white/40 text-[10px] mt-0.5">
                                        Uploaded {new Date(d.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    </p>
                                </div>
                                <a href={d.url} target="_blank" rel="noopener noreferrer"
                                    className="text-[#11B8EA] hover:text-[#11B8EA]/80 text-xs underline truncate max-w-[180px]">
                                    Open
                                </a>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            <button onClick={refresh} className="mt-6 text-xs text-white/40 hover:text-white/70 underline">
                Refresh state
            </button>
        </div>
    );
}

// ─── Review window countdown ────────────────────────────────────────────────

function ReviewWindow({ start, deadline }: { start: number; deadline: number }) {
    const now = Date.now();
    const total = deadline - start;
    const elapsed = Math.min(now - start, total);
    const remainingMs = Math.max(0, deadline - now);
    const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0;
    const days = Math.floor(remainingMs / (24 * 3600 * 1000));
    const hours = Math.floor((remainingMs % (24 * 3600 * 1000)) / (3600 * 1000));
    const overdue = remainingMs <= 0;

    return (
        <div className="rounded-xl border bg-white/[0.02] p-4 mb-6"
            style={{ borderColor: overdue ? "rgba(239,68,68,0.3)" : "rgba(17,184,234,0.25)" }}>
            <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] tracking-[0.3em] uppercase font-bold"
                    style={{ color: overdue ? "#EF4444" : "#11B8EA" }}>
                    Review window · {REVIEW_PERIOD_BUSINESS_DAYS} business days
                </p>
                <p className="text-white text-xs font-mono">
                    {overdue ? "Overdue" : days > 0 ? `${days}d ${hours}h left` : `${hours}h left`}
                </p>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full" style={{ width: `${pct}%`, background: overdue ? "#EF4444" : "#11B8EA" }} />
            </div>
        </div>
    );
}

// ─── Revision round card ────────────────────────────────────────────────────

function RevisionRoundCard({ round, deal, token, allRounds, allDeliverables, adminEmail, onUpdated }: {
    round: RevisionRound; deal: DealBare; token: string; allRounds: RevisionRound[]; allDeliverables: Deliverable[];
    adminEmail: string; onUpdated: (deal: DealBare) => void;
}) {
    const [open, setOpen] = useState(!round.resolvedAt);
    const [showUpload, setShowUpload] = useState(false);
    const [url, setUrl] = useState("");
    const [desc, setDesc] = useState(`Revision v${(allDeliverables[allDeliverables.length - 1]?.version || 1) + 1}`);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // ── CO composer state (for paid rounds without a linked CO yet) ─────────
    const [showCO, setShowCO] = useState(false);
    const [coTitle, setCoTitle] = useState(`Revision round ${round.roundNumber} — paid scope`);
    const [coDesc, setCoDesc] = useState("");
    const [coScope, setCoScope] = useState("");
    const [coDays, setCoDays] = useState<number>(0);
    const [coCost, setCoCost] = useState<number>(0);
    const [coBusy, setCoBusy] = useState(false);
    const [coError, setCoError] = useState<string | null>(null);

    const existingCOs: ChangeOrder[] = deal.phaseData?.phase4?.changeOrders || [];
    const linkedCO = round.linkedChangeOrderId
        ? existingCOs.find(c => c.id === round.linkedChangeOrderId)
        : undefined;
    const needsCO = !round.isFree && !round.linkedChangeOrderId && !round.resolvedAt;

    const resolved = !!round.resolvedAt;
    const accent = resolved ? "#10B981" : round.isFree ? "#F59E0B" : "#EF4444";

    const linkChangeOrder = async () => {
        if (!coDesc.trim() || coDesc.trim().length < 10) {
            setCoError("Description must be ≥10 chars.");
            return;
        }
        if (coCost <= 0) {
            setCoError("Cost impact must be > 0 for a paid round.");
            return;
        }
        setCoBusy(true); setCoError(null);
        try {
            const newCO: ChangeOrder = {
                id: `co_${Date.now()}`,
                createdAt: Date.now(),
                title: coTitle.trim() || `Revision round ${round.roundNumber}`,
                description: coDesc.trim(),
                scopeImpact: coScope.trim() || "Additional revision beyond included rounds",
                timelineImpactDays: Math.max(0, Number(coDays) || 0),
                costImpact: Math.max(0, Number(coCost) || 0),
                status: "approved",
                decidedAt: Date.now(),
                clientNote: `Auto-linked to revision round ${round.roundNumber}`,
            };
            const updatedCOs = [...existingCOs, newCO];
            const updatedRounds = allRounds.map(r =>
                r.id === round.id ? { ...r, linkedChangeOrderId: newCO.id } : r
            );

            // Single atomic PATCH via /api/deals to update both phase4 and phase5
            const mergedPhaseData = {
                ...(deal.phaseData || {}),
                phase4: { ...(deal.phaseData?.phase4 || {}), changeOrders: updatedCOs },
                phase5: { ...(deal.phaseData?.phase5 || {}), revisionRounds: updatedRounds },
            };
            const res = await fetch(`/api/deals`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, phaseData: mergedPhaseData }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Save failed");
            const data = await res.json();
            onUpdated(data);
            setShowCO(false);
        } catch (e) {
            setCoError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setCoBusy(false);
        }
    };

    const handleFile = async (file: File) => {
        setUploading(true); setError(null);
        try {
            const form = new FormData();
            form.append("file", file);
            const upRes = await fetch("/api/upload", { method: "POST", body: form });
            if (!upRes.ok) throw new Error((await upRes.json()).error || "Upload failed");
            const { url: uploaded } = await upRes.json();
            setUrl(uploaded);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const submitNewVersion = async () => {
        if (!url.trim()) {
            setError("Build URL or uploaded file required.");
            return;
        }
        setBusy(true); setError(null);
        try {
            const nextVersion = (allDeliverables[allDeliverables.length - 1]?.version || 0) + 1;
            const newDeliverable: Deliverable = {
                id: `dlv_${Date.now()}`,
                version: nextVersion,
                uploadedAt: Date.now(),
                url: url.trim(),
                description: desc.trim() || `Revision v${nextVersion}`,
            };
            const updatedDeliverables = [...allDeliverables, newDeliverable];
            const updatedRounds = allRounds.map(r =>
                r.id === round.id ? { ...r, resolvedAt: Date.now() } : r
            );

            const newReviewStart = Date.now();
            const newReviewDeadline = newReviewStart + (REVIEW_PERIOD_BUSINESS_DAYS * 24 * 3600 * 1000);
            const res = await fetch(`/api/deals/${token}/phase/5`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: {
                        deliverables: updatedDeliverables,
                        revisionRounds: updatedRounds,
                        reviewPeriodStartedAt: newReviewStart,
                        reviewDeadline: newReviewDeadline,
                    },
                    auditAction: `revision.round${round.roundNumber}.resolved`,
                    note: `New v${nextVersion} uploaded by ${adminEmail}; review window reset`,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Save failed");
            const data = await res.json();
            onUpdated(data.deal);
            setShowUpload(false);
            setUrl("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl border bg-white/[0.02]" style={{ borderColor: `${accent}40` }}>
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0 text-left">
                    <span className="text-[9px] tracking-[0.3em] uppercase font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>
                        Round {round.roundNumber} · {round.isFree ? "Free" : "Paid"}
                    </span>
                    <p className="text-white text-sm font-medium truncate">
                        {resolved ? `Resolved ${new Date(round.resolvedAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Pending response"}
                    </p>
                </div>
                {open ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t overflow-hidden" style={{ borderColor: `${accent}30` }}>
                        <div className="p-4 space-y-3 text-xs">
                            <div>
                                <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1.5 font-bold">Client feedback</p>
                                <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{round.feedback}</p>
                                <p className="text-white/40 text-[10px] mt-1">
                                    Submitted {new Date(round.submittedAt).toLocaleString("en-IN")}
                                </p>
                            </div>
                            {/* CO link status / composer for paid rounds */}
                            {linkedCO && (
                                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] p-3 text-[11px] text-emerald-200/90">
                                    <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-300 mb-1 font-bold">Linked change order</p>
                                    <p className="text-white/85 font-medium">{linkedCO.title}</p>
                                    <p className="text-white/55 mt-0.5">
                                        +{linkedCO.timelineImpactDays}d · {CURRENCY_SYMBOL}{linkedCO.costImpact.toLocaleString("en-IN")} · {linkedCO.status}
                                    </p>
                                </div>
                            )}
                            {needsCO && (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3">
                                    {!showCO ? (
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-[11px] text-amber-200/90">
                                                <p className="font-semibold mb-0.5">Paid round — no change order linked</p>
                                                <p className="text-white/50">Link a change order so scope, cost, and timeline are formally captured before you ship the new version.</p>
                                            </div>
                                            <button onClick={() => setShowCO(true)}
                                                className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-200 text-[11px] font-semibold px-3 py-1.5">
                                                Link CO
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-[9px] tracking-[0.3em] uppercase text-amber-300 font-bold">New change order</p>
                                            <input value={coTitle} onChange={e => setCoTitle(e.target.value)} placeholder="Title"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40" />
                                            <textarea value={coDesc} onChange={e => setCoDesc(e.target.value)} placeholder="Description (≥10 chars) — what's the new ask?"
                                                rows={2}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40 resize-none" />
                                            <input value={coScope} onChange={e => setCoScope(e.target.value)} placeholder="Scope impact (what changes)"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40" />
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[9px] tracking-[0.2em] uppercase text-white/40 font-bold">Timeline +days</label>
                                                    <input type="number" min={0} value={coDays}
                                                        onChange={e => setCoDays(Number(e.target.value))}
                                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] tracking-[0.2em] uppercase text-white/40 font-bold">Cost ({CURRENCY_SYMBOL})</label>
                                                    <input type="number" min={0} value={coCost}
                                                        onChange={e => setCoCost(Number(e.target.value))}
                                                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40" />
                                                </div>
                                            </div>
                                            {coError && <p className="text-red-400 text-xs">{coError}</p>}
                                            <div className="flex gap-2 pt-1">
                                                <button onClick={linkChangeOrder} disabled={coBusy}
                                                    className="flex-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold py-2 disabled:opacity-30">
                                                    {coBusy ? "Linking…" : "Create & link CO"}
                                                </button>
                                                <button onClick={() => { setShowCO(false); setCoError(null); }} disabled={coBusy}
                                                    className="px-3 rounded-lg border border-white/10 text-white/50 text-xs">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!resolved && (
                                <div className="pt-2">
                                    {!showUpload ? (
                                        <button onClick={() => setShowUpload(true)}
                                            disabled={needsCO && !round.linkedChangeOrderId}
                                            title={needsCO ? "Link a change order first" : ""}
                                            className="w-full rounded-lg border border-dashed border-[#11B8EA]/30 bg-[#11B8EA]/[0.03] hover:bg-[#11B8EA]/[0.06] text-[#11B8EA] text-xs font-medium py-2.5 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
                                            <Plus size={12} /> Upload new version & resolve
                                        </button>
                                    ) : (
                                        <div className="rounded-lg border border-[#11B8EA]/30 bg-[#11B8EA]/[0.04] p-3 space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <label className="flex-1 cursor-pointer">
                                                    <div className="rounded-lg border border-dashed border-white/15 hover:border-[#11B8EA]/50 px-3 py-2 flex items-center gap-2 text-xs text-white/60">
                                                        <Upload size={12} />
                                                        <span>{uploading ? "Uploading…" : "Upload file"}</span>
                                                    </div>
                                                    <input type="file" className="hidden"
                                                        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                                                        disabled={uploading} />
                                                </label>
                                                <span className="text-white/25 text-[10px]">or paste URL</span>
                                                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://staging…"
                                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
                                            </div>
                                            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description for this version"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
                                            {error && <p className="text-red-400 text-xs">{error}</p>}
                                            <div className="flex gap-2">
                                                <button onClick={submitNewVersion} disabled={busy || !url.trim()}
                                                    className="flex-1 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold py-2 disabled:opacity-30">
                                                    {busy ? "Saving…" : "Resolve & post new version"}
                                                </button>
                                                <button onClick={() => setShowUpload(false)} disabled={busy}
                                                    className="px-3 rounded-lg border border-white/10 text-white/50 text-xs">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
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

// ─── Helpers ────────────────────────────────────────────────────────────────

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
            <p className="text-base font-bold tabular-nums truncate" style={{ color: accent }}>{value}</p>
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
