"use client";

// ─── HANDOVER ADMIN VIEW (Phase 6) ──────────────────────────────────────────
// Three-gate compound trigger to advance to Phase 7 (ORBIT):
//   1. Final 40% payment captured (webhook OR manual override)
//   2. Production deployment marked
//   3. Handover package uploaded
// When all three fire, admin clicks "Advance to Orbit" → tryAdvanceToOrbit transition.

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    CheckCircle2, Circle, AlertCircle, Rocket, Package, CreditCard,
    ExternalLink, FileText, Lock, Send,
} from "lucide-react";
import { CURRENCY_SYMBOL, HANDOVER_SUPPORT_DAYS } from "@/lib/phases/constants";

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
    adminEmail: string;
    onUpdated: (deal: DealBare) => void;
}

export default function HandoverAdminView({ deal, adminEmail, onUpdated }: Props) {
    const p6 = deal.phaseData?.phase6 || {};
    const finalInvoiceAmount: number = p6.finalInvoiceAmount || 0;
    const finalPaidAt: number | undefined = p6.finalPaidAt;
    const deployedAt: number | undefined = p6.deployedAt;
    const handoverDeliveredAt: number | undefined = p6.handoverDeliveredAt;
    const handoverPkg = p6.handoverPackage;

    const allGatesCleared = !!finalPaidAt && !!deployedAt && !!handoverDeliveredAt;

    return (
        <div className="max-w-3xl mx-auto py-2 px-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#F59E0B] font-bold mb-2">HANDOVER · Phase 6</p>
                <h1 className="font-serif text-3xl text-white tracking-tight">{deal.name} · {deal.company}</h1>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                    Three sub-gates must clear before this graduates to Orbit: final payment, production deploy, and handover package delivery.
                </p>
            </motion.div>

            {/* Gate strip */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                <Gate label="Final payment" cleared={!!finalPaidAt} icon={<CreditCard size={14} />} />
                <Gate label="Deployed" cleared={!!deployedAt} icon={<Rocket size={14} />} />
                <Gate label="Handover" cleared={!!handoverDeliveredAt} icon={<Package size={14} />} />
            </div>

            {/* Final invoice / payment status */}
            <Section title="Final invoice" icon={<CreditCard size={14} />}>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                            <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1">Amount due</p>
                            <p className="text-2xl font-bold text-white tabular-nums">
                                {CURRENCY_SYMBOL}{finalInvoiceAmount.toLocaleString("en-IN")}
                            </p>
                            <p className="text-white/40 text-[10px] mt-0.5">
                                40% remaining · auto-computed from total minus paid
                            </p>
                        </div>
                        {finalPaidAt ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                                <CheckCircle2 size={12} /> Paid
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                                <AlertCircle size={12} /> Awaiting client
                            </span>
                        )}
                    </div>
                    {!finalPaidAt && (
                        <ManualMarkPaid token={deal.token} adminEmail={adminEmail} onUpdated={onUpdated} />
                    )}
                    {finalPaidAt && (
                        <p className="text-emerald-300/70 text-xs">
                            Captured {new Date(finalPaidAt).toLocaleString("en-IN")}.
                        </p>
                    )}
                </div>
            </Section>

            {/* Mark Deployed */}
            <Section title="Production deploy" icon={<Rocket size={14} />}>
                {deployedAt ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <div>
                            <p className="text-emerald-300 text-sm font-semibold">Deployed</p>
                            <p className="text-white/50 text-xs mt-0.5">
                                Marked deployed on {new Date(deployedAt).toLocaleString("en-IN")}
                            </p>
                        </div>
                    </div>
                ) : (
                    <MarkDeployed
                        token={deal.token}
                        adminEmail={adminEmail}
                        canDeploy={!!finalPaidAt}
                        onUpdated={onUpdated}
                    />
                )}
            </Section>

            {/* Handover Package */}
            <Section title="Handover package" icon={<Package size={14} />}>
                {handoverDeliveredAt && handoverPkg ? (
                    <HandoverViewer pkg={handoverPkg} deliveredAt={handoverDeliveredAt} />
                ) : (
                    <HandoverComposer
                        token={deal.token}
                        adminEmail={adminEmail}
                        canUpload={!!finalPaidAt}
                        onUpdated={onUpdated}
                    />
                )}
            </Section>

            {/* Advance to Orbit */}
            <div className="mt-8">
                <AdvanceToOrbit
                    token={deal.token}
                    cleared={allGatesCleared}
                    finalPaid={!!finalPaidAt}
                    deployed={!!deployedAt}
                    handoverDelivered={!!handoverDeliveredAt}
                    onUpdated={onUpdated}
                />
            </div>
        </div>
    );
}

// ─── Gate strip box ─────────────────────────────────────────────────────────

function Gate({ label, cleared, icon }: { label: string; cleared: boolean; icon: React.ReactNode }) {
    const accent = cleared ? "#10B981" : "#F59E0B";
    return (
        <div className="rounded-xl border bg-white/[0.02] p-3" style={{ borderColor: `${accent}30` }}>
            <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] tracking-[0.3em] uppercase text-white/40">{label}</p>
                {cleared
                    ? <CheckCircle2 size={12} className="text-emerald-400" />
                    : <Circle size={12} className="text-amber-400" />}
            </div>
            <div className="flex items-center gap-1.5" style={{ color: accent }}>
                {icon}
                <span className="text-xs font-semibold">{cleared ? "Cleared" : "Pending"}</span>
            </div>
        </div>
    );
}

// ─── Manual mark paid (for offline transfers, etc.) ─────────────────────────

function ManualMarkPaid({ token, adminEmail, onUpdated }: { token: string; adminEmail: string; onUpdated: (d: DealBare) => void }) {
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState("");
    const [paymentId, setPaymentId] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (note.trim().length < 10) {
            setError("Note must be ≥10 chars (e.g. 'Wire received from CFO Anjali on 24 Apr').");
            return;
        }
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/deals/${token}/phase/6`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "finalPaid",
                    ctx: {
                        source: "manual",
                        paymentId: paymentId.trim() || undefined,
                        note: note.trim(),
                        adminEmail,
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            onUpdated(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="w-full text-left text-xs text-white/50 hover:text-white/80 underline">
                Manual override · mark final payment as received
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3 space-y-2">
            <p className="text-[9px] tracking-[0.3em] uppercase text-amber-300 font-bold">Manual mark paid</p>
            <input value={paymentId} onChange={e => setPaymentId(e.target.value)} placeholder="Payment reference / transaction ID (optional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40" />
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Audit note (≥10 chars) — how was payment received?"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40 resize-none" />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
                <button onClick={submit} disabled={busy}
                    className="flex-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold py-2 disabled:opacity-30">
                    {busy ? "Saving…" : "Mark paid"}
                </button>
                <button onClick={() => { setOpen(false); setError(null); }} disabled={busy}
                    className="px-3 rounded-lg border border-white/10 text-white/50 text-xs">Cancel</button>
            </div>
        </div>
    );
}

// ─── Mark deployed ──────────────────────────────────────────────────────────

function MarkDeployed({ token, adminEmail, canDeploy, onUpdated }: {
    token: string; adminEmail: string; canDeploy: boolean; onUpdated: (d: DealBare) => void;
}) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/deals/${token}/phase/6`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "markDeployed",
                    ctx: { adminEmail, note: note.trim() || undefined },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            onUpdated(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(false);
        }
    };

    if (!canDeploy) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-3 text-white/40">
                <Lock size={14} />
                <span className="text-xs">Final payment must clear before you can mark deployed.</span>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-[#3B6AE8]/30 bg-[#3B6AE8]/[0.04] p-4 space-y-3">
            <p className="text-white/70 text-xs leading-relaxed">
                Confirm production is live, monitoring is wired, and the client can hit the deployed URL.
            </p>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Deployment note (URL, env, anything worth recording)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3B6AE8]/40" />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button onClick={submit} disabled={busy}
                className="w-full rounded-lg bg-[#3B6AE8]/20 border border-[#3B6AE8]/50 text-[#3B6AE8] hover:text-white text-xs font-semibold py-2.5 flex items-center justify-center gap-2 disabled:opacity-30">
                <Rocket size={12} /> {busy ? "Marking…" : "Mark deployed"}
            </button>
        </div>
    );
}

// ─── Handover composer ──────────────────────────────────────────────────────

function HandoverComposer({ token, adminEmail, canUpload, onUpdated }: {
    token: string; adminEmail: string; canUpload: boolean; onUpdated: (d: DealBare) => void;
}) {
    const [builtSummary, setBuiltSummary] = useState("");
    const [howTo, setHowTo] = useState("");
    const [creds, setCreds] = useState("");
    const [arch, setArch] = useState("");
    const [emergency, setEmergency] = useState("");
    const [downloadUrl, setDownloadUrl] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (builtSummary.trim().length < 30) {
            setError("Built summary too thin — describe what was actually delivered.");
            return;
        }
        if (howTo.trim().length < 30) {
            setError("How-to guide too thin — give the client a real walkthrough.");
            return;
        }
        if (!emergency.trim()) {
            setError("Emergency contact is required.");
            return;
        }
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/deals/${token}/phase/6`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "uploadHandover",
                    ctx: {
                        adminEmail,
                        handoverPackage: {
                            builtSummary: builtSummary.trim(),
                            howToUseGuide: howTo.trim(),
                            accessCredentials: creds.trim(),
                            architectureOverview: arch.trim(),
                            emergencyContact: emergency.trim(),
                            supportWindowDays: HANDOVER_SUPPORT_DAYS,
                            downloadUrl: downloadUrl.trim() || undefined,
                        },
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            onUpdated(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(false);
        }
    };

    if (!canUpload) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-3 text-white/40">
                <Lock size={14} />
                <span className="text-xs">Handover package can only be sent after final payment clears.</span>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-[#11B8EA]/30 bg-[#11B8EA]/[0.03] p-4 space-y-3">
            <Field label="Built summary" hint="What did this project actually deliver? (≥30 chars)">
                <textarea value={builtSummary} onChange={e => setBuiltSummary(e.target.value)}
                    rows={3} placeholder="One paragraph. What system you built, what it does, key metrics."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-none" />
            </Field>
            <Field label="How-to use guide" hint="Markdown ok. Walk them through the daily flow.">
                <textarea value={howTo} onChange={e => setHowTo(e.target.value)}
                    rows={4} placeholder="## Daily flow&#10;1. Open dashboard at…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-none font-mono" />
            </Field>
            <Field label="Access credentials" hint="Logins, API keys, dashboard URLs. (V1: plain text — V2 vault.)">
                <textarea value={creds} onChange={e => setCreds(e.target.value)}
                    rows={3} placeholder="Admin: admin@…&#10;DB: postgres://…&#10;Vercel project: …"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-none font-mono" />
            </Field>
            <Field label="Architecture overview" hint="Where things live, how they connect.">
                <textarea value={arch} onChange={e => setArch(e.target.value)}
                    rows={3} placeholder="Frontend on Vercel · DB on Supabase · Razorpay webhook routes via …"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-none" />
            </Field>
            <Field label="Emergency contact" hint="How they reach you in a fire.">
                <input value={emergency} onChange={e => setEmergency(e.target.value)}
                    placeholder="dhananjaychitmila@gmail.com · WhatsApp +91 8652106713"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            </Field>
            <Field label="Download URL (optional)" hint="Zip / PDF with full handover docs.">
                <input value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            </Field>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button onClick={submit} disabled={busy}
                className="w-full rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] hover:text-white text-xs font-semibold py-2.5 flex items-center justify-center gap-2 disabled:opacity-30">
                <Send size={12} /> {busy ? "Delivering…" : "Deliver handover package"}
            </button>
            <p className="text-white/40 text-[10px] text-center">
                Includes a {HANDOVER_SUPPORT_DAYS}-day support window starting today.
            </p>
        </div>
    );
}

// ─── Handover viewer (post-delivery) ────────────────────────────────────────

function HandoverViewer({ pkg, deliveredAt }: { pkg: any; deliveredAt: number }) {
    return (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] p-4 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 mb-1">
                <CheckCircle2 size={14} />
                <span className="font-semibold">Delivered {new Date(deliveredAt).toLocaleString("en-IN")}</span>
            </div>
            <FieldDisplay label="Built summary" value={pkg.builtSummary} />
            <FieldDisplay label="How-to guide" value={pkg.howToUseGuide} mono />
            <FieldDisplay label="Access credentials" value={pkg.accessCredentials} mono />
            <FieldDisplay label="Architecture overview" value={pkg.architectureOverview} />
            <FieldDisplay label="Emergency contact" value={pkg.emergencyContact} />
            {pkg.downloadUrl && (
                <a href={pkg.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#11B8EA] hover:text-[#11B8EA]/80 underline">
                    Download full package <ExternalLink size={10} />
                </a>
            )}
            <p className="text-white/40 text-[10px]">Support window: {pkg.supportWindowDays} days</p>
        </div>
    );
}

// ─── Advance to Orbit gate ──────────────────────────────────────────────────

function AdvanceToOrbit({ token, cleared, finalPaid, deployed, handoverDelivered, onUpdated }: {
    token: string; cleared: boolean; finalPaid: boolean; deployed: boolean; handoverDelivered: boolean;
    onUpdated: (d: DealBare) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const advance = async () => {
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/deals/${token}/phase/6`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "tryAdvanceToOrbit" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Cannot advance yet");
            onUpdated(data.deal);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(false);
        }
    };

    if (!cleared) {
        const blockers = [
            !finalPaid && "final payment",
            !deployed && "deploy",
            !handoverDelivered && "handover package",
        ].filter(Boolean);
        return (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-4 flex items-center gap-3 text-white/40">
                <Lock size={14} />
                <span className="text-xs">
                    Orbit unlocks when all three sub-gates clear. Pending: {blockers.join(", ")}.
                </span>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 space-y-3">
            <p className="text-emerald-300 text-sm font-semibold">All three gates cleared.</p>
            <p className="text-white/60 text-xs leading-relaxed">
                Advance this deal to Phase 7 — Orbit. Long-term relationship begins: 30/90/365-day check-ins, retainer offer, referral tracking.
            </p>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button onClick={advance} disabled={busy}
                className="w-full rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 hover:text-white text-sm font-semibold py-3 flex items-center justify-center gap-2 disabled:opacity-30">
                <Rocket size={14} /> {busy ? "Advancing…" : "Advance to Orbit"}
            </button>
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#11B8EA]">
                    {icon}
                </div>
                <h2 className="text-white text-sm font-semibold tracking-tight">{title}</h2>
            </div>
            <div>{children}</div>
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[9px] tracking-[0.25em] uppercase text-white/50 font-bold">{label}</label>
            {hint && <p className="text-white/35 text-[10px] mt-0.5 mb-1.5">{hint}</p>}
            {children}
        </div>
    );
}

function FieldDisplay({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    if (!value) return null;
    return (
        <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1 font-bold">{label}</p>
            <pre className={`text-white/80 whitespace-pre-wrap leading-relaxed ${mono ? "font-mono text-[11px]" : ""}`}>
                {value}
            </pre>
        </div>
    );
}
