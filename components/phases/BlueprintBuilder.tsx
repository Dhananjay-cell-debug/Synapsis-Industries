"use client";

// ─── BLUEPRINT BUILDER — Phase 2 admin form ─────────────────────────────────
// Composes a Blueprint object section by section. Save Draft → PATCH (phase data
// patch with auditAction). Send to Client → POST action=sendBlueprint which
// versions the blueprint and locks it for client review.
//
// Used inside admin's Client Workspace when deal.phase === 2.

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    Plus, Trash2, Save, Send, Eye, Sparkles, X,
    FileText, Layers, Code2, Calendar, IndianRupee, ListChecks,
} from "lucide-react";
import {
    DEFAULT_BLUEPRINT_PAYMENT_STRUCTURE,
    BLUEPRINT_CHANGE_ROUNDS_MAX,
    LARGE_PROJECT_THRESHOLD,
    CURRENCY_SYMBOL,
} from "@/lib/phases/constants";
import type {
    Blueprint, BlueprintInvestmentLine, BlueprintTimelineSprint,
    BlueprintTechLine, BlueprintPaymentRow,
} from "@/lib/phases/schema";

interface DealBare {
    token: string;
    name: string;
    company: string;
    phase: number;
    phaseData?: { phase2?: { blueprint?: Blueprint; changeRequestCount?: number } };
}

interface Props {
    deal: DealBare;
    adminEmail: string;
    onSaved: (updatedDeal: DealBare) => void;
    onPreview?: () => void;
}

// Empty/default blueprint shape — used when no existing draft
function emptyBlueprint(): Omit<Blueprint, "version" | "status" | "sentAt"> {
    return {
        problemStatement: "",
        solutionArchitecture: "",
        scopeIn: [],
        scopeOut: [],
        techStack: [],
        timeline: [],
        investment: [],
        investmentTotal: 0,
        paymentStructure: DEFAULT_BLUEPRINT_PAYMENT_STRUCTURE.map(p => ({ ...p })),
        requiredFromClient: [],
    };
}

export default function BlueprintBuilder({ deal, adminEmail, onSaved, onPreview }: Props) {
    const existing = deal.phaseData?.phase2?.blueprint;
    const [bp, setBp] = useState<Omit<Blueprint, "version" | "status" | "sentAt">>(() => {
        if (!existing) return emptyBlueprint();
        // Strip version/status from existing to put in editor state
        const { version: _v, status: _s, sentAt: _st, ...rest } = existing;
        return rest;
    });
    const [busy, setBusy] = useState<"save" | "send" | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Auto-recompute investment total
    const investmentTotal = useMemo(
        () => bp.investment.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        [bp.investment]
    );
    const isLarge = investmentTotal >= LARGE_PROJECT_THRESHOLD;
    const changeRounds = deal.phaseData?.phase2?.changeRequestCount || 0;
    const blocked = changeRounds >= BLUEPRINT_CHANGE_ROUNDS_MAX && existing?.status === "changes_requested";

    const update = <K extends keyof typeof bp>(key: K, value: typeof bp[K]) =>
        setBp(prev => ({ ...prev, [key]: value }));

    // ─── Save Draft ─────────────────────────────────────────────────────────
    const saveDraft = async () => {
        setBusy("save"); setError(null);
        try {
            const res = await fetch(`/api/deals/${deal.token}/phase/2`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    blueprintDraft: { ...bp, investmentTotal },
                    auditAction: "blueprint.draft.save",
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
            const data = await res.json();
            onSaved(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setBusy(null);
        }
    };

    // ─── Send to Client ─────────────────────────────────────────────────────
    const sendToClient = async () => {
        // Validation
        if (!bp.problemStatement.trim()) return setError("Problem statement is required.");
        if (!bp.solutionArchitecture.trim()) return setError("Solution architecture is required.");
        if (bp.scopeIn.length === 0) return setError("Add at least one scope-in item.");
        if (bp.timeline.length === 0) return setError("Add at least one timeline sprint.");
        if (bp.investment.length === 0 || investmentTotal <= 0) return setError("Add investment line items.");
        const pctTotal = bp.paymentStructure.reduce((s, p) => s + p.percentage, 0);
        if (pctTotal !== 100) return setError(`Payment structure totals ${pctTotal}% — must equal 100%.`);

        setBusy("send"); setError(null);
        try {
            const res = await fetch(`/api/deals/${deal.token}/phase/2`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sendBlueprint",
                    ctx: { adminEmail, blueprint: { ...bp, investmentTotal } },
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
            const data = await res.json();
            onSaved(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Send failed");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-5 max-w-4xl">
            {/* Status banner */}
            <div className="bg-[#3B6AE8]/10 border border-[#3B6AE8]/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <p className="text-[10px] tracking-[0.4em] uppercase text-[#11B8EA] font-bold">Blueprint Composer · Phase 2</p>
                    <p className="text-white/85 text-sm mt-1">
                        For <span className="font-semibold">{deal.name}</span> · {deal.company}
                        {existing && <span className="text-white/40"> · v{existing.version} · {existing.status}</span>}
                    </p>
                </div>
                {existing?.status === "changes_requested" && existing.clientFeedback && (
                    <div className="text-right">
                        <p className="text-[9px] tracking-[0.3em] uppercase text-amber-400 font-bold">Client requested changes</p>
                        <p className="text-white/60 text-xs mt-1 max-w-[260px] truncate">{existing.clientFeedback}</p>
                        <p className="text-white/40 text-[10px] mt-1">Round {changeRounds} of {BLUEPRINT_CHANGE_ROUNDS_MAX}</p>
                    </div>
                )}
            </div>

            {/* Problem + Solution */}
            <Section icon={FileText} title="Problem & Solution">
                <Field label="Problem statement (what is broken today)">
                    <textarea
                        rows={3}
                        value={bp.problemStatement}
                        onChange={e => update("problemStatement", e.target.value)}
                        className={inputStyles}
                        placeholder="E.g., Their current outreach is manual, takes 6 hours daily, conversion rate is 2%..."
                    />
                </Field>
                <Field label="Solution architecture (how we'll solve it)">
                    <textarea
                        rows={4}
                        value={bp.solutionArchitecture}
                        onChange={e => update("solutionArchitecture", e.target.value)}
                        className={inputStyles}
                        placeholder="E.g., Multi-step automation pipeline: Apollo lead scrape → AI message generation → Lemlist sequencer → Slack alerts..."
                    />
                </Field>
            </Section>

            {/* Scope */}
            <Section icon={Layers} title="Scope">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChipList
                        label="In scope"
                        accent="#10B981"
                        items={bp.scopeIn}
                        onChange={v => update("scopeIn", v)}
                        placeholder="E.g., Apollo CRM integration"
                    />
                    <ChipList
                        label="Out of scope"
                        accent="#EF4444"
                        items={bp.scopeOut}
                        onChange={v => update("scopeOut", v)}
                        placeholder="E.g., Custom CRM build"
                    />
                </div>
            </Section>

            {/* Tech stack */}
            <Section icon={Code2} title="Tech stack">
                <RowList
                    rows={bp.techStack}
                    onChange={v => update("techStack", v)}
                    template={() => ({ tech: "", rationale: "" } as BlueprintTechLine)}
                    fields={[
                        { key: "tech", label: "Technology", placeholder: "Next.js 14" },
                        { key: "rationale", label: "Why this", placeholder: "App router + edge functions for low-latency reads" },
                    ]}
                />
            </Section>

            {/* Timeline */}
            <Section icon={Calendar} title="Timeline (sprint-by-sprint)">
                <RowList
                    rows={bp.timeline}
                    onChange={v => update("timeline", v)}
                    template={(idx) => ({ sprintNumber: idx + 1, goal: "", durationWeeks: 1 } as BlueprintTimelineSprint)}
                    fields={[
                        { key: "sprintNumber", label: "Sprint #", type: "number", width: "80px" },
                        { key: "goal", label: "Goal", placeholder: "Apollo + Lemlist integration spike" },
                        { key: "durationWeeks", label: "Weeks", type: "number", width: "80px" },
                    ]}
                />
                <p className="text-[10px] text-white/40 mt-2">
                    Total: {bp.timeline.reduce((s, t) => s + (Number(t.durationWeeks) || 0), 0)} weeks
                </p>
            </Section>

            {/* Investment */}
            <Section icon={IndianRupee} title="Investment breakdown">
                <RowList
                    rows={bp.investment}
                    onChange={v => update("investment", v)}
                    template={() => ({ label: "", amount: 0 } as BlueprintInvestmentLine)}
                    fields={[
                        { key: "label", label: "Line item", placeholder: "Design & prototyping" },
                        { key: "amount", label: `Amount (${CURRENCY_SYMBOL})`, type: "number", width: "140px" },
                    ]}
                />
                <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-white/[0.04] border border-white/8">
                    <span className="text-[10px] tracking-[0.4em] uppercase text-white/50">Project total</span>
                    <span className="font-mono text-white text-lg">
                        {CURRENCY_SYMBOL}{investmentTotal.toLocaleString("en-IN")}
                        {isLarge && <span className="ml-2 text-[10px] tracking-[0.2em] uppercase text-amber-400">Large project — mid-payment required</span>}
                    </span>
                </div>
            </Section>

            {/* Payment structure */}
            <Section icon={IndianRupee} title="Payment structure (must total 100%)">
                <RowList
                    rows={bp.paymentStructure}
                    onChange={v => update("paymentStructure", v)}
                    template={() => ({ phase: 3, label: "", percentage: 0 } as BlueprintPaymentRow)}
                    fields={[
                        { key: "phase", label: "Phase", type: "number", width: "80px" },
                        { key: "label", label: "Label", placeholder: "Advance Payment" },
                        { key: "percentage", label: "%", type: "number", width: "80px" },
                    ]}
                />
                <p className="text-[10px] text-white/40 mt-2 font-mono">
                    Total: {bp.paymentStructure.reduce((s, p) => s + (Number(p.percentage) || 0), 0)}%
                </p>
            </Section>

            {/* Required from client */}
            <Section icon={ListChecks} title="Required from client (seeds Phase 3 asset checklist)">
                <ChipList
                    label=""
                    accent="#11B8EA"
                    items={bp.requiredFromClient}
                    onChange={v => update("requiredFromClient", v)}
                    placeholder="E.g., Brand guidelines PDF"
                />
            </Section>

            {/* Errors */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}
            {blocked && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm p-3 rounded-lg">
                    Change-rounds cap hit ({BLUEPRINT_CHANGE_ROUNDS_MAX}). Further revisions become paid consulting — discuss with client before resending.
                </div>
            )}

            {/* Actions */}
            <div className="sticky bottom-0 bg-[#0A0F1E]/95 backdrop-blur-md border-t border-white/8 -mx-8 px-8 py-4 flex items-center justify-end gap-3">
                {onPreview && (
                    <button
                        onClick={onPreview}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-white/70 hover:text-white border border-white/15 hover:border-white/30 transition-all flex items-center gap-2"
                    >
                        <Eye size={13} /> Preview as Client
                    </button>
                )}
                <button
                    onClick={saveDraft}
                    disabled={busy !== null}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={13} /> {busy === "save" ? "Saving..." : "Save Draft"}
                </button>
                <button
                    onClick={sendToClient}
                    disabled={busy !== null}
                    className="px-5 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase bg-[#11B8EA] hover:bg-[#11B8EA]/90 text-[#0A0F1E] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <Send size={13} /> {busy === "send" ? "Sending..." : (existing ? `Send v${(existing.version || 0) + 1}` : "Send to Client")}
                </button>
            </div>
        </div>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const inputStyles = "w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#11B8EA]/40 focus:bg-white/[0.05] transition-all";

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.02] border border-white/8 rounded-2xl p-5"
        >
            <div className="flex items-center gap-2 mb-4">
                <Icon size={14} className="text-[#11B8EA]" />
                <p className="text-[10px] tracking-[0.4em] uppercase text-white/60 font-bold">{title}</p>
            </div>
            {children}
        </motion.div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-3 last:mb-0">
            {label && <label className="block text-[10px] tracking-[0.3em] uppercase text-white/40 mb-1.5">{label}</label>}
            {children}
        </div>
    );
}

function ChipList({ label, accent, items, onChange, placeholder }: {
    label: string; accent: string; items: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
    const [draft, setDraft] = useState("");
    const add = () => {
        const v = draft.trim();
        if (!v) return;
        onChange([...items, v]);
        setDraft("");
    };
    return (
        <Field label={label}>
            <div className="space-y-2">
                {items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {items.map((it, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                                style={{ background: `${accent}15`, border: `1px solid ${accent}40`, color: "white" }}
                            >
                                {it}
                                <button onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                                    <X size={11} className="opacity-50 hover:opacity-100" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <input
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                        className={inputStyles}
                        placeholder={placeholder}
                    />
                    <button onClick={add} className="px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all">
                        <Plus size={14} />
                    </button>
                </div>
            </div>
        </Field>
    );
}

interface RowField {
    key: string;
    label: string;
    placeholder?: string;
    type?: "text" | "number";
    width?: string;
}

function RowList<T extends Record<string, any>>({ rows, onChange, template, fields }: {
    rows: T[];
    onChange: (rows: T[]) => void;
    template: (idx: number) => T;
    fields: RowField[];
}) {
    const update = (idx: number, key: string, value: string) => {
        const f = fields.find(f => f.key === key);
        const v = f?.type === "number" ? Number(value) : value;
        onChange(rows.map((r, i) => i === idx ? { ...r, [key]: v } : r));
    };
    return (
        <div className="space-y-2">
            {rows.map((row, i) => (
                <div key={i} className="flex gap-2 items-start">
                    {fields.map(f => (
                        <div key={f.key} style={{ width: f.width, flex: f.width ? "0 0 auto" : 1 }}>
                            <input
                                type={f.type || "text"}
                                value={String(row[f.key] ?? "")}
                                onChange={e => update(i, f.key, e.target.value)}
                                placeholder={f.placeholder || f.label}
                                className={inputStyles + " text-xs"}
                            />
                        </div>
                    ))}
                    <button
                        onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                        className="shrink-0 w-9 h-9 rounded-lg bg-white/[0.03] hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-all flex items-center justify-center"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            <button
                onClick={() => onChange([...rows, template(rows.length)])}
                className="w-full py-2 rounded-lg border border-dashed border-white/15 hover:border-white/30 hover:bg-white/[0.02] text-white/40 hover:text-white/70 text-xs transition-all flex items-center justify-center gap-2"
            >
                <Plus size={12} /> Add row
            </button>
        </div>
    );
}
