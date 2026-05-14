// ─── EXPENSES & ITC VIEW ───────────────────────────────────────────────────
// Log business spend. Tracks ITC-eligible GST. The priority feature.

"use client";

import React, { useEffect, useState } from "react";
import { Plus, Receipt, Trash2, X } from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, StatTile, Badge, Button, Field,
    formatINR, formatINRCompact, formatDate, LoadingBlock, ErrorBlock, EmptyState,
} from "../ui";
import { cn } from "@/lib/utils";
import type { Expense, ExpenseCategory } from "@/lib/compliance/types";

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

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!data) return <LoadingBlock label="Loading expenses" />;

    const catLabel = (code: string | null) =>
        data.categories.find((c) => c.code === code)?.label ?? code ?? "—";

    return (
        <div>
            <ViewHeader
                eyebrow={`${data.totals.fiscal_year} · Input tax credit`}
                title="Expenses & ITC"
                subtitle="Log every business spend. GST paid on inputs becomes Input Tax Credit against your output GST. Auto-fetch from email arrives in a later phase."
                action={
                    <Button onClick={() => setShowForm((s) => !s)}>
                        {showForm ? <X size={15} /> : <Plus size={15} />}
                        {showForm ? "Close" : "Add expense"}
                    </Button>
                }
            />

            {/* totals */}
            <div className="grid grid-cols-4 gap-4 mb-4">
                <StatTile label="Total spent (FY)" value={formatINRCompact(data.totals.total_amount_paise)} sub={`${data.totals.count} expense(s)`} />
                <StatTile label="GST paid" value={formatINRCompact(data.totals.total_gst_paise)} sub="On inputs" />
                <StatTile label="ITC unclaimed" value={formatINRCompact(data.totals.itc_unclaimed_paise)} sub="Claim in next GSTR-3B" accent />
                <StatTile label="ITC claimed" value={formatINRCompact(data.totals.itc_claimed_paise)} sub="Already offset" />
            </div>

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
