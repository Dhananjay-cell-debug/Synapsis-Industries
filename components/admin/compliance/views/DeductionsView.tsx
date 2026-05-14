// ─── DEDUCTIONS VIEW ───────────────────────────────────────────────────────
// Chapter VI-A deduction stack tracker — claimed vs limit, per FY.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, X, PiggyBank, Trash2 } from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, StatTile, Button, Field,
    formatINR, formatINRCompact, formatDate, LoadingBlock, ErrorBlock, EmptyState,
} from "../ui";
import type { Deduction } from "@/lib/compliance/types";

interface DeductionsData {
    fy_label: string;
    deductions: Deduction[];
    bySection: Record<string, { claimed_paise: number; limit_paise: number }>;
}

const SECTIONS = ["80C", "80CCD(1B)", "80D", "80D-parents", "80E", "80G", "80TTA", "24(b)", "other"];
const n = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

export default function DeductionsView() {
    const [data, setData] = useState<DeductionsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formErr, setFormErr] = useState<string | null>(null);
    const [f, setF] = useState({ section: "80C", sub_category: "", amountR: "", invested_at: "", notes: "" });

    const load = () => {
        setError(null);
        fetch("/api/compliance/deductions")
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(e.message));
    };
    useEffect(load, []);

    const submit = async () => {
        setFormErr(null);
        const amount = Math.round(parseFloat(f.amountR || "0") * 100);
        if (!amount || amount <= 0) return setFormErr("Amount must be greater than zero");
        setSaving(true);
        try {
            const r = await fetch("/api/compliance/deductions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    section: f.section,
                    sub_category: f.sub_category.trim() || undefined,
                    amount_paise: amount,
                    invested_at: f.invested_at || undefined,
                    notes: f.notes.trim() || undefined,
                }),
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            setF({ section: "80C", sub_category: "", amountR: "", invested_at: "", notes: "" });
            setShowForm(false);
            load();
        } catch (e) {
            setFormErr(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const del = async (id: string) => {
        if (!confirm("Delete this deduction entry?")) return;
        try {
            const r = await fetch(`/api/compliance/deductions?id=${id}`, { method: "DELETE" });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            load();
        } catch (e) {
            alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
        }
    };

    const totals = useMemo(() => {
        if (!data) return { claimed: 0, headline: 0 };
        let claimed = 0;
        for (const v of Object.values(data.bySection)) claimed += v.claimed_paise;
        return { claimed };
    }, [data]);

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!data) return <LoadingBlock label="Loading deductions" />;

    // primary tracked sections to always show as progress bars
    const TRACKED: { key: string; label: string }[] = [
        { key: "80C", label: "80C — PPF / ELSS / LIC" },
        { key: "80CCD(1B)", label: "80CCD(1B) — NPS Tier 1" },
        { key: "80D", label: "80D — Health insurance" },
        { key: "80TTA", label: "80TTA — Savings interest" },
    ];

    return (
        <div>
            <ViewHeader
                eyebrow={`${data.fy_label} · Chapter VI-A`}
                title="Deductions"
                subtitle="Old-regime deduction stack. Every rupee here lowers taxable income — only counts if you actually invest before 31 March."
                action={
                    <Button onClick={() => setShowForm((s) => !s)}>
                        {showForm ? <X size={15} /> : <Plus size={15} />}{showForm ? "Close" : "Add deduction"}
                    </Button>
                }
            />

            <div className="grid grid-cols-3 gap-4 mb-4">
                <StatTile label="Stack claimed (FY)" value={formatINRCompact(totals.claimed)} sub="Total Chapter VI-A" accent />
                <StatTile label="Target stack" value="₹2.35L" sub="80C + 80CCD(1B) + 80D + 80TTA" />
                <StatTile label="Headroom left" value={formatINRCompact(Math.max(0, 235000 * 100 - totals.claimed))} sub="To hit the full stack" />
            </div>

            {showForm && (
                <Card className="mb-4">
                    <SectionLabel className="mb-4">New deduction entry</SectionLabel>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label="Section">
                            <select value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}>
                                {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="Sub-category" hint="e.g. ppf, elss, nps-tier-1">
                            <input type="text" value={f.sub_category} onChange={(e) => setF({ ...f, sub_category: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="Amount (₹)">
                            <input type="number" min={0} step="0.01" value={f.amountR} placeholder="0.00"
                                onChange={(e) => setF({ ...f, amountR: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="Invested on">
                            <input type="date" value={f.invested_at} onChange={(e) => setF({ ...f, invested_at: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="Notes" className="col-span-2">
                            <input type="text" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                    </div>
                    {formErr && <p className="text-xs mt-3" style={{ color: "#C23B3B" }}>{formErr}</p>}
                    <div className="flex gap-2 mt-4">
                        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                        <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                    </div>
                </Card>
            )}

            {/* progress bars */}
            <Card className="mb-4">
                <SectionLabel className="mb-4">Stack progress</SectionLabel>
                <div className="flex flex-col gap-4">
                    {TRACKED.map((t) => {
                        const sec = data.bySection[t.key];
                        const claimed = sec?.claimed_paise ?? 0;
                        const limit = sec?.limit_paise || (t.key === "80C" ? 15000000 : t.key === "80CCD(1B)" ? 5000000 : t.key === "80D" ? 2500000 : 1000000);
                        const pct = Math.min(100, (claimed / limit) * 100);
                        return (
                            <div key={t.key}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[12px] font-medium" style={{ color: COMPLIANCE.body }}>{t.label}</span>
                                    <span className="text-[11px] tabular-nums" style={{ color: COMPLIANCE.muted }}>
                                        {formatINR(claimed)} / {formatINRCompact(limit)}
                                    </span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: COMPLIANCE.hairline }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COMPLIANCE.accent }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* entries */}
            {data.deductions.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<PiggyBank size={20} />}
                        title="No deductions logged yet"
                        hint="Add PPF, ELSS, NPS Tier 1, health insurance premiums. Each entry needs a proof for ITR time."
                    />
                </Card>
            ) : (
                <Card padded={false}>
                    {data.deductions.map((d) => (
                        <div key={d.id} className="flex items-center justify-between px-5 py-3.5 border-b last:border-b-0"
                            style={{ borderColor: COMPLIANCE.hairline }}>
                            <div>
                                <p className="text-sm font-medium" style={{ color: COMPLIANCE.ink }}>
                                    {d.section}{d.sub_category ? ` · ${d.sub_category}` : ""}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                    {d.invested_at ? formatDate(d.invested_at) : "no date"}{d.notes ? ` · ${d.notes}` : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-semibold tabular-nums" style={{ color: COMPLIANCE.ink }}>{formatINR(n(d.amount_paise))}</span>
                                <button onClick={() => del(d.id)} className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors">
                                    <Trash2 size={13} style={{ color: COMPLIANCE.muted }} />
                                </button>
                            </div>
                        </div>
                    ))}
                </Card>
            )}
        </div>
    );
}
