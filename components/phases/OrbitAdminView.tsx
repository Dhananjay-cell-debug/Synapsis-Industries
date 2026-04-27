"use client";

// ─── ORBIT ADMIN VIEW (Phase 7) ─────────────────────────────────────────────
// Long-term relationship surface: check-ins, retainer offer, referral tracking.
// All mutations go via PATCH /api/deals/[token]/phase/7 with phaseDataPatch.

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    CheckCircle2, Circle, Clock, Calendar, UserPlus, Briefcase, Send,
    AlertCircle, ChevronDown, ChevronUp, X, Plus,
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

interface CheckIn {
    id: string;
    type: "30d" | "90d" | "annual" | "adhoc";
    scheduledFor: number;
    completedAt?: number;
    notes?: string;
    clientFeedback?: string;
}
interface Referral {
    id: string;
    createdAt: number;
    referredName: string;
    referredCompany?: string;
    referredContact?: string;
    converted: boolean;
    convertedDealToken?: string;
}

interface Props {
    deal: DealBare;
    adminEmail: string;
    onUpdated: (deal: DealBare) => void;
}

export default function OrbitAdminView({ deal, adminEmail, onUpdated }: Props) {
    const p7 = deal.phaseData?.phase7 || {};
    const checkIns: CheckIn[] = p7.checkIns || [];
    const referrals: Referral[] = p7.referrals || [];
    const retainer = p7.retainerOffer;
    const startedAt: number | undefined = p7.startedAt;

    const completed = checkIns.filter(c => c.completedAt).length;
    const upcoming = checkIns.filter(c => !c.completedAt).sort((a, b) => a.scheduledFor - b.scheduledFor);
    const nextCheckIn = upcoming[0];

    return (
        <div className="max-w-3xl mx-auto py-2 px-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.5em] uppercase text-[#11B8EA] font-bold mb-2">ORBIT · Phase 7</p>
                <h1 className="font-serif text-3xl text-white tracking-tight">{deal.name} · {deal.company}</h1>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                    Long-term relationship. Schedule check-ins, send retainer offers, track referrals — keep the orbit warm.
                </p>
            </motion.div>

            {/* Status strip */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                <StatBox label="Started" value={startedAt ? new Date(startedAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"} accent="#11B8EA" />
                <StatBox label="Check-ins done" value={`${completed} / ${checkIns.length}`} accent="#10B981" />
                <StatBox label="Referrals" value={`${referrals.length} (${referrals.filter(r => r.converted).length} converted)`} accent="#3B6AE8" />
            </div>

            {/* Next check-in highlight */}
            {nextCheckIn && (
                <NextCheckInCard checkIn={nextCheckIn} />
            )}

            {/* Check-ins */}
            <Section title="Check-ins" icon={<Calendar size={14} />}>
                <div className="space-y-2 mb-3">
                    {checkIns.length === 0 ? (
                        <EmptyState text="No check-ins scheduled yet." />
                    ) : (
                        [...checkIns].sort((a, b) => a.scheduledFor - b.scheduledFor).map(c => (
                            <CheckInRow key={c.id} checkIn={c} token={deal.token} adminEmail={adminEmail}
                                allCheckIns={checkIns} onUpdated={onUpdated} />
                        ))
                    )}
                </div>
                <AdHocCheckInComposer token={deal.token} adminEmail={adminEmail}
                    allCheckIns={checkIns} onUpdated={onUpdated} />
            </Section>

            {/* Retainer */}
            <Section title="Retainer offer" icon={<Briefcase size={14} />}>
                <RetainerPanel retainer={retainer} token={deal.token} adminEmail={adminEmail} onUpdated={onUpdated} />
            </Section>

            {/* Referrals */}
            <Section title="Referrals" icon={<UserPlus size={14} />}>
                <div className="space-y-2 mb-3">
                    {referrals.length === 0 ? (
                        <EmptyState text="No referrals yet. Drop a hint at the next check-in." />
                    ) : (
                        referrals.map(r => (
                            <ReferralRow key={r.id} referral={r} token={deal.token} adminEmail={adminEmail}
                                allReferrals={referrals} onUpdated={onUpdated} />
                        ))
                    )}
                </div>
                <ReferralComposer token={deal.token} adminEmail={adminEmail}
                    allReferrals={referrals} onUpdated={onUpdated} />
            </Section>
        </div>
    );
}

// ─── Next check-in highlight ────────────────────────────────────────────────

function NextCheckInCard({ checkIn }: { checkIn: CheckIn }) {
    const now = Date.now();
    const overdue = checkIn.scheduledFor < now;
    const daysUntil = Math.ceil((checkIn.scheduledFor - now) / (24 * 3600 * 1000));
    const accent = overdue ? "#EF4444" : daysUntil <= 7 ? "#F59E0B" : "#11B8EA";

    return (
        <div className="rounded-xl border bg-white/[0.02] p-4 mb-6"
            style={{ borderColor: `${accent}40` }}>
            <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] tracking-[0.3em] uppercase font-bold" style={{ color: accent }}>
                    Next check-in · {labelFor(checkIn.type)}
                </p>
                <span className="text-xs font-mono" style={{ color: accent }}>
                    {overdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? "today" : `${daysUntil}d away`}
                </span>
            </div>
            <p className="text-white text-sm">
                Scheduled for {new Date(checkIn.scheduledFor).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
        </div>
    );
}

// ─── Check-in row ───────────────────────────────────────────────────────────

function CheckInRow({ checkIn, token, adminEmail, allCheckIns, onUpdated }: {
    checkIn: CheckIn; token: string; adminEmail: string;
    allCheckIns: CheckIn[]; onUpdated: (d: DealBare) => void;
}) {
    const [open, setOpen] = useState(false);
    const [notes, setNotes] = useState(checkIn.notes || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const completed = !!checkIn.completedAt;
    const accent = completed ? "#10B981" : checkIn.scheduledFor < Date.now() ? "#F59E0B" : "#94A3B8";

    const markComplete = async () => {
        if (notes.trim().length < 10) {
            setError("Notes ≥10 chars — capture what was actually said.");
            return;
        }
        setBusy(true); setError(null);
        try {
            const updated = allCheckIns.map(c =>
                c.id === checkIn.id ? { ...c, completedAt: Date.now(), notes: notes.trim() } : c
            );
            const res = await fetch(`/api/deals/${token}/phase/7`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { checkIns: updated, lastInteractionAt: Date.now() },
                    auditAction: `checkin.${checkIn.type}.completed`,
                    note: `Check-in completed by ${adminEmail}`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            onUpdated(data.deal);
            setOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-lg border bg-white/[0.02]" style={{ borderColor: `${accent}40` }}>
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
                <div className="flex items-center gap-3 min-w-0">
                    {completed
                        ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        : <Circle size={14} className="text-white/30 shrink-0" />}
                    <div className="min-w-0">
                        <p className="text-white text-xs font-semibold truncate">
                            {labelFor(checkIn.type)} · {new Date(checkIn.scheduledFor).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-white/40 text-[10px]">
                            {completed ? `Completed ${new Date(checkIn.completedAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Pending"}
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp size={12} className="text-white/40" /> : <ChevronDown size={12} className="text-white/40" />}
            </button>
            {open && (
                <div className="border-t px-3 py-3 space-y-2" style={{ borderColor: `${accent}30` }}>
                    {completed ? (
                        <pre className="text-white/75 text-[11px] whitespace-pre-wrap leading-relaxed">{checkIn.notes || "—"}</pre>
                    ) : (
                        <>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                rows={3} placeholder="Notes from this check-in (≥10 chars)…"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40 resize-none" />
                            {error && <p className="text-red-400 text-xs">{error}</p>}
                            <button onClick={markComplete} disabled={busy}
                                className="w-full rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold py-2 disabled:opacity-30">
                                {busy ? "Saving…" : "Mark complete"}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Ad-hoc check-in composer ──────────────────────────────────────────────

function AdHocCheckInComposer({ token, adminEmail, allCheckIns, onUpdated }: {
    token: string; adminEmail: string; allCheckIns: CheckIn[]; onUpdated: (d: DealBare) => void;
}) {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!date) { setError("Pick a date."); return; }
        const ts = new Date(date).getTime();
        if (isNaN(ts)) { setError("Invalid date."); return; }
        setBusy(true); setError(null);
        try {
            const newCheckIn: CheckIn = {
                id: `chk_adhoc_${Date.now()}`,
                type: "adhoc",
                scheduledFor: ts,
            };
            const res = await fetch(`/api/deals/${token}/phase/7`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { checkIns: [...allCheckIns, newCheckIn] },
                    auditAction: "checkin.adhoc.scheduled",
                    note: `Ad-hoc check-in scheduled by ${adminEmail}`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            onUpdated(data.deal);
            setOpen(false); setDate("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="w-full rounded-lg border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] text-white/60 text-xs font-medium py-2.5 flex items-center justify-center gap-2">
                <Plus size={12} /> Schedule ad-hoc check-in
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-[#11B8EA]/30 bg-[#11B8EA]/[0.04] p-3 space-y-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
                <button onClick={submit} disabled={busy}
                    className="flex-1 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold py-2 disabled:opacity-30">
                    {busy ? "Saving…" : "Schedule"}
                </button>
                <button onClick={() => { setOpen(false); setError(null); }} disabled={busy}
                    className="px-3 rounded-lg border border-white/10 text-white/50 text-xs">Cancel</button>
            </div>
        </div>
    );
}

// ─── Retainer panel ────────────────────────────────────────────────────────

function RetainerPanel({ retainer, token, adminEmail, onUpdated }: {
    retainer?: any; token: string; adminEmail: string; onUpdated: (d: DealBare) => void;
}) {
    const [open, setOpen] = useState(false);
    const [monthly, setMonthly] = useState<number>(retainer?.monthlyAmount || 0);
    const [hours, setHours] = useState<number>(retainer?.hoursIncluded || 0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendOffer = async () => {
        if (monthly <= 0 || hours <= 0) {
            setError("Both monthly amount and hours must be > 0.");
            return;
        }
        setBusy(true); setError(null);
        try {
            const newRetainer = {
                monthlyAmount: monthly, hoursIncluded: hours, sentAt: Date.now(),
            };
            const res = await fetch(`/api/deals/${token}/phase/7`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { retainerOffer: newRetainer },
                    auditAction: "retainer.sent",
                    note: `Retainer offer sent by ${adminEmail} · ${CURRENCY_SYMBOL}${monthly}/mo · ${hours}h`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            onUpdated(data.deal);
            setOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
        } finally {
            setBusy(false);
        }
    };

    const markStatus = async (status: "accepted" | "declined") => {
        setBusy(true); setError(null);
        try {
            const updated = {
                ...(retainer || {}),
                ...(status === "accepted" ? { acceptedAt: Date.now() } : { declinedAt: Date.now() }),
            };
            const res = await fetch(`/api/deals/${token}/phase/7`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { retainerOffer: updated },
                    auditAction: `retainer.${status}`,
                    note: `Retainer ${status} marked by ${adminEmail}`,
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

    if (!retainer || (!retainer.sentAt && !open)) {
        return (
            <div>
                {!open ? (
                    <button onClick={() => setOpen(true)}
                        className="w-full rounded-lg border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] text-white/60 text-xs font-medium py-2.5 flex items-center justify-center gap-2">
                        <Plus size={12} /> Send retainer offer
                    </button>
                ) : (
                    <div className="rounded-lg border border-[#3B6AE8]/30 bg-[#3B6AE8]/[0.04] p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[9px] tracking-[0.2em] uppercase text-white/40 font-bold">Monthly ({CURRENCY_SYMBOL})</label>
                                <input type="number" min={0} value={monthly}
                                    onChange={e => setMonthly(Number(e.target.value))}
                                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3B6AE8]/40" />
                            </div>
                            <div>
                                <label className="text-[9px] tracking-[0.2em] uppercase text-white/40 font-bold">Hours included</label>
                                <input type="number" min={0} value={hours}
                                    onChange={e => setHours(Number(e.target.value))}
                                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#3B6AE8]/40" />
                            </div>
                        </div>
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                        <div className="flex gap-2">
                            <button onClick={sendOffer} disabled={busy}
                                className="flex-1 rounded-lg bg-[#3B6AE8]/15 border border-[#3B6AE8]/30 text-[#3B6AE8] text-xs font-semibold py-2 disabled:opacity-30">
                                {busy ? "Sending…" : "Send offer"}
                            </button>
                            <button onClick={() => { setOpen(false); setError(null); }} disabled={busy}
                                className="px-3 rounded-lg border border-white/10 text-white/50 text-xs">Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const status: "accepted" | "declined" | "pending" = retainer.acceptedAt ? "accepted" : retainer.declinedAt ? "declined" : "pending";
    const accent = status === "accepted" ? "#10B981" : status === "declined" ? "#EF4444" : "#F59E0B";

    return (
        <div className="rounded-xl border bg-white/[0.02] p-4 space-y-2" style={{ borderColor: `${accent}40` }}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[9px] tracking-[0.3em] uppercase font-bold" style={{ color: accent }}>Retainer · {status}</p>
                    <p className="text-white text-sm font-semibold mt-0.5">
                        {CURRENCY_SYMBOL}{retainer.monthlyAmount.toLocaleString("en-IN")}/mo · {retainer.hoursIncluded}h included
                    </p>
                    <p className="text-white/40 text-[10px]">
                        Sent {retainer.sentAt && new Date(retainer.sentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {retainer.acceptedAt && ` · Accepted ${new Date(retainer.acceptedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                        {retainer.declinedAt && ` · Declined ${new Date(retainer.declinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                    </p>
                </div>
            </div>
            {status === "pending" && (
                <div className="flex gap-2 pt-2">
                    <button onClick={() => markStatus("accepted")} disabled={busy}
                        className="flex-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold py-2 disabled:opacity-30">
                        Mark accepted
                    </button>
                    <button onClick={() => markStatus("declined")} disabled={busy}
                        className="flex-1 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-semibold py-2 disabled:opacity-30">
                        Mark declined
                    </button>
                </div>
            )}
            {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
    );
}

// ─── Referral row + composer ───────────────────────────────────────────────

function ReferralRow({ referral, token, adminEmail, allReferrals, onUpdated }: {
    referral: Referral; token: string; adminEmail: string;
    allReferrals: Referral[]; onUpdated: (d: DealBare) => void;
}) {
    const [busy, setBusy] = useState(false);

    const toggleConverted = async () => {
        setBusy(true);
        try {
            const updated = allReferrals.map(r =>
                r.id === referral.id ? { ...r, converted: !r.converted } : r
            );
            const res = await fetch(`/api/deals/${token}/phase/7`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { referrals: updated },
                    auditAction: referral.converted ? "referral.unconverted" : "referral.converted",
                    note: `Referral status toggled by ${adminEmail}`,
                }),
            });
            const data = await res.json();
            if (res.ok) onUpdated(data.deal);
        } finally {
            setBusy(false);
        }
    };

    const accent = referral.converted ? "#10B981" : "#94A3B8";

    return (
        <div className="rounded-lg border bg-white/[0.02] p-3 flex items-center justify-between gap-3"
            style={{ borderColor: `${accent}30` }}>
            <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate">
                    {referral.referredName}{referral.referredCompany ? ` · ${referral.referredCompany}` : ""}
                </p>
                <p className="text-white/40 text-[10px] truncate">
                    {referral.referredContact || "—"} · added {new Date(referral.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
            </div>
            <button onClick={toggleConverted} disabled={busy}
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] uppercase border disabled:opacity-30"
                style={{ background: `${accent}15`, borderColor: `${accent}40`, color: accent }}>
                {referral.converted ? "Converted" : "Open"}
            </button>
        </div>
    );
}

function ReferralComposer({ token, adminEmail, allReferrals, onUpdated }: {
    token: string; adminEmail: string; allReferrals: Referral[]; onUpdated: (d: DealBare) => void;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [company, setCompany] = useState("");
    const [contact, setContact] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!name.trim()) { setError("Name required."); return; }
        setBusy(true); setError(null);
        try {
            const newRef: Referral = {
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
                    auditAction: "referral.added",
                    note: `Referral added by ${adminEmail}: ${name}`,
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
                className="w-full rounded-lg border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] text-white/60 text-xs font-medium py-2.5 flex items-center justify-center gap-2">
                <Plus size={12} /> Add referral
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-[#11B8EA]/30 bg-[#11B8EA]/[0.04] p-3 space-y-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (required)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company (optional)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact — email or phone"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#11B8EA]/40" />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
                <button onClick={submit} disabled={busy}
                    className="flex-1 rounded-lg bg-[#11B8EA]/15 border border-[#11B8EA]/30 text-[#11B8EA] text-xs font-semibold py-2 disabled:opacity-30">
                    {busy ? "Saving…" : "Add referral"}
                </button>
                <button onClick={() => { setOpen(false); setError(null); }} disabled={busy}
                    className="px-3 rounded-lg border border-white/10 text-white/50 text-xs">Cancel</button>
            </div>
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function labelFor(type: CheckIn["type"]): string {
    switch (type) {
        case "30d":    return "30-day check-in";
        case "90d":    return "90-day check-in";
        case "annual": return "Annual check-in";
        default:       return "Ad-hoc check-in";
    }
}

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

function StatBox({ label, value, accent }: { label: string; value: number | string; accent: string }) {
    return (
        <div className="rounded-xl border bg-white/[0.02] p-3" style={{ borderColor: `${accent}30` }}>
            <p className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1">{label}</p>
            <p className="text-base font-bold tabular-nums truncate" style={{ color: accent }}>{value}</p>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-5 flex items-center gap-3 text-white/40">
            <AlertCircle size={14} />
            <span className="text-xs">{text}</span>
        </div>
    );
}
