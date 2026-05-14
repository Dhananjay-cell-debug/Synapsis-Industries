// ─── OVERVIEW VIEW ─────────────────────────────────────────────────────────
// Compliance home: health score, projected tax, next deadlines, factors.

"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Check, X, ArrowUpRight, CalendarClock, AlertTriangle, Sparkles,
} from "lucide-react";
import {
    COMPLIANCE, Card, StatTile, ViewHeader, SectionLabel, Badge,
    formatINR, formatINRCompact, formatDate, daysUntil, LoadingBlock, ErrorBlock,
} from "../ui";
import { cn } from "@/lib/utils";
import type { ComplianceTask, TaxEstimateOutput } from "@/lib/compliance/types";

interface OverviewData {
    fy_label: string;
    profile: {
        legal_name: string; trade_name: string; constitution_type: string;
        gst_status: string; gstin: string | null; gst_application_arn: string | null;
        lut_active: boolean; presumptive_scheme: string; gst_filing_scheme: string;
        income_tax_regime: string; address_state: string;
    };
    health: { score: number; factors: { label: string; ok: boolean; detail: string }[] };
    nextDeadlines: ComplianceTask[];
    overdueCount: number;
    expenseTotals: { total_amount_paise: number; total_gst_paise: number; itc_unclaimed_paise: number; count: number };
    receiptsPaise: number;
    taxEstimate: TaxEstimateOutput;
}

function HealthRing({ score }: { score: number }) {
    const r = 34;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const tone = score >= 70 ? "#0E8A50" : score >= 40 ? COMPLIANCE.accent : "#D98E0C";
    return (
        <div className="relative" style={{ width: 88, height: 88 }}>
            <svg width={88} height={88} className="-rotate-90">
                <circle cx={44} cy={44} r={r} fill="none" stroke={COMPLIANCE.hairline} strokeWidth={7} />
                <motion.circle
                    cx={44} cy={44} r={r} fill="none" stroke={tone} strokeWidth={7} strokeLinecap="round"
                    initial={{ strokeDasharray: `0 ${circ}` }}
                    animate={{ strokeDasharray: `${dash} ${circ}` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif leading-none" style={{ fontSize: "1.6rem", color: COMPLIANCE.ink }}>{score}</span>
                <span className="text-[8px] uppercase tracking-[0.18em]" style={{ color: COMPLIANCE.muted }}>/ 100</span>
            </div>
        </div>
    );
}

export default function OverviewView({ onNavigate }: { onNavigate?: (v: string) => void }) {
    const [data, setData] = useState<OverviewData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setError(null);
        fetch("/api/compliance/overview")
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(e.message));
    };
    useEffect(load, []);

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!data) return <LoadingBlock label="Loading compliance" />;

    const { profile, health, taxEstimate, expenseTotals } = data;
    const gstActive = profile.gst_status === "active" && !!profile.gstin;

    return (
        <div>
            <ViewHeader
                eyebrow={`${data.fy_label} · ${profile.trade_name}`}
                title="Compliance Overview"
                subtitle={`${profile.constitution_type.replace(/_/g, " ")} · ${profile.address_state} · ${profile.presumptive_scheme} presumptive · self-file mode`}
            />

            {/* ─── Top stat row ─── */}
            <div className="grid grid-cols-4 gap-4 mb-4">
                {/* Health */}
                <Card className="flex items-center gap-4">
                    <HealthRing score={health.score} />
                    <div>
                        <SectionLabel>Health Score</SectionLabel>
                        <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>
                            {health.score >= 70 ? "Strong" : health.score >= 40 ? "Building" : "Needs work"}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                            {health.factors.filter((f) => f.ok).length}/{health.factors.length} checks passing
                        </p>
                    </div>
                </Card>

                <StatTile
                    label={`Projected Tax · ${data.fy_label}`}
                    value={formatINRCompact(taxEstimate.tax_old_regime_paise < taxEstimate.tax_new_regime_paise ? taxEstimate.tax_old_regime_paise : taxEstimate.tax_new_regime_paise)}
                    sub={`${taxEstimate.recommended_regime} regime · ${(taxEstimate.effective_tax_rate * 100).toFixed(1)}% effective`}
                    accent
                />
                <StatTile
                    label="Receipts logged"
                    value={formatINRCompact(data.receiptsPaise)}
                    sub={data.receiptsPaise === 0 ? "No paid receipts this FY yet" : "From paid payments + forex"}
                />
                <StatTile
                    label="Expenses logged"
                    value={formatINRCompact(expenseTotals.total_amount_paise)}
                    sub={`${expenseTotals.count} item(s) · ${formatINRCompact(expenseTotals.itc_unclaimed_paise)} ITC unclaimed`}
                />
            </div>

            {/* ─── Deadlines + factors ─── */}
            <div className="grid grid-cols-5 gap-4">
                {/* Next deadlines — wider */}
                <Card className="col-span-3" padded={false}>
                    <div className="flex items-center justify-between px-6 pt-5 pb-3">
                        <div className="flex items-center gap-2">
                            <CalendarClock size={15} style={{ color: COMPLIANCE.accent }} />
                            <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>Next deadlines</p>
                        </div>
                        {data.overdueCount > 0 && (
                            <Badge tone="danger"><AlertTriangle size={10} /> {data.overdueCount} overdue</Badge>
                        )}
                        <button
                            onClick={() => onNavigate?.("calendar")}
                            className="text-[11px] font-semibold flex items-center gap-0.5 hover:gap-1.5 transition-all"
                            style={{ color: COMPLIANCE.accent }}
                        >
                            Full calendar <ArrowUpRight size={12} />
                        </button>
                    </div>
                    <div className="border-t" style={{ borderColor: COMPLIANCE.hairline }}>
                        {data.nextDeadlines.length === 0 ? (
                            <p className="px-6 py-8 text-sm text-center" style={{ color: COMPLIANCE.muted }}>
                                No upcoming deadlines in the next 120 days.
                            </p>
                        ) : (
                            data.nextDeadlines.map((t) => {
                                const d = daysUntil(t.due_date);
                                const urgent = d !== null && d <= 14;
                                return (
                                    <div
                                        key={t.id}
                                        className="flex items-center justify-between px-6 py-3.5 border-b last:border-b-0"
                                        style={{ borderColor: COMPLIANCE.hairline }}
                                    >
                                        <div className="min-w-0 pr-4">
                                            <p className="text-sm font-medium truncate" style={{ color: COMPLIANCE.ink }}>{t.title}</p>
                                            <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>
                                                {formatDate(t.due_date)} · {t.kind}
                                            </p>
                                        </div>
                                        <Badge tone={urgent ? "warn" : "neutral"}>
                                            {d === null ? "—" : d < 0 ? `${-d}d overdue` : d === 0 ? "today" : `${d}d`}
                                        </Badge>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>

                {/* Health factors */}
                <Card className="col-span-2" padded={false}>
                    <div className="flex items-center gap-2 px-6 pt-5 pb-3">
                        <Sparkles size={15} style={{ color: COMPLIANCE.accent }} />
                        <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>What's done</p>
                    </div>
                    <div className="border-t" style={{ borderColor: COMPLIANCE.hairline }}>
                        {health.factors.map((f) => (
                            <div
                                key={f.label}
                                className="flex items-start gap-3 px-6 py-3 border-b last:border-b-0"
                                style={{ borderColor: COMPLIANCE.hairline }}
                            >
                                <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                    style={{ background: f.ok ? "rgba(16,158,90,0.12)" : "#F0F2F4" }}
                                >
                                    {f.ok
                                        ? <Check size={10} style={{ color: "#0E8A50" }} />
                                        : <X size={10} style={{ color: COMPLIANCE.muted }} />}
                                </div>
                                <div>
                                    <p className="text-[13px] font-medium" style={{ color: COMPLIANCE.ink }}>{f.label}</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: COMPLIANCE.muted }}>{f.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* ─── Identity strip ─── */}
            <Card className="mt-4">
                <div className="grid grid-cols-4 gap-6">
                    {[
                        { label: "GST status", value: gstActive ? "Active" : profile.gst_status, tone: gstActive ? "success" : "warn" as const },
                        { label: "GSTIN", value: profile.gstin || (profile.gst_application_arn ? "ARN issued" : "Not set") },
                        { label: "LUT (exports)", value: profile.lut_active ? "Active" : "Not filed", tone: profile.lut_active ? "success" : "neutral" as const },
                        { label: "Filing scheme", value: `${profile.gst_filing_scheme.toUpperCase()} · ${profile.income_tax_regime} regime` },
                    ].map((item) => (
                        <div key={item.label}>
                            <SectionLabel>{item.label}</SectionLabel>
                            <p className="text-sm font-semibold mt-1.5" style={{ color: COMPLIANCE.ink }}>{item.value}</p>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => onNavigate?.("profile")}
                    className={cn("mt-4 text-[11px] font-semibold flex items-center gap-0.5 hover:gap-1.5 transition-all")}
                    style={{ color: COMPLIANCE.accent }}
                >
                    Manage tax profile <ArrowUpRight size={12} />
                </button>
            </Card>
        </div>
    );
}
