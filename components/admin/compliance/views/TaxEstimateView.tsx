// ─── TAX ESTIMATE VIEW ─────────────────────────────────────────────────────
// Interactive 44ADA tax engine. Pre-fills real receipts + deductions from DB,
// then recomputes live as you adjust — tax-engine.ts is client-safe (pure).

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Info, CalendarClock, Sparkles } from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, Badge, Field,
    formatINR, formatINRCompact, formatDate, LoadingBlock, ErrorBlock,
} from "../ui";
import { cn } from "@/lib/utils";
import { estimateFYTax, planAdvanceTax } from "@/lib/compliance/tax-engine";
import { DEDUCTION_LIMITS } from "@/lib/compliance/constants";
import type { DeductionStack, IncomeRegime } from "@/lib/compliance/types";

interface RealData {
    fy_label: string;
    regime_preference: IncomeRegime;
    presumptive_scheme: string;
    real: {
        receiptsPaise: number;
        domesticPaise: number;
        exportPaise: number;
        deductions: DeductionStack;
        advanceTaxPaidPaise: number;
    };
}

const DEDUCTION_ROWS: { key: keyof DeductionStack; label: string }[] = [
    { key: "80C", label: "80C — PPF / ELSS / LIC" },
    { key: "80CCD(1B)", label: "80CCD(1B) — NPS Tier 1" },
    { key: "80D", label: "80D — Health insurance" },
    { key: "80TTA", label: "80TTA — Savings interest" },
];

export default function TaxEstimateView() {
    const [real, setReal] = useState<RealData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // editable state (rupees)
    const [receiptsR, setReceiptsR] = useState(0);
    const [ded, setDed] = useState<Record<string, number>>({});
    const [regime, setRegime] = useState<IncomeRegime>("auto");
    const [advancePaidR, setAdvancePaidR] = useState(0);

    const load = () => {
        setError(null);
        fetch("/api/compliance/tax-estimate")
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then((d: RealData) => {
                setReal(d);
                setReceiptsR(Math.round(d.real.receiptsPaise / 100));
                setRegime(d.regime_preference);
                setAdvancePaidR(Math.round(d.real.advanceTaxPaidPaise / 100));
                const initial: Record<string, number> = {};
                for (const row of DEDUCTION_ROWS) {
                    initial[row.key] = Math.round((d.real.deductions[row.key] ?? 0) / 100);
                }
                setDed(initial);
            })
            .catch((e) => setError(e.message));
    };
    useEffect(load, []);

    // live recompute (pure tax-engine — runs client-side)
    const result = useMemo(() => {
        if (!real) return null;
        const deductions: DeductionStack = {};
        for (const row of DEDUCTION_ROWS) {
            deductions[row.key] = (ded[row.key] ?? 0) * 100;
        }
        const est = estimateFYTax({
            receipts_inr_paise: receiptsR * 100,
            deductions,
            regime,
            advance_tax_paid_paise: advancePaidR * 100,
        });
        const plan = planAdvanceTax(est.advance_tax_due_paise, advancePaidR * 100);
        return { est, plan };
    }, [real, receiptsR, ded, regime, advancePaidR]);

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!real || !result) return <LoadingBlock label="Loading tax engine" />;

    const { est, plan } = result;
    const recommendedTax = est.recommended_regime === "old" ? est.tax_old_regime_paise : est.tax_new_regime_paise;
    const isProjected = receiptsR * 100 !== real.real.receiptsPaise;

    return (
        <div>
            <ViewHeader
                eyebrow={`${real.fy_label} · Section ${real.presumptive_scheme}`}
                title="Tax Estimate"
                subtitle="Real receipts + deductions are pre-filled from your records. Adjust any number to project — the engine recomputes instantly. Old vs new regime compared automatically."
            />

            <div className="grid grid-cols-5 gap-4">
                {/* ─── Inputs ─── */}
                <div className="col-span-2 flex flex-col gap-4">
                    <Card>
                        <SectionLabel className="mb-3">Gross receipts (FY)</SectionLabel>
                        <div className="flex items-baseline gap-2 mb-3">
                            <span className="font-serif" style={{ fontSize: "2rem", color: COMPLIANCE.ink }}>
                                {formatINR(receiptsR * 100)}
                            </span>
                            {isProjected && <Badge tone="accent">projected</Badge>}
                        </div>
                        <input
                            type="range" min={0} max={7500000} step={50000}
                            value={receiptsR}
                            onChange={(e) => setReceiptsR(Number(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{
                                background: `linear-gradient(to right, ${COMPLIANCE.accent} ${(receiptsR / 7500000) * 100}%, ${COMPLIANCE.hairline} ${(receiptsR / 7500000) * 100}%)`,
                            }}
                        />
                        <div className="flex justify-between mt-1.5">
                            <span className="text-[10px]" style={{ color: COMPLIANCE.muted }}>₹0</span>
                            <span className="text-[10px]" style={{ color: COMPLIANCE.muted }}>₹75L (44ADA cap)</span>
                        </div>
                        <p className="text-[11px] mt-3" style={{ color: COMPLIANCE.muted }}>
                            Real logged: {formatINR(real.real.receiptsPaise)} · domestic {formatINRCompact(real.real.domesticPaise)} · export {formatINRCompact(real.real.exportPaise)}
                        </p>
                    </Card>

                    <Card>
                        <SectionLabel className="mb-3">Deduction stack (old regime only)</SectionLabel>
                        <div className="flex flex-col gap-3">
                            {DEDUCTION_ROWS.map((row) => {
                                const limit = (DEDUCTION_LIMITS as Record<string, number>)[row.key] ?? Infinity;
                                const val = ded[row.key] ?? 0;
                                return (
                                    <div key={row.key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] font-medium" style={{ color: COMPLIANCE.body }}>{row.label}</span>
                                            <span className="text-[10px]" style={{ color: COMPLIANCE.muted }}>
                                                limit {limit === Infinity ? "—" : formatINRCompact(limit * 100)}
                                            </span>
                                        </div>
                                        <input
                                            type="number" min={0} max={limit === Infinity ? undefined : limit}
                                            value={val || ""}
                                            placeholder="0"
                                            onChange={(e) => {
                                                let v = Number(e.target.value) || 0;
                                                if (limit !== Infinity && v > limit) v = limit;
                                                setDed((p) => ({ ...p, [row.key]: v }));
                                            }}
                                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                            style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[11px] mt-3 pt-3 border-t" style={{ color: COMPLIANCE.muted, borderColor: COMPLIANCE.hairline }}>
                            Stack total: {formatINR(est.deductions_total_paise)} — ignored under new regime.
                        </p>
                    </Card>

                    <Card>
                        <SectionLabel className="mb-3">Regime</SectionLabel>
                        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl" style={{ background: "#F0F2F4" }}>
                            {(["auto", "old", "new"] as IncomeRegime[]).map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRegime(r)}
                                    className={cn("py-2 rounded-lg text-xs font-semibold capitalize transition-all")}
                                    style={regime === r
                                        ? { background: "#fff", color: COMPLIANCE.ink, boxShadow: "0 1px 3px rgba(10,15,30,0.10)" }
                                        : { color: COMPLIANCE.muted }}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3">
                            <Field label="Advance tax already paid">
                                <input
                                    type="number" min={0} value={advancePaidR || ""} placeholder="0"
                                    onChange={(e) => setAdvancePaidR(Number(e.target.value) || 0)}
                                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0C97C4]"
                                    style={{ borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink }}
                                />
                            </Field>
                        </div>
                    </Card>
                </div>

                {/* ─── Results ─── */}
                <div className="col-span-3 flex flex-col gap-4">
                    {/* headline tax */}
                    <Card>
                        <div className="flex items-start justify-between">
                            <div>
                                <SectionLabel>Total tax · {real.fy_label}</SectionLabel>
                                <p className="font-serif leading-none mt-2" style={{ fontSize: "3.2rem", color: COMPLIANCE.accent, letterSpacing: "-0.03em" }}>
                                    {formatINR(recommendedTax)}
                                </p>
                                <p className="text-xs mt-2" style={{ color: COMPLIANCE.body }}>
                                    {(est.effective_tax_rate * 100).toFixed(2)}% effective rate ·
                                    <span className="font-semibold capitalize" style={{ color: COMPLIANCE.ink }}> {est.recommended_regime} regime</span> recommended
                                </p>
                            </div>
                            <TrendingUp size={20} style={{ color: COMPLIANCE.accent }} />
                        </div>

                        {/* deemed income breakdown */}
                        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t" style={{ borderColor: COMPLIANCE.hairline }}>
                            <div>
                                <SectionLabel>Deemed income (50%)</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>{formatINR(est.deemed_income_paise)}</p>
                            </div>
                            <div>
                                <SectionLabel>Taxable (old)</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>{formatINR(est.taxable_income_old_paise)}</p>
                            </div>
                            <div>
                                <SectionLabel>Net payable</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>{formatINR(est.net_payable_paise)}</p>
                            </div>
                        </div>
                    </Card>

                    {/* regime comparison */}
                    <Card>
                        <SectionLabel className="mb-3">Old vs New regime</SectionLabel>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                { name: "Old regime", tax: est.tax_old_regime_paise, taxable: est.taxable_income_old_paise, picked: est.recommended_regime === "old" },
                                { name: "New regime", tax: est.tax_new_regime_paise, taxable: est.taxable_income_new_paise, picked: est.recommended_regime === "new" },
                            ]).map((r) => (
                                <div
                                    key={r.name}
                                    className="rounded-xl p-4 border"
                                    style={{
                                        borderColor: r.picked ? COMPLIANCE.accent : COMPLIANCE.hairline,
                                        background: r.picked ? COMPLIANCE.accentSofter : "#fff",
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold" style={{ color: COMPLIANCE.ink }}>{r.name}</span>
                                        {r.picked && <Badge tone="accent">picked</Badge>}
                                    </div>
                                    <p className="font-serif mt-2" style={{ fontSize: "1.7rem", color: COMPLIANCE.ink }}>{formatINR(r.tax)}</p>
                                    <p className="text-[11px] mt-1" style={{ color: COMPLIANCE.muted }}>on {formatINR(r.taxable)} taxable</p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* advance tax */}
                    <Card>
                        <div className="flex items-center gap-2 mb-3">
                            <CalendarClock size={15} style={{ color: COMPLIANCE.accent }} />
                            <p className="font-serif text-lg" style={{ color: COMPLIANCE.ink }}>Advance tax — single 44ADA installment</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <SectionLabel>Due by</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>{formatDate(plan.due_date)}</p>
                            </div>
                            <div>
                                <SectionLabel>Remaining</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: COMPLIANCE.ink }}>{formatINR(plan.remaining_paise)}</p>
                            </div>
                            <div>
                                <SectionLabel>Countdown</SectionLabel>
                                <p className="text-sm font-semibold mt-1" style={{ color: plan.is_overdue ? "#C23B3B" : COMPLIANCE.ink }}>
                                    {plan.is_overdue ? "Overdue" : `${plan.days_remaining} days`}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* engine notes */}
                    {est.notes.length > 0 && (
                        <Card className="flex flex-col gap-2" >
                            <div className="flex items-center gap-2">
                                <Info size={14} style={{ color: COMPLIANCE.accent }} />
                                <SectionLabel>Engine notes</SectionLabel>
                            </div>
                            {est.notes.map((nt, i) => (
                                <p key={i} className="text-[12px] leading-relaxed" style={{ color: COMPLIANCE.body }}>• {nt}</p>
                            ))}
                        </Card>
                    )}

                    <div className="flex items-start gap-2 px-1">
                        <Sparkles size={13} style={{ color: COMPLIANCE.muted }} className="mt-0.5 shrink-0" />
                        <p className="text-[11px] leading-relaxed" style={{ color: COMPLIANCE.muted }}>
                            Slabs are FY2026-27 estimates (Budget 2025 carry-forward). When the actual budget is confirmed, update <code>lib/compliance/constants.ts</code> and bump RULE_VERSION. This is an informed self-file projection, not professional advice.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
