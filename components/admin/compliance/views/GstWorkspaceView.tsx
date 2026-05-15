// ─── GST WORKSPACE VIEW ────────────────────────────────────────────────────
// Three tabs:
//   • Live Classifier — "what's the GST treatment" calculator (the engine
//     that auto-stamps real invoices).
//   • GSTR-1 Prep — quarterly filing prep: B2B/B2CS/Export/HSN breakdown
//     + downloadable GSTN-spec JSON (Path C of AUTO-FILE-ARCHITECTURE).
//   • GSTR-3B Prep — monthly filing prep: section 3.1 + 4 values
//     copy-ready for manual portal entry.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    FileSpreadsheet, ArrowRight, Lock, Download, Copy, Check, AlertTriangle,
    Calculator as CalcIcon, FileText, ListChecks,
} from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, Badge, Field,
    formatINR, formatINRCompact, LoadingBlock, ErrorBlock,
} from "../ui";
import { cn } from "@/lib/utils";
import { classifyGstTreatment } from "@/lib/compliance/tax-engine";
import { STATE_CODES } from "@/lib/compliance/constants";
import type { BusinessTaxProfile, RecipientType } from "@/lib/compliance/types";

type TabId = "classifier" | "gstr1" | "gstr3b";

export default function GstWorkspaceView() {
    const [tab, setTab] = useState<TabId>("classifier");

    return (
        <div>
            <ViewHeader
                eyebrow="GST engine + filing prep"
                title="GST Workspace"
                subtitle="Live treatment classifier, plus quarter + month filing prep — exact data the portal expects, ready to upload or paste."
            />

            {/* Tabs */}
            <div className="flex gap-1.5 p-1 rounded-xl mb-5 w-fit" style={{ background: "#F0F2F4" }}>
                {([
                    { id: "classifier", label: "Live Classifier", icon: CalcIcon },
                    { id: "gstr1", label: "GSTR-1 Prep", icon: FileText },
                    { id: "gstr3b", label: "GSTR-3B Prep", icon: ListChecks },
                ] as const).map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                        style={tab === t.id
                            ? { background: "#fff", color: COMPLIANCE.ink, boxShadow: "0 1px 3px rgba(10,15,30,0.10)" }
                            : { color: COMPLIANCE.muted }}
                    >
                        <t.icon size={13} /> {t.label}
                    </button>
                ))}
            </div>

            {tab === "classifier" && <ClassifierPanel />}
            {tab === "gstr1" && <Gstr1PrepPanel />}
            {tab === "gstr3b" && <Gstr3bPrepPanel />}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — LIVE CLASSIFIER (existing functionality, repackaged)
// ════════════════════════════════════════════════════════════════════════════

const RECIPIENT_TYPES: { value: RecipientType; label: string }[] = [
    { value: "indian_registered", label: "Indian — GST registered (B2B)" },
    { value: "indian_unregistered", label: "Indian — unregistered (B2C)" },
    { value: "international_business", label: "International — business" },
    { value: "international_individual", label: "International — individual" },
];

const STATE_NAMES = Object.keys(STATE_CODES);

function ClassifierPanel() {
    const [profile, setProfile] = useState<BusinessTaxProfile | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [recipient, setRecipient] = useState<RecipientType>("indian_registered");
    const [country, setCountry] = useState("India");
    const [state, setState] = useState("Maharashtra");
    const [clientGstin, setClientGstin] = useState("");
    const [currency, setCurrency] = useState<"INR" | "USD">("INR");
    const [valueR, setValueR] = useState("100000");

    const load = () => {
        setError(null);
        fetch("/api/compliance/profile")
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then(setProfile)
            .catch((e) => setError(e.message));
    };
    useEffect(load, []);

    const isInternational = recipient === "international_business" || recipient === "international_individual";

    const result = useMemo(() => {
        if (!profile) return null;
        const taxable = Math.round(parseFloat(valueR || "0") * 100);
        return classifyGstTreatment({
            business: {
                address_state: profile.address_state,
                lut_active: profile.lut_active,
                gstin: profile.gstin,
            },
            client: {
                recipient_type: recipient,
                billing_state: isInternational ? null : state,
                billing_country: isInternational ? country : "India",
                client_gstin: recipient === "indian_registered" ? (clientGstin || null) : null,
                place_of_supply: null,
            },
            invoice_currency: currency,
            taxable_value_minor: taxable,
        });
    }, [profile, recipient, country, state, clientGstin, currency, valueR, isInternational]);

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!profile || !result) return <LoadingBlock label="Loading GST workspace" />;

    const sym = currency === "USD" ? "$" : "₹";
    const fmtMinor = (m: number) => `${sym}${(m / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    const treatmentTone =
        result.zero_rated ? "success"
            : result.treatment.startsWith("export") ? "warn"
                : "accent";

    return (
        <div className="grid grid-cols-5 gap-4">
            <Card className="col-span-2">
                <SectionLabel className="mb-4">Client scenario</SectionLabel>
                <div className="flex flex-col gap-3.5">
                    <Field label="Recipient type">
                        <select value={recipient} onChange={(e) => setRecipient(e.target.value as RecipientType)}
                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                            style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}>
                            {RECIPIENT_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                        </select>
                    </Field>

                    {isInternational ? (
                        <Field label="Client country">
                            <input type="text" value={country} onChange={(e) => setCountry(e.target.value)}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                    ) : (
                        <Field label="Client state">
                            <select value={state} onChange={(e) => setState(e.target.value)}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}>
                                {STATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>
                    )}

                    {recipient === "indian_registered" && (
                        <Field label="Client GSTIN" hint="Optional — for the B2B record">
                            <input type="text" value={clientGstin} onChange={(e) => setClientGstin(e.target.value)}
                                placeholder="e.g. 29AAACX1234M1Z5"
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                        </Field>
                    )}

                    <Field label="Invoice currency">
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl" style={{ background: "#F0F2F4" }}>
                            {(["INR", "USD"] as const).map((c) => (
                                <button key={c} onClick={() => setCurrency(c)}
                                    className="py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={currency === c
                                        ? { background: "#fff", color: COMPLIANCE.ink, boxShadow: "0 1px 3px rgba(10,15,30,0.10)" }
                                        : { color: COMPLIANCE.muted }}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    </Field>

                    <Field label={`Taxable value (${sym})`}>
                        <input type="number" min={0} value={valueR} onChange={(e) => setValueR(e.target.value)}
                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                            style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }} />
                    </Field>
                </div>

                <div className="mt-4 pt-4 border-t" style={{ borderColor: COMPLIANCE.hairline }}>
                    <p className="text-[11px]" style={{ color: COMPLIANCE.muted }}>
                        Business context: <span className="font-medium" style={{ color: COMPLIANCE.body }}>{profile.address_state}</span> ·
                        LUT <span className="font-medium" style={{ color: profile.lut_active ? "#0E8A50" : "#C23B3B" }}>{profile.lut_active ? "active" : "inactive"}</span> ·
                        GSTIN <span className="font-medium" style={{ color: COMPLIANCE.body }}>{profile.gstin || "pending"}</span>
                    </p>
                </div>
            </Card>

            <div className="col-span-3 flex flex-col gap-4">
                <Card>
                    <div className="flex items-center justify-between">
                        <SectionLabel>Engine verdict</SectionLabel>
                        <Badge tone={treatmentTone as "accent" | "warn" | "success"}>
                            {result.treatment.replace(/_/g, " ")}
                        </Badge>
                    </div>
                    <p className="font-serif leading-tight mt-3" style={{ fontSize: "1.5rem", color: COMPLIANCE.ink }}>
                        {result.zero_rated
                            ? "Zero-rated — no GST charged"
                            : result.total_tax_minor === 0
                                ? "No GST applies"
                                : `${result.gst_rate}% GST applies`}
                    </p>
                    <p className="text-[13px] mt-2 leading-relaxed" style={{ color: COMPLIANCE.body }}>
                        {result.treatment_reason}
                    </p>
                    <p className="text-[11px] mt-2" style={{ color: COMPLIANCE.muted }}>
                        Place of supply: <span className="font-medium">{result.place_of_supply}</span> · SAC {result.sac_code} · rule {result.rule_version}
                    </p>
                </Card>

                <Card>
                    <SectionLabel className="mb-4">Invoice breakdown</SectionLabel>
                    <div className="flex flex-col gap-2.5">
                        {[
                            { label: "Taxable value", value: result.total_invoice_minor - result.total_tax_minor },
                            { label: "CGST", value: result.cgst_amount_minor, hide: result.cgst_amount_minor === 0 },
                            { label: "SGST", value: result.sgst_amount_minor, hide: result.sgst_amount_minor === 0 },
                            { label: "IGST", value: result.igst_amount_minor, hide: result.igst_amount_minor === 0 },
                        ].filter((r) => !r.hide).map((r) => (
                            <div key={r.label} className="flex items-center justify-between">
                                <span className="text-[13px]" style={{ color: COMPLIANCE.body }}>{r.label}</span>
                                <span className="text-[13px] tabular-nums font-medium" style={{ color: COMPLIANCE.ink }}>{fmtMinor(r.value)}</span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between pt-2.5 border-t" style={{ borderColor: COMPLIANCE.hairline }}>
                            <span className="text-sm font-semibold" style={{ color: COMPLIANCE.ink }}>Invoice total</span>
                            <span className="font-serif tabular-nums" style={{ fontSize: "1.4rem", color: COMPLIANCE.accent }}>
                                {fmtMinor(result.total_invoice_minor)}
                            </span>
                        </div>
                    </div>
                </Card>

                <div className="flex items-start gap-2 rounded-xl p-4" style={{ background: COMPLIANCE.accentSofter }}>
                    <Lock size={14} style={{ color: COMPLIANCE.accent }} className="mt-0.5 shrink-0" />
                    <p className="text-[12px] leading-relaxed" style={{ color: COMPLIANCE.body }}>
                        On real invoices, this classification is stamped <span className="font-semibold">immutably</span> onto the tax snapshot — switch to GSTR-1 Prep tab to see how filtered + aggregated invoices roll up into a quarter's return.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — GSTR-1 PREP
// ════════════════════════════════════════════════════════════════════════════

interface GSTR1Response {
    prep: {
        fy_label: string; quarter: string; period_start: string; period_end: string;
        fp_code: string; business_gstin: string; business_state_code: string;
        lut_active: boolean; generated_at: string;
        totals: {
            invoiceCount: number;
            totalInvoiceValue_paise: number;
            totalTaxableValue_paise: number;
            totalCgst_paise: number; totalSgst_paise: number; totalIgst_paise: number; totalCess_paise: number;
        };
        sections: {
            b2b: { count: number; taxableValue_paise: number; taxTotal_paise: number; rows: any[] };
            b2cs: { count: number; taxableValue_paise: number; taxTotal_paise: number; rows: any[] };
            exp: { count: number; taxableValue_paise: number; taxTotal_paise: number; rows: any[] };
            hsn: { rows: any[] };
        };
        warnings: { severity: "info" | "warning" | "error"; message: string }[];
    };
    json: Record<string, unknown>;
}

function currentFY(): string {
    const d = new Date();
    const m = d.getMonth();
    const y = d.getFullYear();
    const start = m >= 3 ? y : y - 1;
    return `FY${start}-${String(start + 1).slice(-2)}`;
}

function currentQuarter(): "Q1" | "Q2" | "Q3" | "Q4" {
    const m = new Date().getMonth();
    if (m >= 3 && m <= 5) return "Q1";
    if (m >= 6 && m <= 8) return "Q2";
    if (m >= 9 && m <= 11) return "Q3";
    return "Q4";
}

function Gstr1PrepPanel() {
    const [fy, setFy] = useState(currentFY());
    const [quarter, setQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4">(currentQuarter());
    const [data, setData] = useState<GSTR1Response | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const load = () => {
        setLoading(true);
        setError(null);
        fetch(`/api/compliance/gstr1?fy=${fy}&quarter=${quarter}`)
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, [fy, quarter]);

    const downloadJson = () => {
        const url = `/api/compliance/gstr1?fy=${fy}&quarter=${quarter}&download=1`;
        window.open(url, "_blank");
    };

    if (error) return <ErrorBlock message={error} onRetry={load} />;

    return (
        <div>
            {/* Period selector */}
            <Card className="mb-4">
                <div className="flex items-end gap-4">
                    <Field label="Fiscal year">
                        <select value={fy} onChange={(e) => setFy(e.target.value)}
                            className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                            style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink, minWidth: 140 }}>
                            {["FY2026-27", "FY2027-28", "FY2028-29"].map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </Field>
                    <Field label="Quarter">
                        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl" style={{ background: "#F0F2F4" }}>
                            {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                                <button key={q} onClick={() => setQuarter(q)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={quarter === q
                                        ? { background: "#fff", color: COMPLIANCE.ink, boxShadow: "0 1px 3px rgba(10,15,30,0.10)" }
                                        : { color: COMPLIANCE.muted }}>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </Field>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={downloadJson}
                            disabled={loading || !data || data.prep.totals.invoiceCount === 0}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            style={{ background: COMPLIANCE.accent }}
                        >
                            <Download size={14} /> Download GSTR-1 JSON
                        </button>
                    </div>
                </div>
            </Card>

            {loading && <LoadingBlock label="Building return…" />}

            {!loading && data && (
                <>
                    {/* Header strip */}
                    <Card className="mb-4">
                        <div className="grid grid-cols-4 gap-6">
                            <div>
                                <SectionLabel>Period</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>
                                    {data.prep.fy_label} · {data.prep.quarter}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                    {data.prep.period_start} → {data.prep.period_end}
                                </p>
                            </div>
                            <div>
                                <SectionLabel>FP code</SectionLabel>
                                <p className="font-mono text-sm font-semibold mt-1" style={{ color: COMPLIANCE.accent }}>{data.prep.fp_code}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>MMYYYY · quarter-end</p>
                            </div>
                            <div>
                                <SectionLabel>Invoices</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>{data.prep.totals.invoiceCount}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                    B2B {data.prep.sections.b2b.count} · B2CS {data.prep.sections.b2cs.count} · Exp {data.prep.sections.exp.count}
                                </p>
                            </div>
                            <div>
                                <SectionLabel>Total taxable</SectionLabel>
                                <p className="font-serif mt-1" style={{ fontSize: "1.4rem", color: COMPLIANCE.accent, lineHeight: 1 }}>
                                    {formatINRCompact(data.prep.totals.totalTaxableValue_paise)}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                    Tax {formatINRCompact(data.prep.totals.totalCgst_paise + data.prep.totals.totalSgst_paise + data.prep.totals.totalIgst_paise)}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Warnings */}
                    {data.prep.warnings.length > 0 && (
                        <Card className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={14} style={{ color: "#A8700A" }} />
                                <SectionLabel>Heads up</SectionLabel>
                            </div>
                            <ul className="flex flex-col gap-1.5">
                                {data.prep.warnings.map((w, i) => (
                                    <li key={i} className="text-[12px] flex items-start gap-2" style={{ color: COMPLIANCE.body }}>
                                        <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: w.severity === "error" ? "#C23B3B" : w.severity === "warning" ? "#A8700A" : COMPLIANCE.muted }} />
                                        <span>{w.message}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}

                    {/* Section cards */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <SectionCard
                            title="B2B — Indian registered"
                            count={data.prep.sections.b2b.count}
                            taxablePaise={data.prep.sections.b2b.taxableValue_paise}
                            taxPaise={data.prep.sections.b2b.taxTotal_paise}
                            empty={data.prep.sections.b2b.count === 0}
                            description="Invoices with client GSTIN. Portal section: B2B."
                        />
                        <SectionCard
                            title="B2CS — Indian unregistered"
                            count={data.prep.sections.b2cs.count}
                            taxablePaise={data.prep.sections.b2cs.taxableValue_paise}
                            taxPaise={data.prep.sections.b2cs.taxTotal_paise}
                            empty={data.prep.sections.b2cs.count === 0}
                            description="Consolidated by rate + place of supply. Portal section: B2C(small)."
                        />
                        <SectionCard
                            title="Exports"
                            count={data.prep.sections.exp.count}
                            taxablePaise={data.prep.sections.exp.taxableValue_paise}
                            taxPaise={data.prep.sections.exp.taxTotal_paise}
                            empty={data.prep.sections.exp.count === 0}
                            description={data.prep.lut_active
                                ? "Zero-rated under LUT (WOPAY). Portal section: 6A Exports."
                                : "LUT not active — IGST charged (WPAY). Portal section: 6A Exports."}
                            tone={data.prep.lut_active ? "success" : "warn"}
                        />
                        <SectionCard
                            title="HSN summary"
                            count={data.prep.sections.hsn.rows.length}
                            taxablePaise={data.prep.totals.totalTaxableValue_paise}
                            taxPaise={data.prep.totals.totalCgst_paise + data.prep.totals.totalSgst_paise + data.prep.totals.totalIgst_paise}
                            empty={data.prep.sections.hsn.rows.length === 0}
                            description="Aggregated by SAC + rate. Portal section: HSN summary."
                        />
                    </div>

                    {/* Upload guide */}
                    <Card>
                        <div className="flex items-center gap-2 mb-3">
                            <FileText size={15} style={{ color: COMPLIANCE.accent }} />
                            <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>Upload on the portal — 4 steps</p>
                        </div>
                        <ol className="flex flex-col gap-2.5 mt-2">
                            {[
                                { n: 1, t: "Download the JSON above", d: "Save the file locally — system already filtered the right invoices + classification per the GSTN spec." },
                                { n: 2, t: "Open the GST Offline Tool", d: "GSTN-provided utility (free) — import the JSON file. Validates structure offline before upload." },
                                { n: 3, t: "Upload to gst.gov.in", d: "Returns Dashboard → Quarter → GSTR-1 → Upload → select the file the offline tool generated." },
                                { n: 4, t: "Generate Summary → File → OTP", d: "Verify totals match this page → File with OTP → save the ARN → 'Mark filed' in Compliance Calendar." },
                            ].map((s) => (
                                <li key={s.n} className="flex gap-3">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
                                        style={{ background: COMPLIANCE.accentSoft, color: COMPLIANCE.accent }}>
                                        {s.n}
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold" style={{ color: COMPLIANCE.ink }}>{s.t}</p>
                                        <p className="text-[12px] mt-0.5" style={{ color: COMPLIANCE.muted }}>{s.d}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-4 pt-4 border-t flex items-start gap-2" style={{ borderColor: COMPLIANCE.hairline }}>
                            <Lock size={12} style={{ color: COMPLIANCE.muted }} className="mt-0.5 shrink-0" />
                            <p className="text-[11px] leading-relaxed" style={{ color: COMPLIANCE.muted }}>
                                Honest disclaimer: GSTN spec is well-documented but small format drift happens. First upload after deploy is the real test — if the offline tool rejects, share the message and we'll patch the JSON shape.
                            </p>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}

function SectionCard({ title, count, taxablePaise, taxPaise, empty, description, tone = "accent" }: {
    title: string; count: number; taxablePaise: number; taxPaise: number;
    empty: boolean; description: string; tone?: "accent" | "warn" | "success";
}) {
    return (
        <Card>
            <div className="flex items-center justify-between mb-2">
                <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>{title}</p>
                <Badge tone={empty ? "neutral" : tone}>
                    {empty ? "empty" : `${count} row${count === 1 ? "" : "s"}`}
                </Badge>
            </div>
            <p className="text-[11px] mb-3" style={{ color: COMPLIANCE.muted }}>{description}</p>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: COMPLIANCE.hairline }}>
                <div>
                    <SectionLabel>Taxable</SectionLabel>
                    <p className="text-sm font-semibold mt-1 tabular-nums" style={{ color: COMPLIANCE.ink }}>
                        {empty ? "—" : formatINR(taxablePaise)}
                    </p>
                </div>
                <div>
                    <SectionLabel>Tax</SectionLabel>
                    <p className="text-sm font-semibold mt-1 tabular-nums" style={{ color: COMPLIANCE.ink }}>
                        {empty ? "—" : formatINR(taxPaise)}
                    </p>
                </div>
            </div>
        </Card>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — GSTR-3B PREP
// ════════════════════════════════════════════════════════════════════════════

interface GSTR3BResponse {
    summary: {
        period: string; period_start: string; period_end: string;
        business_gstin: string; generated_at: string;
        s3_1_a: { taxable_paise: number; igst: number; cgst: number; sgst: number; cess: number };
        s3_1_b: { taxable_paise: number; igst: number; cess: number };
        s3_1_c: { taxable_paise: number };
        s3_1_d: { taxable_paise: number; igst: number; cgst: number; sgst: number; cess: number };
        s3_1_e: { taxable_paise: number };
        s4_a_total: number;
        s4_a_breakup: { imports: number; rcm: number; isd: number; other_itc: number };
        s4_b_reversed: number;
        s4_c_net: number;
        output_tax_total: number;
        net_payable: number;
        invoiceCount: number; expenseCount: number; itcClaimableCount: number;
        warnings: string[];
    };
}

function Gstr3bPrepPanel() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [data, setData] = useState<GSTR3BResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const load = () => {
        setLoading(true);
        setError(null);
        fetch(`/api/compliance/gstr3b?year=${year}&month=${month}`)
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, [year, month]);

    if (error) return <ErrorBlock message={error} onRetry={load} />;

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const YEARS = [2026, 2027, 2028, 2029, 2030];

    return (
        <div>
            <Card className="mb-4">
                <div className="flex items-end gap-4">
                    <Field label="Year">
                        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                            className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                            style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink, minWidth: 100 }}>
                            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </Field>
                    <Field label="Month">
                        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                            className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                            style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink, minWidth: 120 }}>
                            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                    </Field>
                    <p className="text-[11px] ml-auto" style={{ color: COMPLIANCE.muted }}>
                        Due: 20th of {MONTHS[month % 12]} {month === 12 ? year + 1 : year}
                    </p>
                </div>
            </Card>

            {loading && <LoadingBlock label="Building return…" />}

            {!loading && data && (
                <>
                    {/* Headline tile */}
                    <Card className="mb-4">
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <SectionLabel>Period</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>{data.summary.period}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                    {data.summary.invoiceCount} invoice(s), {data.summary.itcClaimableCount} ITC claim(s)
                                </p>
                            </div>
                            <div>
                                <SectionLabel>Output tax</SectionLabel>
                                <p className="font-serif mt-1 tabular-nums" style={{ fontSize: "1.4rem", color: COMPLIANCE.ink, lineHeight: 1 }}>
                                    {formatINR(data.summary.output_tax_total)}
                                </p>
                            </div>
                            <div>
                                <SectionLabel>Net payable (after ITC)</SectionLabel>
                                <p className="font-serif mt-1 tabular-nums" style={{ fontSize: "1.4rem", color: COMPLIANCE.accent, lineHeight: 1 }}>
                                    {formatINR(data.summary.net_payable)}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                    Create challan for this amount on portal
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Warnings */}
                    {data.summary.warnings.length > 0 && (
                        <Card className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={14} style={{ color: "#A8700A" }} />
                                <SectionLabel>Heads up</SectionLabel>
                            </div>
                            <ul className="flex flex-col gap-1.5">
                                {data.summary.warnings.map((w, i) => (
                                    <li key={i} className="text-[12px]" style={{ color: COMPLIANCE.body }}>• {w}</li>
                                ))}
                            </ul>
                        </Card>
                    )}

                    {/* Section 3.1 — Outward */}
                    <Card className="mb-4" padded={false}>
                        <div className="flex items-center gap-2 px-6 pt-5 pb-3">
                            <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>Section 3.1 — Outward supplies + RCM</p>
                        </div>
                        <SectionRow label="3.1(a) Outward taxable (other than zero-rated, nil, exempt)"
                            taxable={data.summary.s3_1_a.taxable_paise}
                            igst={data.summary.s3_1_a.igst} cgst={data.summary.s3_1_a.cgst} sgst={data.summary.s3_1_a.sgst} cess={data.summary.s3_1_a.cess} />
                        <SectionRow label="3.1(b) Outward taxable (zero-rated — exports / SEZ)"
                            taxable={data.summary.s3_1_b.taxable_paise}
                            igst={data.summary.s3_1_b.igst} cess={data.summary.s3_1_b.cess} />
                        <SectionRow label="3.1(c) Other outward (nil-rated, exempt)"
                            taxable={data.summary.s3_1_c.taxable_paise} />
                        <SectionRow label="3.1(d) Inward supplies (reverse charge)"
                            taxable={data.summary.s3_1_d.taxable_paise}
                            igst={data.summary.s3_1_d.igst} cgst={data.summary.s3_1_d.cgst} sgst={data.summary.s3_1_d.sgst} cess={data.summary.s3_1_d.cess} />
                        <SectionRow label="3.1(e) Non-GST outward"
                            taxable={data.summary.s3_1_e.taxable_paise} last />
                    </Card>

                    {/* Section 4 — ITC */}
                    <Card className="mb-4" padded={false}>
                        <div className="flex items-center gap-2 px-6 pt-5 pb-3">
                            <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>Section 4 — Input Tax Credit</p>
                        </div>
                        <SectionRow label="4(A) Total ITC Available"
                            singleValue={data.summary.s4_a_total} singleLabel="Total" />
                        <SectionRow label="4(A)(5) Other ITC (default bucket)"
                            singleValue={data.summary.s4_a_breakup.other_itc} singleLabel="Other ITC" />
                        <SectionRow label="4(B) ITC Reversed"
                            singleValue={data.summary.s4_b_reversed} singleLabel="Reversed" />
                        <SectionRow label="4(C) Net ITC Available (A − B)"
                            singleValue={data.summary.s4_c_net} singleLabel="Net ITC" last />
                    </Card>

                    {/* Upload guide */}
                    <Card>
                        <div className="flex items-center gap-2 mb-3">
                            <ListChecks size={15} style={{ color: COMPLIANCE.accent }} />
                            <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>Type into portal — 5 steps</p>
                        </div>
                        <ol className="flex flex-col gap-2.5 mt-2">
                            {[
                                { n: 1, t: "gst.gov.in → Returns Dashboard → Month → GSTR-3B → Prepare Online", d: "Open the form for this period." },
                                { n: 2, t: "Fill Section 3.1 from the cards above", d: "Each row maps 1-to-1 to a portal field. Use the values shown — they're already in rupees." },
                                { n: 3, t: "Fill Section 4 — Eligible ITC", d: "4(A)(5) Other ITC = the 'Net ITC' value here, OR more granular if your breakup applies." },
                                { n: 4, t: "Compute Liability → Create Challan if owed → Pay", d: "Net payable shown above. Pay via net banking → return to portal → 'Make Payment / Post Credit to Ledger'." },
                                { n: 5, t: "File GSTR-3B → OTP → save ARN → 'Mark filed' in Calendar", d: "Always save the ARN PDF for records." },
                            ].map((s) => (
                                <li key={s.n} className="flex gap-3">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
                                        style={{ background: COMPLIANCE.accentSoft, color: COMPLIANCE.accent }}>
                                        {s.n}
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold" style={{ color: COMPLIANCE.ink }}>{s.t}</p>
                                        <p className="text-[12px] mt-0.5" style={{ color: COMPLIANCE.muted }}>{s.d}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </Card>
                </>
            )}
        </div>
    );
}

// ─── Helper component for the 3B section rows with copy-to-clipboard ──────

function SectionRow({ label, taxable, igst, cgst, sgst, cess, singleValue, singleLabel, last }: {
    label: string;
    taxable?: number; igst?: number; cgst?: number; sgst?: number; cess?: number;
    singleValue?: number; singleLabel?: string;
    last?: boolean;
}) {
    const items: { l: string; v: number }[] = [];
    if (taxable !== undefined) items.push({ l: "Taxable", v: taxable });
    if (igst !== undefined) items.push({ l: "IGST", v: igst });
    if (cgst !== undefined) items.push({ l: "CGST", v: cgst });
    if (sgst !== undefined) items.push({ l: "SGST", v: sgst });
    if (cess !== undefined) items.push({ l: "Cess", v: cess });
    if (singleValue !== undefined && singleLabel) items.push({ l: singleLabel, v: singleValue });

    const allZero = items.every((it) => it.v === 0);

    return (
        <div
            className="px-6 py-3.5 border-t"
            style={{ borderColor: COMPLIANCE.hairline, borderBottom: last ? `1px solid ${COMPLIANCE.hairline}` : undefined }}
        >
            <p className="text-[12px] font-semibold mb-2" style={{ color: allZero ? COMPLIANCE.muted : COMPLIANCE.ink }}>{label}</p>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
                {items.map((it) => (
                    <CopyableValue key={it.l} label={it.l} paise={it.v} dim={allZero} />
                ))}
            </div>
        </div>
    );
}

function CopyableValue({ label, paise, dim }: { label: string; paise: number; dim?: boolean }) {
    const [copied, setCopied] = useState(false);
    const rupees = paise / 100;
    const display = rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(rupees.toFixed(2));
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        } catch { /* ignore */ }
    };

    return (
        <button
            onClick={copy}
            disabled={paise === 0}
            className="text-left rounded-lg px-3 py-2 transition-all disabled:cursor-default group"
            style={{
                background: copied ? COMPLIANCE.accentSoft : "transparent",
                border: `1px solid ${copied ? COMPLIANCE.accent : COMPLIANCE.hairline}`,
            }}
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: dim ? COMPLIANCE.muted : COMPLIANCE.muted }}>{label}</span>
                {paise > 0 && (
                    copied
                        ? <Check size={11} style={{ color: COMPLIANCE.accent }} />
                        : <Copy size={11} style={{ color: COMPLIANCE.muted }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>
            <p className="text-sm font-semibold mt-1 tabular-nums"
                style={{ color: dim ? COMPLIANCE.muted : COMPLIANCE.ink }}>
                ₹{display}
            </p>
        </button>
    );
}
