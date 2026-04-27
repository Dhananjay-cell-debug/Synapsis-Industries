"use client";

// ─── ORBIT VIEW (Phase 7 — client) ──────────────────────────────────────────
// Client surface for the long-term relationship:
//   - See journey summary + upcoming check-ins
//   - View/accept retainer offer (if sent)
//   - Submit referrals
// Mutations go via PATCH /api/deals/[token]/phase/7 with phaseDataPatch.

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    CheckCircle2, Calendar, Briefcase, UserPlus, Clock, Sparkles, Plus, Heart,
} from "lucide-react";
import { CURRENCY_SYMBOL } from "@/lib/phases/constants";

interface DealBare {
    token: string;
    name: string;
    company: string;
    phase: number;
    totalPrice?: number;
    payments?: { phase: number; status: string; amount: number; paidAt?: number }[];
    phaseData?: any;
}

interface Props {
    deal: DealBare;
    onUpdated: (deal: DealBare) => void;
}

export default function OrbitView({ deal, onUpdated }: Props) {
    const p7 = deal.phaseData?.phase7 || {};
    const checkIns = p7.checkIns || [];
    const referrals = p7.referrals || [];
    const retainer = p7.retainerOffer;
    const startedAt: number | undefined = p7.startedAt;

    const upcoming = checkIns
        .filter((c: any) => !c.completedAt)
        .sort((a: any, b: any) => a.scheduledFor - b.scheduledFor)[0];
    const completedCount = checkIns.filter((c: any) => c.completedAt).length;

    return (
        <div className="max-w-2xl mx-auto py-2 px-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#11B8EA] font-bold mb-2">ORBIT · Phase 7</p>
                <h1 className="font-serif text-3xl text-white tracking-tight">Welcome to the orbit</h1>
                <p className="text-white/55 text-sm mt-2 leading-relaxed">
                    The build is live. Now we keep the relationship warm — periodic check-ins, an open line for support, and an option to make this ongoing.
                </p>
            </motion.div>

            {/* Journey badge */}
            {startedAt && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4 mb-6 flex items-center gap-3">
                    <Sparkles size={16} className="text-emerald-400 shrink-0" />
                    <div>
                        <p className="text-emerald-300 text-sm font-semibold">Live in orbit since {new Date(startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p className="text-white/50 text-xs mt-0.5">{completedCount} check-in{completedCount === 1 ? "" : "s"} completed so far.</p>
                    </div>
                </div>
            )}

            {/* Next check-in */}
            {upcoming && (
                <Section title="Next check-in" icon={<Calendar size={14} />}>
                    <UpcomingCheckIn checkIn={upcoming} />
                </Section>
            )}

            {/* Retainer offer */}
            {retainer?.sentAt && (
                <Section title="Retainer offer" icon={<Briefcase size={14} />}>
                    <ClientRetainerCard retainer={retainer} />
                </Section>
            )}

            {/* Submit a referral */}
            <Section title="Refer someone" icon={<UserPlus size={14} />}>
                <ClientReferralComposer
                    token={deal.token}
                    allReferrals={referrals}
                    onUpdated={onUpdated}
                />
                {referrals.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 font-bold">Your referrals</p>
                        {referrals.map((r: any) => (
                            <div key={r.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-white text-xs font-semibold truncate">
                                        {r.referredName}{r.referredCompany ? ` · ${r.referredCompany}` : ""}
                                    </p>
                                    <p className="text-white/40 text-[10px]">
                                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    </p>
                                </div>
                                {r.converted && (
                                    <span className="text-[10px] tracking-[0.15em] uppercase font-bold px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                                        Converted
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Closing note */}
            <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-3">
                <Heart size={14} className="text-[#11B8EA] shrink-0" />
                <p className="text-white/55 text-xs leading-relaxed">
                    Need anything — a fix, a new idea, a fresh build? Reach me directly through chat. The orbit is open.
                </p>
            </div>
        </div>
    );
}

// ─── Upcoming check-in card ────────────────────────────────────────────────

function UpcomingCheckIn({ checkIn }: { checkIn: any }) {
    const now = Date.now();
    const daysUntil = Math.ceil((checkIn.scheduledFor - now) / (24 * 3600 * 1000));
    const overdue = daysUntil < 0;
    const accent = overdue ? "#F59E0B" : daysUntil <= 7 ? "#11B8EA" : "#94A3B8";
    const labelMap: Record<string, string> = {
        "30d": "30-day check-in", "90d": "90-day check-in", "annual": "Annual check-in", "adhoc": "Scheduled check-in",
    };

    return (
        <div className="rounded-xl border bg-white/[0.02] p-4" style={{ borderColor: `${accent}40` }}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[9px] tracking-[0.3em] uppercase font-bold mb-1" style={{ color: accent }}>
                        {labelMap[checkIn.type] || "Check-in"}
                    </p>
                    <p className="text-white text-sm font-semibold">
                        {new Date(checkIn.scheduledFor).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: accent }}>
                    <Clock size={12} />
                    <span>{overdue ? "scheduled" : daysUntil === 0 ? "today" : `${daysUntil}d`}</span>
                </div>
            </div>
            <p className="text-white/50 text-xs mt-3 leading-relaxed">
                We'll reach out around this date to see how things are running and what's next.
            </p>
        </div>
    );
}

// ─── Client retainer card (read + acknowledge via chat) ────────────────────

function ClientRetainerCard({ retainer }: { retainer: any }) {
    const status: "accepted" | "declined" | "pending" =
        retainer.acceptedAt ? "accepted" : retainer.declinedAt ? "declined" : "pending";
    const accent = status === "accepted" ? "#10B981" : status === "declined" ? "#94A3B8" : "#F59E0B";

    return (
        <div className="rounded-xl border bg-white/[0.02] p-4" style={{ borderColor: `${accent}40` }}>
            <p className="text-[9px] tracking-[0.3em] uppercase font-bold mb-2" style={{ color: accent }}>
                Retainer · {status}
            </p>
            <p className="text-white text-2xl font-bold tabular-nums">
                {CURRENCY_SYMBOL}{retainer.monthlyAmount.toLocaleString("en-IN")}<span className="text-white/40 text-sm font-normal">/month</span>
            </p>
            <p className="text-white/55 text-xs mt-1">
                {retainer.hoursIncluded} hours included per month · ongoing support, fixes, small builds
            </p>
            {status === "pending" && (
                <p className="text-white/45 text-xs mt-3 leading-relaxed">
                    To accept or decline, message me directly via chat. We'll take it from there.
                </p>
            )}
            {status === "accepted" && (
                <div className="mt-3 flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 size={12} />
                    <span>Accepted {new Date(retainer.acceptedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
            )}
        </div>
    );
}

// ─── Client referral composer ──────────────────────────────────────────────

function ClientReferralComposer({ token, allReferrals, onUpdated }: {
    token: string; allReferrals: any[]; onUpdated: (d: DealBare) => void;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [company, setCompany] = useState("");
    const [contact, setContact] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!name.trim()) { setError("Their name is required."); return; }
        setBusy(true); setError(null);
        try {
            const newRef = {
                id: `ref_${Date.now()}`,
                createdAt: Date.now(),
                referredName: name.trim(),
                referredCompany: company.trim() || undefined,
                referredContact: contact.trim() || undefined,
                converted: false,
            };
            const res = await fetch(`/api/deals/${token}/phase/7`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { referrals: [...allReferrals, newRef] },
                    auditAction: "referral.added.client",
                    note: `Client referred: ${name}`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            onUpdated(data.deal);
            setOpen(false); setName(""); setCompany(""); setContact("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="w-full rounded-xl border border-dashed border-[#11B8EA]/30 bg-[#11B8EA]/[0.03] hover:bg-[#11B8EA]/[0.06] text-[#11B8EA] text-sm font-medium py-3 flex items-center justify-center gap-2">
                <Plus size={14} /> Introduce someone who'd benefit
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-[#11B8EA]/30 bg-[#11B8EA]/[0.04] p-3 space-y-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Their name (required)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company (optional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Email or phone (optional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
                <button onClick={submit} disabled={busy}
                    className="flex-1 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold py-2 disabled:opacity-30">
                    {busy ? "Sending…" : "Send introduction"}
                </button>
                <button onClick={() => { setOpen(false); setError(null); }} disabled={busy}
                    className="px-3 rounded-lg border border-white/10 text-white/50 text-xs">Cancel</button>
            </div>
        </div>
    );
}

// ─── Section wrapper ───────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="mb-7">
            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#11B8EA]">
                    {icon}
                </div>
                <h2 className="text-white text-sm font-semibold tracking-tight">{title}</h2>
            </div>
            <div>{children}</div>
        </div>
    );
}
