// ─── GST WORKSPACE VIEW ────────────────────────────────────────────────────
// Live GST treatment classifier. Pure tax-engine runs client-side. On real
// invoices this classification is stamped immutably onto each invoice_tax_snapshot.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, ArrowRight, Lock } from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, Badge, Field,
    formatINR, LoadingBlock, ErrorBlock,
} from "../ui";
import { cn } from "@/lib/utils";
import { classifyGstTreatment } from "@/lib/compliance/tax-engine";
import { STATE_CODES } from "@/lib/compliance/constants";
import type { BusinessTaxProfile, RecipientType } from "@/lib/compliance/types";

const RECIPIENT_TYPES: { value: RecipientType; label: string }[] = [
    { value: "indian_registered", label: "Indian — GST registered (B2B)" },
    { value: "indian_unregistered", label: "Indian — unregistered (B2C)" },
    { value: "international_business", label: "International — business" },
    { value: "international_individual", label: "International — individual" },
];

const STATE_NAMES = Object.keys(STATE_CODES);

export default function GstWorkspaceView() {
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
        <div>
            <ViewHeader
                eyebrow="GST classification engine"
                title="GST Workspace"
                subtitle="Live treatment classifier. Pick a client scenario — the engine decides CGST/SGST vs IGST vs zero-rated export, exactly as it will stamp real invoices."
            />

            <div className="grid grid-cols-5 gap-4">
                {/* ─── Scenario inputs ─── */}
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

                {/* ─── Classification result ─── */}
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
                                { label: "Taxable value", value: result.total_invoice_minor - result.total_tax_minor, strong: false },
                                { label: "CGST", value: result.cgst_amount_minor, strong: false, hide: result.cgst_amount_minor === 0 },
                                { label: "SGST", value: result.sgst_amount_minor, strong: false, hide: result.sgst_amount_minor === 0 },
                                { label: "IGST", value: result.igst_amount_minor, strong: false, hide: result.igst_amount_minor === 0 },
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
                            When you issue a real invoice, this exact classification is computed once and stamped <span className="font-semibold">immutably</span> onto its tax snapshot — so historical tax decisions never silently change, even if rules update later.
                        </p>
                    </div>
                </div>
            </div>

            {/* SAC reference */}
            <Card className="mt-4">
                <SectionLabel className="mb-3">SAC codes — service classification</SectionLabel>
                <div className="grid grid-cols-3 gap-3">
                    {Object.entries({
                        "998313": "IT design & development (Synapsis default)",
                        "998314": "IT infrastructure provisioning",
                        "998315": "IT support / maintenance",
                        "998311": "IT consulting & advisory",
                        "998316": "Data processing services",
                    }).map(([code, label]) => (
                        <div key={code} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: COMPLIANCE.panel }}>
                            <span className="font-mono text-xs font-semibold" style={{ color: COMPLIANCE.accent }}>{code}</span>
                            <ArrowRight size={11} style={{ color: COMPLIANCE.muted }} />
                            <span className="text-[11px]" style={{ color: COMPLIANCE.body }}>{label}</span>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
