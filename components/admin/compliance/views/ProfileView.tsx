// ─── TAX PROFILE VIEW ──────────────────────────────────────────────────────
// Business tax identity — the single source of truth (synapsis.business_tax_profile).
// Edit GSTIN / LUT / regime / address / bank. Updating here drives the whole OS.

"use client";

import React, { useEffect, useState } from "react";
import { Pencil, Save, X, Building2, FileCheck2, Landmark, MapPin } from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, Badge, Button,
    formatDate, LoadingBlock, ErrorBlock,
} from "../ui";
import { cn } from "@/lib/utils";
import type { BusinessTaxProfile } from "@/lib/compliance/types";

type FieldType = "text" | "date" | "bool" | "number" | "select";
interface FieldDef {
    key: keyof BusinessTaxProfile;
    label: string;
    type: FieldType;
    options?: string[];
    editable?: boolean;
    hint?: string;
}

const SECTIONS: { title: string; icon: React.ElementType; fields: FieldDef[] }[] = [
    {
        title: "Identity", icon: Building2, fields: [
            { key: "legal_name", label: "Legal name", type: "text" },
            { key: "trade_name", label: "Trade name", type: "text" },
            { key: "constitution_type", label: "Constitution", type: "select", options: ["sole_proprietorship", "partnership", "llp", "private_limited", "huf", "other"] },
            { key: "pan_last4", label: "PAN (last 4)", type: "text", hint: "Full PAN lives in server env only" },
            { key: "udyam_number", label: "Udyam number", type: "text" },
        ],
    },
    {
        title: "GST & LUT", icon: FileCheck2, fields: [
            { key: "gst_status", label: "GST status", type: "select", options: ["not_applied", "pending", "active", "cancelled", "suspended"] },
            { key: "gstin", label: "GSTIN", type: "text", hint: "15-char — auto-validates format" },
            { key: "gst_application_arn", label: "Application ARN", type: "text", hint: "Paste the ARN while GSTIN is pending" },
            { key: "gst_registration_date", label: "Registration date", type: "date" },
            { key: "lut_active", label: "LUT active", type: "bool" },
            { key: "lut_arn", label: "LUT ARN", type: "text" },
            { key: "lut_valid_until", label: "LUT valid until", type: "date" },
        ],
    },
    {
        title: "Tax scheme", icon: FileCheck2, fields: [
            { key: "presumptive_scheme", label: "Income tax scheme", type: "select", options: ["44ADA", "44AD", "regular"] },
            { key: "income_tax_regime", label: "Regime preference", type: "select", options: ["auto", "old", "new"] },
            { key: "gst_filing_scheme", label: "GST filing scheme", type: "select", options: ["qrmp", "monthly", "composition"] },
            { key: "default_sac_code", label: "Default SAC code", type: "text" },
            { key: "default_gst_rate", label: "Default GST rate (%)", type: "number" },
        ],
    },
    {
        title: "Registered address", icon: MapPin, fields: [
            { key: "address_line1", label: "Address line 1", type: "text" },
            { key: "address_line2", label: "Address line 2", type: "text" },
            { key: "address_city", label: "City", type: "text" },
            { key: "address_state", label: "State", type: "text" },
            { key: "address_pincode", label: "Pincode", type: "text" },
        ],
    },
    {
        title: "Banking", icon: Landmark, fields: [
            { key: "bank_account_type", label: "Account type", type: "select", options: ["savings", "current"] },
            { key: "bank_name", label: "Bank name", type: "text" },
            { key: "bank_account_last4", label: "Account (last 4)", type: "text" },
            { key: "bank_ifsc", label: "IFSC", type: "text" },
        ],
    },
];

export default function ProfileView() {
    const [profile, setProfile] = useState<BusinessTaxProfile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Partial<BusinessTaxProfile>>({});
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);

    const load = () => {
        setError(null);
        fetch("/api/compliance/profile")
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then((p) => { setProfile(p); setDraft(p); })
            .catch((e) => setError(e.message));
    };
    useEffect(load, []);

    const save = async () => {
        if (!profile) return;
        setSaving(true);
        setSaveErr(null);
        // only send changed keys
        const changed: Record<string, unknown> = {};
        const profileRec = profile as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(draft)) {
            if (profileRec[k] !== v) changed[k] = v;
        }
        if (Object.keys(changed).length === 0) {
            setEditing(false); setSaving(false); return;
        }
        try {
            const r = await fetch("/api/compliance/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changed),
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            const updated = await r.json();
            setProfile(updated); setDraft(updated); setEditing(false);
        } catch (e) {
            setSaveErr(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!profile) return <LoadingBlock label="Loading tax profile" />;

    const renderValue = (fd: FieldDef) => {
        const raw = (editing ? draft : profile)[fd.key];
        if (!editing) {
            if (fd.type === "bool") return <Badge tone={raw ? "success" : "neutral"}>{raw ? "Yes" : "No"}</Badge>;
            if (fd.type === "date") return <span>{raw ? formatDate(String(raw)) : "—"}</span>;
            if (raw === null || raw === undefined || raw === "") return <span style={{ color: COMPLIANCE.muted }}>—</span>;
            return <span style={{ color: COMPLIANCE.ink }} className="font-medium">{String(raw).replace(/_/g, " ")}</span>;
        }
        // edit mode
        const setVal = (v: unknown) => setDraft((d) => ({ ...d, [fd.key]: v }));
        const inputCls = "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]";
        const inputStyle = { borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink };
        if (fd.type === "bool") {
            return (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!raw} onChange={(e) => setVal(e.target.checked)}
                        className="w-4 h-4 rounded" style={{ accentColor: COMPLIANCE.accent }} />
                    <span className="text-xs" style={{ color: COMPLIANCE.body }}>{raw ? "Yes" : "No"}</span>
                </label>
            );
        }
        if (fd.type === "select") {
            return (
                <select value={String(raw ?? "")} onChange={(e) => setVal(e.target.value)} className={inputCls} style={inputStyle}>
                    {fd.options!.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                </select>
            );
        }
        return (
            <input
                type={fd.type === "date" ? "date" : fd.type === "number" ? "number" : "text"}
                value={raw === null || raw === undefined ? "" : String(raw)}
                onChange={(e) => setVal(fd.type === "number" ? Number(e.target.value) : e.target.value)}
                className={inputCls} style={inputStyle}
            />
        );
    };

    return (
        <div>
            <ViewHeader
                eyebrow="Single source of truth"
                title="Tax Profile"
                subtitle="Synapsis's tax identity. Updating GSTIN status here re-seeds GST return deadlines. Sensitive identifiers (full PAN, account number) stay in server env."
                action={
                    editing ? (
                        <div className="flex gap-2">
                            <Button onClick={save} disabled={saving}><Save size={15} />{saving ? "Saving…" : "Save"}</Button>
                            <Button variant="ghost" onClick={() => { setDraft(profile); setEditing(false); setSaveErr(null); }}>
                                <X size={15} /> Cancel
                            </Button>
                        </div>
                    ) : (
                        <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={14} /> Edit profile</Button>
                    )
                }
            />

            {saveErr && (
                <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(214,69,69,0.08)", color: "#C23B3B" }}>
                    {saveErr}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                {SECTIONS.map((sec) => (
                    <Card key={sec.title} className={cn(sec.title === "GST & LUT" && "row-span-2")}>
                        <div className="flex items-center gap-2 mb-4">
                            <sec.icon size={15} style={{ color: COMPLIANCE.accent }} />
                            <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>{sec.title}</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            {sec.fields.map((fd) => (
                                <div key={String(fd.key)} className="grid grid-cols-[140px_1fr] gap-3 items-center">
                                    <SectionLabel>{fd.label}</SectionLabel>
                                    <div className="text-sm">{renderValue(fd)}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
