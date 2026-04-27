"use client";

// ─── HANDOVER VIEW (Phase 6 — client) ───────────────────────────────────────
// Client surface for final payment + handover package consumption.
//   1. Pay final 40% via Razorpay
//   2. Wait for admin to mark deployed + upload handover
//   3. View / download the handover package

import React from "react";
import { motion } from "framer-motion";
import {
    CheckCircle2, Circle, Clock, Rocket, Package, ExternalLink, Lock, Download,
} from "lucide-react";
import RazorpayCheckout from "@/components/ui/RazorpayCheckout";
import { CURRENCY_SYMBOL, paymentAmountFor } from "@/lib/phases/constants";

interface DealBare {
    token: string;
    name: string;
    company: string;
    phase: number;
    totalPrice?: number;
    payments?: { phase: number; status: string; amount: number; paidAt?: number; sessionId?: string; orderId?: string }[];
    phaseData?: any;
}

interface Props {
    deal: DealBare;
    onUpdated: (deal: DealBare) => void;
}

export default function HandoverView({ deal, onUpdated }: Props) {
    const p6 = deal.phaseData?.phase6 || {};
    const finalInvoiceAmount: number = p6.finalInvoiceAmount
        || (deal.totalPrice ? paymentAmountFor(deal.totalPrice, 6) : 0);
    const finalPayment = (deal.payments || []).find(p => p.phase === 6);
    const finalPaid = !!p6.finalPaidAt;
    const deployed = !!p6.deployedAt;
    const handoverDelivered = !!p6.handoverDeliveredAt;
    const pkg = p6.handoverPackage;

    const refreshDeal = async () => {
        const res = await fetch(`/api/deals?token=${deal.token}`);
        if (res.ok) onUpdated(await res.json());
    };

    return (
        <div className="max-w-2xl mx-auto py-2 px-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#F59E0B] font-bold mb-2">HANDOVER · Phase 6</p>
                <h1 className="font-serif text-3xl text-white tracking-tight">Final mile</h1>
                <p className="text-white/55 text-sm mt-2 leading-relaxed">
                    Settle the final invoice. Once paid, your build goes live and we deliver the full handover package — built summary, how-to guide, credentials, architecture, support contact.
                </p>
            </motion.div>

            {/* Progress strip */}
            <div className="grid grid-cols-3 gap-2 mb-8">
                <ProgressDot label="Pay final" cleared={finalPaid} />
                <ProgressDot label="Deploy live" cleared={deployed} />
                <ProgressDot label="Receive handover" cleared={handoverDelivered} />
            </div>

            {/* Final payment */}
            <Section step={1} title="Pay final invoice" done={finalPaid}>
                <RazorpayCheckout
                    token={deal.token}
                    paymentPhase={6}
                    amount={finalInvoiceAmount}
                    label="Final 40% — unlock deploy + handover"
                    description="Once we receive this, your build goes live in production and the full handover package is delivered."
                    clientName={deal.name}
                    isPaid={finalPaid}
                    paidAt={finalPayment?.paidAt}
                    onPaid={refreshDeal}
                />
            </Section>

            {/* Deploy status */}
            <Section step={2} title="Production deploy" done={deployed} locked={!finalPaid}>
                {!finalPaid ? (
                    <LockedCard text="Production deploy unlocks once the final payment clears." />
                ) : deployed ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 flex items-center gap-3">
                        <Rocket size={16} className="text-emerald-400 shrink-0" />
                        <div>
                            <p className="text-emerald-300 text-sm font-semibold">Live in production</p>
                            <p className="text-white/50 text-xs mt-0.5">
                                Deployed {new Date(p6.deployedAt!).toLocaleString("en-IN")}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.04] p-4 flex items-center gap-3">
                        <Clock size={16} className="text-[#F59E0B] shrink-0" />
                        <div>
                            <p className="text-[#F59E0B] text-sm font-semibold">Deploying soon</p>
                            <p className="text-white/55 text-xs mt-0.5">
                                Payment received. The build is being shipped to production now.
                            </p>
                        </div>
                    </div>
                )}
            </Section>

            {/* Handover package */}
            <Section step={3} title="Handover package" done={handoverDelivered} locked={!deployed}>
                {!deployed ? (
                    <LockedCard text="Handover package arrives right after deploy." />
                ) : !handoverDelivered ? (
                    <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.04] p-4 flex items-center gap-3">
                        <Package size={16} className="text-[#F59E0B] shrink-0" />
                        <div>
                            <p className="text-[#F59E0B] text-sm font-semibold">Preparing handover</p>
                            <p className="text-white/55 text-xs mt-0.5">
                                We're packaging up the docs. You'll see them here shortly.
                            </p>
                        </div>
                    </div>
                ) : (
                    <ClientHandoverViewer pkg={pkg} deliveredAt={p6.handoverDeliveredAt!} />
                )}
            </Section>
        </div>
    );
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({ step, title, done, locked, children }: {
    step: number; title: string; done?: boolean; locked?: boolean; children: React.ReactNode;
}) {
    const accent = done ? "#10B981" : locked ? "#475569" : "#11B8EA";
    return (
        <div className="mb-7">
            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border"
                    style={{ background: `${accent}10`, borderColor: `${accent}40`, color: accent }}>
                    {done ? <CheckCircle2 size={14} /> : locked ? <Lock size={12} /> : step}
                </div>
                <h2 className="text-white text-sm font-semibold tracking-tight">{title}</h2>
            </div>
            <div>{children}</div>
        </div>
    );
}

function ProgressDot({ label, cleared }: { label: string; cleared: boolean }) {
    const accent = cleared ? "#10B981" : "#475569";
    return (
        <div className="rounded-lg border bg-white/[0.02] p-2.5 text-center" style={{ borderColor: `${accent}40` }}>
            <div className="flex items-center justify-center mb-1">
                {cleared
                    ? <CheckCircle2 size={14} className="text-emerald-400" />
                    : <Circle size={14} className="text-white/30" />}
            </div>
            <p className="text-[9px] tracking-[0.2em] uppercase font-bold" style={{ color: accent }}>{label}</p>
        </div>
    );
}

function LockedCard({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 flex items-center gap-3 text-white/40">
            <Lock size={14} />
            <span className="text-xs">{text}</span>
        </div>
    );
}

function ClientHandoverViewer({ pkg, deliveredAt }: { pkg: any; deliveredAt: number }) {
    if (!pkg) return null;
    return (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] p-4 space-y-4 text-xs">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-emerald-500/15">
                <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 size={14} />
                    <span className="font-semibold">Delivered {new Date(deliveredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {pkg.downloadUrl && (
                    <a href={pkg.downloadUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold">
                        <Download size={11} /> Download <ExternalLink size={10} />
                    </a>
                )}
            </div>
            <Block label="What was built" value={pkg.builtSummary} />
            <Block label="How to use it" value={pkg.howToUseGuide} mono />
            <Block label="Access credentials" value={pkg.accessCredentials} mono />
            <Block label="Architecture overview" value={pkg.architectureOverview} />
            <Block label="Emergency contact" value={pkg.emergencyContact} />
            <p className="text-white/40 text-[10px] pt-2 border-t border-emerald-500/15">
                Free support window · {pkg.supportWindowDays} days from delivery.
            </p>
        </div>
    );
}

function Block({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
    if (!value) return null;
    return (
        <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1.5 font-bold">{label}</p>
            <pre className={`text-white/85 whitespace-pre-wrap leading-relaxed ${mono ? "font-mono text-[11px]" : ""}`}>
                {value}
            </pre>
        </div>
    );
}
