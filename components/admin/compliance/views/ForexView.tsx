// ─── FOREX & FIRC VIEW ─────────────────────────────────────────────────────
// International inward remittances + FIRC tracking (export-of-services proof).

"use client";

import React, { useEffect, useState } from "react";
import { Plus, X, Globe2, Trash2, FileCheck2 } from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, StatTile, Badge, Button, Field,
    formatINR, formatINRCompact, formatDate, LoadingBlock, ErrorBlock, EmptyState,
} from "../ui";
import type { ForexInward } from "@/lib/compliance/types";

interface ForexData {
    rows: ForexInward[];
    totalInrPaise: number;
    fircPendingCount: number;
}

const PROVIDERS = ["stripe", "razorpay_intl", "wise", "direct_wire", "paypal", "other"];
const CURRENCIES = ["USD", "EUR", "GBP", "SGD", "AUD", "CAD", "AED", "other"];
const FIRC_STATUSES = ["pending", "requested", "received", "not_applicable"];
const n = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function ForexView() {
    const [data, setData] = useState<ForexData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formErr, setFormErr] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [f, setF] = useState({
        provider: "stripe", foreign_currency: "USD", payment_date: todayIso(),
        foreignAmount: "", inrAmount: "", fxRate: "", purpose_code: "P0802",
    });

    const load = () => {
        setError(null);
        fetch("/api/compliance/forex")
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
        const fa = parseFloat(f.foreignAmount || "0");
        const inr = parseFloat(f.inrAmount || "0");
        const rate = parseFloat(f.fxRate || "0");
        if (!fa || fa <= 0) return setFormErr("Foreign amount required");
        if (!inr || inr <= 0) return setFormErr("INR amount required");
        if (!rate || rate <= 0) return setFormErr("FX rate required");
        setSaving(true);
        try {
            const r = await fetch("/api/compliance/forex", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: f.provider,
                    foreign_currency: f.foreign_currency,
                    payment_date: f.payment_date,
                    foreign_amount_minor: Math.round(fa * 100),
                    inr_amount_paise: Math.round(inr * 100),
                    fx_rate: rate,
                    purpose_code: f.purpose_code,
                }),
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            setF({ provider: "stripe", foreign_currency: "USD", payment_date: todayIso(), foreignAmount: "", inrAmount: "", fxRate: "", purpose_code: "P0802" });
            setShowForm(false);
            load();
        } catch (e) {
            setFormErr(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const updateFirc = async (id: string, firc_status: string) => {
        setBusyId(id);
        try {
            const r = await fetch("/api/compliance/forex", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, firc_status, firc_received_at: firc_status === "received" ? todayIso() : null }),
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            load();
        } catch (e) {
            alert(`Update failed: ${e instanceof Error ? e.message : e}`);
        } finally {
            setBusyId(null);
        }
    };

    const del = async (id: string) => {
        if (!confirm("Delete this remittance record?")) return;
        try {
            const r = await fetch(`/api/compliance/forex?id=${id}`, { method: "DELETE" });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            load();
        } catch (e) {
            alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
        }
    };

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!data) return <LoadingBlock label="Loading forex records" />;

    const fircTone = (s: string) => (s === "received" ? "success" : s === "not_applicable" ? "neutral" : "warn");

    return (
        <div>
            <ViewHeader
                eyebrow="Export of services · FEMA"
                title="Forex & FIRC"
                subtitle="Every international payment. FIRC (Foreign Inward Remittance Certificate) is your proof of export — needed for zero-rated GST and FEMA compliance."
                action={
                    <Button onClick={() => setShowForm((s) => !s)}>
                        {showForm ? <X size={15} /> : <Plus size={15} />}{showForm ? "Close" : "Add remittance"}
                    </Button>
                }
            />

            <div className="grid grid-cols-3 gap-4 mb-4">
                <StatTile label="Total received (INR)" value={formatINRCompact(data.totalInrPaise)} sub={`${data.rows.length} remittance(s)`} accent />
                <StatTile label="FIRC pending" value={String(data.fircPendingCount)} sub="Request from your bank" />
                <StatTile label="Purpose code" value="P0802" sub="IT / software services" />
            </div>

            {showForm && (
                <Card className="mb-4">
                    <SectionLabel className="mb-4">New inward remittance</SectionLabel>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label="Provider">
                            <select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}>
                                {PROVIDERS.map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
                            </select>
                        </Field>
                        <Field label="Currency">
                            <select value={f.foreign_currency} onChange={(e) => setF({ ...f, foreign_currency: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}>
                                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                        <Field label="Payment date">
                            <input type="date" value={f.payment_date} onChange={(e) => setF({ ...f, payment_date: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label={`Foreign amount (${f.foreign_currency})`}>
                            <input type="number" min={0} step="0.01" value={f.foreignAmount} placeholder="0.00"
                                onChange={(e) => setF({ ...f, foreignAmount: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="INR credited (₹)">
                            <input type="number" min={0} step="0.01" value={f.inrAmount} placeholder="0.00"
                                onChange={(e) => setF({ ...f, inrAmount: e.target.value })}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                        <Field label="FX rate" hint="SBI TT reference rate">
                            <input type="number" min={0} step="0.0001" value={f.fxRate} placeholder="0.0000"
                                onChange={(e) => setF({ ...f, fxRate: e.target.value })}
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

            {data.rows.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<Globe2 size={20} />}
                        title="No international payments yet"
                        hint="When a Stripe / Wise payout lands, log it here and request the FIRC from your bank within 30 days."
                    />
                </Card>
            ) : (
                <Card padded={false}>
                    {data.rows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between px-5 py-4 border-b last:border-b-0"
                            style={{ borderColor: COMPLIANCE.hairline }}>
                            <div>
                                <p className="text-sm font-medium" style={{ color: COMPLIANCE.ink }}>
                                    {row.foreign_currency} {n(row.foreign_amount_minor) / 100} · {formatINR(n(row.inr_amount_paise))}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                    {row.provider.replace(/_/g, " ")} · {formatDate(row.payment_date)} · @ {row.fx_rate} · {row.purpose_code}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge tone={fircTone(row.firc_status)}>
                                    <FileCheck2 size={9} /> FIRC {row.firc_status.replace(/_/g, " ")}
                                </Badge>
                                {row.firc_status !== "received" && row.firc_status !== "not_applicable" && (
                                    <select
                                        disabled={busyId === row.id}
                                        value={row.firc_status}
                                        onChange={(e) => updateFirc(row.id, e.target.value)}
                                        className="text-[11px] rounded-lg border bg-white px-2 py-1 outline-none focus:border-[#0C97C4]"
                                        style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}
                                    >
                                        {FIRC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                                    </select>
                                )}
                                <button onClick={() => del(row.id)} className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors">
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
