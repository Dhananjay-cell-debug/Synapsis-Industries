// ─── EXPENSES & ITC VIEW ───────────────────────────────────────────────────
// Log business spend. Tracks ITC-eligible GST. The priority feature.

"use client";

import React, { useEffect, useState } from "react";
import { Plus, Receipt, Trash2, X, Sparkles, FileInput, Check } from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, StatTile, Badge, Button, Field,
    formatINR, formatINRCompact, formatDate, LoadingBlock, ErrorBlock, EmptyState,
} from "../ui";
import { cn } from "@/lib/utils";
import type { Expense, ExpenseCategory } from "@/lib/compliance/types";

interface ExpenseDraft {
    expense_date: string;
    vendor: string;
    description: string | null;
    category_code: string;
    amount_rupees: number;
    gst_rupees: number;
    vendor_gstin: string | null;
    confidence: "high" | "medium" | "low";
    source_reference: string | null;
    raw_snippet: string;
    notes: string | null;
}

interface ExpensesData {
    expenses: Expense[];
    categories: ExpenseCategory[];
    totals: {
        total_amount_paise: number; total_taxable_paise: number; total_gst_paise: number;
        itc_eligible_paise: number; itc_claimed_paise: number; itc_unclaimed_paise: number;
        count: number; fiscal_year: string;
    };
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const n = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

export default function ExpensesView() {
    const [data, setData] = useState<ExpensesData | null>(null);
    const [showSmart, setShowSmart] = useState(false);
    const [smartText, setSmartText] = useState("");
    const [parsing, setParsing] = useState(false);
    const [parseErr, setParseErr] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<ExpenseDraft[] | null>(null);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formErr, setFormErr] = useState<string | null>(null);

    // form state
    const [f, setF] = useState({
        expense_date: todayIso(), vendor: "", description: "", category_code: "saas_dev_tools",
        amountR: "", gstR: "", itc_eligible: true, vendor_gstin: "",
    });

    const load = () => {
        setError(null);
        fetch("/api/compliance/expenses")
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(e.message));
    };
    useEffect(load, []);

    const resetForm = () =>
        setF({ expense_date: todayIso(), vendor: "", description: "", category_code: "saas_dev_tools", amountR: "", gstR: "", itc_eligible: true, vendor_gstin: "" });

    const submit = async () => {
        setFormErr(null);
        const amount = Math.round(parseFloat(f.amountR || "0") * 100);
        const gst = Math.round(parseFloat(f.gstR || "0") * 100);
        if (!f.vendor.trim()) return setFormErr("Vendor is required");
        if (!amount || amount <= 0) return setFormErr("Amount must be greater than zero");
        if (gst > amount) return setFormErr("GST cannot exceed total amount");

        setSaving(true);
        try {
            const r = await fetch("/api/compliance/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    expense_date: f.expense_date,
                    vendor: f.vendor.trim(),
                    description: f.description.trim() || undefined,
                    category_code: f.category_code,
                    amount_paise: amount,
                    gst_amount_paise: gst,
                    itc_eligible: gst > 0 ? f.itc_eligible : false,
                    vendor_gstin: f.vendor_gstin.trim() || undefined,
                    source: "manual",
                }),
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            resetForm();
            setShowForm(false);
            load();
        } catch (e) {
            setFormErr(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const del = async (id: string) => {
        if (!confirm("Delete this expense?")) return;
        try {
            const r = await fetch(`/api/compliance/expenses?id=${id}`, { method: "DELETE" });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            load();
        } catch (e) {
            alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
        }
    };

    // ─── Smart-Add: AI parse raw text → preview drafts → bulk create ───
    const openSmart = () => {
        setShowSmart(true);
        setShowForm(false);
        setSmartText("");
        setDrafts(null);
        setParseErr(null);
        setBulkResult(null);
    };
    const closeSmart = () => {
        setShowSmart(false);
        setSmartText("");
        setDrafts(null);
        setParseErr(null);
        setBulkResult(null);
    };
    const parseText = async () => {
        if (!smartText.trim()) return;
        setParsing(true);
        setParseErr(null);
        setDrafts(null);
        try {
            const r = await fetch("/api/compliance/expenses/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: smartText }),
            });
            const body = await r.json();
            if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
            setDrafts(body.expenses ?? []);
            if ((body.expenses ?? []).length === 0) {
                setParseErr("AI couldn't find any expenses in that text. Try a clearer paste — vendor + amount + date helps.");
            }
        } catch (e) {
            setParseErr(e instanceof Error ? e.message : "Parse failed");
        } finally {
            setParsing(false);
        }
    };
    const updateDraft = (i: number, patch: Partial<ExpenseDraft>) => {
        setDrafts((cur) => cur ? cur.map((d, idx) => idx === i ? { ...d, ...patch } : d) : cur);
    };
    const removeDraft = (i: number) => {
        setDrafts((cur) => cur ? cur.filter((_, idx) => idx !== i) : cur);
    };
    const bulkCreate = async () => {
        if (!drafts || drafts.length === 0) return;
        setBulkSaving(true);
        try {
            const payload = drafts.map((d) => ({
                expense_date: d.expense_date,
                vendor: d.vendor,
                description: d.description ?? undefined,
                category_code: d.category_code,
                amount_paise: Math.round(d.amount_rupees * 100),
                gst_amount_paise: Math.round(d.gst_rupees * 100),
                itc_eligible: d.gst_rupees > 0,
                vendor_gstin: d.vendor_gstin ?? undefined,
                source: "email_parsed" as const,
                source_reference: d.source_reference ?? undefined,
                notes: d.notes ?? undefined,
            }));
            const r = await fetch("/api/compliance/expenses/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ expenses: payload }),
            });
            const body = await r.json();
            if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
            setBulkResult({
                created: Array.isArray(body.created) ? body.created.length : 0,
                skipped: typeof body.skipped === "number" ? body.skipped : 0,
            });
            load();
            // keep the panel open so user sees the result
            setDrafts(null);
        } catch (e) {
            alert(`Bulk create failed: ${e instanceof Error ? e.message : e}`);
        } finally {
            setBulkSaving(false);
        }
    };

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!data) return <LoadingBlock label="Loading expenses" />;

    const catLabel = (code: string | null) =>
        data.categories.find((c) => c.code === code)?.label ?? code ?? "—";

    return (
        <div>
            <ViewHeader
                eyebrow={`${data.totals.fiscal_year} · Input tax credit`}
                title="Expenses & ITC"
                subtitle="Paste a Gmail receipt, a GPay confirmation, a bank statement chunk — AI extracts the expenses, you review, bulk-add. Manual entry stays as fallback."
                action={
                    <div className="flex gap-2">
                        <Button onClick={showSmart ? closeSmart : openSmart}>
                            {showSmart ? <X size={15} /> : <Sparkles size={15} />}
                            {showSmart ? "Close" : "Smart Add (AI)"}
                        </Button>
                        <Button variant="outline" onClick={() => { setShowForm(s => !s); if (!showForm) closeSmart(); }}>
                            {showForm ? <X size={15} /> : <Plus size={15} />}
                            {showForm ? "Close" : "Manual"}
                        </Button>
                    </div>
                }
            />

            {/* totals */}
            <div className="grid grid-cols-4 gap-4 mb-4">
                <StatTile label="Total spent (FY)" value={formatINRCompact(data.totals.total_amount_paise)} sub={`${data.totals.count} expense(s)`} />
                <StatTile label="GST paid" value={formatINRCompact(data.totals.total_gst_paise)} sub="On inputs" />
                <StatTile label="ITC unclaimed" value={formatINRCompact(data.totals.itc_unclaimed_paise)} sub="Claim in next GSTR-3B" accent />
                <StatTile label="ITC claimed" value={formatINRCompact(data.totals.itc_claimed_paise)} sub="Already offset" />
            </div>

            {/* ─── SMART ADD PANEL (AI bulk-paste) ─── */}
            {showSmart && (
                <Card className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={15} style={{ color: COMPLIANCE.accent }} />
                        <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>Smart Add — paste anything</p>
                    </div>
                    <p className="text-[12px] mb-3" style={{ color: COMPLIANCE.muted }}>
                        Forward a Gmail receipt, paste a GPay/PhonePe confirmation, drop a bank-statement chunk, or paste an invoice text. AI extracts each expense, you review + edit, then bulk-add. Vendor + amount + date is enough — AI fills the rest.
                    </p>
                    <textarea
                        value={smartText}
                        onChange={(e) => setSmartText(e.target.value)}
                        placeholder="Paste raw text here — emails, bank lines, GPay confirmations..."
                        rows={drafts ? 3 : 8}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4] font-mono"
                        style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink, resize: "vertical" }}
                    />
                    <div className="flex items-center gap-2 mt-3">
                        <Button onClick={parseText} disabled={parsing || !smartText.trim()}>
                            <FileInput size={14} /> {parsing ? "Parsing…" : drafts ? "Re-parse" : "Parse with AI"}
                        </Button>
                        {smartText.trim() && (
                            <span className="text-[11px]" style={{ color: COMPLIANCE.muted }}>
                                {smartText.length.toLocaleString()} chars
                            </span>
                        )}
                    </div>
                    {parseErr && (
                        <p className="text-xs mt-3" style={{ color: "#C23B3B" }}>{parseErr}</p>
                    )}
                    {bulkResult && (
                        <div className="flex items-center gap-2 mt-3 rounded-lg px-3 py-2"
                            style={{ background: "rgba(16,158,90,0.08)", color: "#0E8A50" }}>
                            <Check size={14} />
                            <p className="text-[12px] font-semibold">
                                {bulkResult.created} created · {bulkResult.skipped} skipped (already logged)
                            </p>
                        </div>
                    )}

                    {/* drafts preview */}
                    {drafts && drafts.length > 0 && (
                        <div className="mt-4">
                            <SectionLabel className="mb-2">{drafts.length} expense{drafts.length === 1 ? "" : "s"} extracted — review &amp; edit</SectionLabel>
                            <div className="flex flex-col gap-2 mb-3 max-h-[420px] overflow-y-auto pr-1">
                                {drafts.map((d, i) => (
                                    <DraftRow
                                        key={i}
                                        draft={d}
                                        categories={data.categories}
                                        onChange={(p) => updateDraft(i, p)}
                                        onRemove={() => removeDraft(i)}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: COMPLIANCE.hairline }}>
                                <Button onClick={bulkCreate} disabled={bulkSaving}>
                                    <Plus size={14} /> {bulkSaving ? "Adding…" : `Add all ${drafts.length}`}
                                </Button>
                                <Button variant="ghost" onClick={() => setDrafts(null)}>Clear preview</Button>
                                <span className="ml-auto text-[11px]" style={{ color: COMPLIANCE.muted }}>
                                    Dedup auto — paste same text twice, second time gets skipped.
                                </span>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* add form */}
            {showForm && (
                <Card className="mb-4">
                    <SectionLabel className="mb-4">New expense</SectionLabel>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label="Date">
                            <input type="date" value={f.expense_date}
                                onChange={(e) => setF({ ...f, expense_date: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="Vendor" className="col-span-2">
                            <input type="text" value={f.vendor} placeholder="e.g. Vercel, Anthropic, Razorpay"
                                onChange={(e) => setF({ ...f, vendor: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="Category">
                            <select value={f.category_code}
                                onChange={(e) => setF({ ...f, category_code: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}>
                                {data.categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Total amount (₹)">
                            <input type="number" min={0} step="0.01" value={f.amountR} placeholder="0.00"
                                onChange={(e) => setF({ ...f, amountR: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="GST portion (₹)" hint="0 if no GST invoice">
                            <input type="number" min={0} step="0.01" value={f.gstR} placeholder="0.00"
                                onChange={(e) => setF({ ...f, gstR: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="Vendor GSTIN" hint="Optional — needed for ITC">
                            <input type="text" value={f.vendor_gstin} placeholder="e.g. 29AAACX…"
                                onChange={(e) => setF({ ...f, vendor_gstin: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="Description" className="col-span-2">
                            <input type="text" value={f.description} placeholder="What was this for?"
                                onChange={(e) => setF({ ...f, description: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
                            <input type="checkbox" checked={f.itc_eligible}
                                onChange={(e) => setF({ ...f, itc_eligible: e.target.checked })}
                                className="w-4 h-4 rounded" style={{ accentColor: COMPLIANCE.accent }} />
                            <span className="text-xs" style={{ color: COMPLIANCE.body }}>ITC eligible</span>
                        </label>
                    </div>
                    {formErr && <p className="text-xs mt-3" style={{ color: "#C23B3B" }}>{formErr}</p>}
                    <div className="flex gap-2 mt-4">
                        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save expense"}</Button>
                        <Button variant="ghost" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</Button>
                    </div>
                </Card>
            )}

            {/* list */}
            {data.expenses.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<Receipt size={20} />}
                        title="No expenses logged yet"
                        hint="Add your SaaS subscriptions, equipment, and fees. Every GST-bearing spend becomes claimable ITC."
                    />
                </Card>
            ) : (
                <Card padded={false}>
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.muted }}>
                        <span>Vendor / category</span>
                        <span className="text-right">Amount</span>
                        <span className="text-right">GST</span>
                        <span className="text-right">ITC</span>
                        <span></span>
                    </div>
                    {data.expenses.map((e) => (
                        <div key={e.id}
                            className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 border-b last:border-b-0 items-center"
                            style={{ borderColor: COMPLIANCE.hairline }}>
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: COMPLIANCE.ink }}>{e.vendor}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                    {catLabel(e.category_code)} · {formatDate(e.expense_date)}
                                    {e.description ? ` · ${e.description}` : ""}
                                </p>
                            </div>
                            <span className="text-sm text-right tabular-nums" style={{ color: COMPLIANCE.ink }}>{formatINR(n(e.amount_paise))}</span>
                            <span className="text-sm text-right tabular-nums" style={{ color: COMPLIANCE.muted }}>{n(e.gst_amount_paise) > 0 ? formatINR(n(e.gst_amount_paise)) : "—"}</span>
                            <span className="text-right">
                                {n(e.gst_amount_paise) > 0 && e.itc_eligible
                                    ? <Badge tone={e.itc_claimed ? "success" : "accent"}>{e.itc_claimed ? "claimed" : "claimable"}</Badge>
                                    : <span className="text-[11px]" style={{ color: COMPLIANCE.muted }}>—</span>}
                            </span>
                            <button onClick={() => del(e.id)} className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors">
                                <Trash2 size={13} style={{ color: COMPLIANCE.muted }} />
                            </button>
                        </div>
                    ))}
                </Card>
            )}
        </div>
    );
}

// ─── DraftRow — editable preview of a parsed expense ──────────────────────

function DraftRow({ draft, categories, onChange, onRemove }: {
    draft: ExpenseDraft;
    categories: ExpenseCategory[];
    onChange: (p: Partial<ExpenseDraft>) => void;
    onRemove: () => void;
}) {
    const tone =
        draft.confidence === "high" ? "success" :
        draft.confidence === "medium" ? "accent" : "warn";

    return (
        <div className="rounded-xl border p-3" style={{ borderColor: COMPLIANCE.hairline, background: "#fff" }}>
            <div className="flex items-center gap-2 mb-2">
                <Badge tone={tone as "success" | "accent" | "warn"}>{draft.confidence} confidence</Badge>
                {draft.raw_snippet && (
                    <span className="text-[10px] truncate max-w-[460px]" style={{ color: COMPLIANCE.muted }}>
                        “{draft.raw_snippet}”
                    </span>
                )}
                <button onClick={onRemove} className="ml-auto p-1 rounded hover:bg-black/[0.05]" aria-label="Remove">
                    <X size={13} style={{ color: COMPLIANCE.muted }} />
                </button>
            </div>
            <div className="grid grid-cols-[120px_1fr_120px_120px_120px] gap-2 items-end">
                <div>
                    <label className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: COMPLIANCE.muted }}>Date</label>
                    <input type="date" value={draft.expense_date}
                        onChange={(e) => onChange({ expense_date: e.target.value })}
                        className="w-full mt-0.5 rounded-md border bg-white px-2 py-1.5 text-xs outline-none focus:border-[#0C97C4]"
                        style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                </div>
                <div>
                    <label className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: COMPLIANCE.muted }}>Vendor / description</label>
                    <input type="text" value={draft.vendor}
                        onChange={(e) => onChange({ vendor: e.target.value })}
                        placeholder="Vendor"
                        className="w-full mt-0.5 rounded-md border bg-white px-2 py-1.5 text-xs outline-none focus:border-[#0C97C4]"
                        style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                </div>
                <div>
                    <label className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: COMPLIANCE.muted }}>Category</label>
                    <select value={draft.category_code}
                        onChange={(e) => onChange({ category_code: e.target.value })}
                        className="w-full mt-0.5 rounded-md border bg-white px-2 py-1.5 text-xs outline-none focus:border-[#0C97C4]"
                        style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}>
                        {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: COMPLIANCE.muted }}>Amount (₹)</label>
                    <input type="number" min={0} step="0.01" value={draft.amount_rupees}
                        onChange={(e) => onChange({ amount_rupees: Number(e.target.value) || 0 })}
                        className="w-full mt-0.5 rounded-md border bg-white px-2 py-1.5 text-xs outline-none focus:border-[#0C97C4] tabular-nums"
                        style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                </div>
                <div>
                    <label className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: COMPLIANCE.muted }}>GST (₹)</label>
                    <input type="number" min={0} step="0.01" value={draft.gst_rupees}
                        onChange={(e) => onChange({ gst_rupees: Number(e.target.value) || 0 })}
                        className="w-full mt-0.5 rounded-md border bg-white px-2 py-1.5 text-xs outline-none focus:border-[#0C97C4] tabular-nums"
                        style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                </div>
            </div>
        </div>
    );
}
