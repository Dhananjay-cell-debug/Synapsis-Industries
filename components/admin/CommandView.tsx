"use client";

// ─── COMMAND VIEW — Mission Control home for admin ──────────────────────────
// What admin sees first when /dashboard loads with admin role.
// Five tiles: URGENT, TODAY, REVENUE, PIPELINE, ACTIVITY FEED.
// Every tile is clickable and routes back into the existing dashboard views.

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    AlertTriangle, Clock, IndianRupee, GitBranch, Activity,
    MessageSquare, FileText, CreditCard, ArrowRight,
} from "lucide-react";
import {
    PHASE_NAMES, PHASE_COLORS, GHOST_ALERT_DAYS,
} from "@/lib/phases/constants";
import type { Notification, AuditEntry } from "@/lib/phases/schema";

interface DealLite {
    token: string;
    name: string;
    company: string;
    status: string;
    phase: number;
    createdAt: number;
    totalPrice?: number;
    payments?: { phase: number; status: string; amount: number; paidAt?: number }[];
    audit?: AuditEntry[];
    lastInteractionAt?: number;
    chatMessages?: { from: string; readByAdmin?: boolean; timestamp: number }[];
}

interface Props {
    deals: DealLite[];
    onJump: (view: string, dealToken?: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function CommandView({ deals, onJump }: Props) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        fetch("/api/admin/notifications")
            .then(r => r.ok ? r.json() : { notifications: [] })
            .then(d => setNotifications(d.notifications || []))
            .catch(() => {});
    }, [deals.length]); // refetch when deal set changes

    const now = Date.now();

    // ─── Compute counters ──────────────────────────────────────────────────
    const urgent = notifications.filter(n => n.urgent);
    const newInquiries = deals.filter(d => d.status === "pending" && now - d.createdAt < DAY_MS).length;
    const ghosted = deals.filter(d =>
        ["elected", "proceeding", "active"].includes(d.status) &&
        d.lastInteractionAt && (now - d.lastInteractionAt) / DAY_MS >= GHOST_ALERT_DAYS
    ).length;
    const activeDeals = deals.filter(d => !["pending", "rejected", "expired"].includes(d.status)).length;

    // Today: items needing admin action across phases
    const todoCount = (() => {
        let c = 0;
        for (const d of deals) {
            // Phase 1 — questionnaire submitted but call not scheduled
            const p1 = (d as any).phaseData?.phase1;
            if (d.phase === 1 && (d as any).questionnaireSubmittedAt && !p1?.callScheduledAt) c++;
            // Phase 2 — blueprint draft not sent
            const bp = (d as any).phaseData?.phase2?.blueprint;
            if (d.phase === 2 && bp?.status === "draft") c++;
            // Phase 3 — assets all in but not confirmed
            const p3 = (d as any).phaseData?.phase3;
            if (d.phase === 3 && p3?.advancePaidAt && !p3?.assetsConfirmedAt) {
                const items = p3.assetChecklist || [];
                const allReq = items.filter((i: any) => i.required).every((i: any) => i.submitted);
                if (allReq) c++;
            }
        }
        return c;
    })();

    // Revenue (paid amounts, all-time + this month)
    const revenue = deals.reduce(
        (acc, d) => {
            for (const p of d.payments || []) {
                if (p.status === "paid" && p.paidAt) {
                    acc.total += p.amount;
                    if (now - p.paidAt < 30 * DAY_MS) acc.month += p.amount;
                }
            }
            // pipeline value = approved deals' uncollected balance
            if (d.totalPrice && !["rejected", "expired"].includes(d.status)) {
                const paid = (d.payments || []).filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
                acc.pipeline += d.totalPrice - paid;
            }
            return acc;
        },
        { total: 0, month: 0, pipeline: 0 }
    );

    // Pipeline distribution by phase
    const pipelineByPhase = Array.from({ length: 8 }).map((_, i) =>
        deals.filter(d => d.phase === i && !["rejected", "expired"].includes(d.status)).length
    );

    // Activity feed — last 8 audit entries across all deals
    const allAudit = deals.flatMap(d =>
        (d.audit || []).map(e => ({ ...e, _dealName: d.name, _dealToken: d.token }))
    ).sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);

    return (
        <div className="px-8 py-8 max-w-[1400px] mx-auto">
            <div className="mb-8">
                <h1 className="font-serif text-4xl text-white tracking-tight">Mission Control</h1>
                <p className="text-white/40 text-sm mt-2 tracking-wide">Live state across every active engagement.</p>
            </div>

            {/* ─── Top tile row ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Tile
                    icon={AlertTriangle}
                    label="Urgent"
                    value={urgent.length}
                    accent="#EF4444"
                    sub={urgent.length === 0 ? "All clear" : urgent[0].title}
                    onClick={() => onJump("inbox")}
                />
                <Tile
                    icon={Clock}
                    label="Today's actions"
                    value={todoCount + newInquiries}
                    accent="#F59E0B"
                    sub={`${newInquiries} new inquiries · ${todoCount} pending`}
                    onClick={() => onJump("inbox")}
                />
                <Tile
                    icon={IndianRupee}
                    label="Revenue (30d)"
                    value={`₹${(revenue.month / 1000).toFixed(1)}k`}
                    accent="#10B981"
                    sub={`Pipeline: ₹${(revenue.pipeline / 1000).toFixed(0)}k uncollected`}
                    onClick={() => onJump("pipeline")}
                />
                <Tile
                    icon={GitBranch}
                    label="Active deals"
                    value={activeDeals}
                    accent="#11B8EA"
                    sub={ghosted > 0 ? `${ghosted} ghosted` : "Healthy"}
                    onClick={() => onJump("pipeline")}
                />
            </div>

            {/* ─── Pipeline distribution mini-chart ─────────────────────────── */}
            <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => onJump("pipeline")}
                className="w-full text-left bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-6 hover:bg-white/[0.05] hover:border-white/15 transition-all"
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] tracking-[0.4em] uppercase text-white/30">Pipeline distribution</p>
                        <p className="text-white text-xl font-medium mt-1">By phase</p>
                    </div>
                    <ArrowRight size={16} className="text-white/30" />
                </div>
                <div className="grid grid-cols-8 gap-2">
                    {pipelineByPhase.map((count, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className="w-full h-24 flex items-end">
                                <div
                                    className="w-full rounded-t-lg transition-all"
                                    style={{
                                        height: `${Math.max(count * 18, count > 0 ? 8 : 2)}px`,
                                        background: `linear-gradient(180deg, ${PHASE_COLORS[i]}, ${PHASE_COLORS[i]}40)`,
                                        opacity: count > 0 ? 1 : 0.2,
                                    }}
                                />
                            </div>
                            <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: PHASE_COLORS[i] }}>
                                P{i}
                            </p>
                            <p className="text-white/60 text-xs font-mono">{count}</p>
                        </div>
                    ))}
                </div>
            </motion.button>

            {/* ─── Two-col: notifications + activity ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Notifications" icon={MessageSquare} count={notifications.length}>
                    {notifications.length === 0 ? (
                        <Empty>Nothing pending. Clean inbox.</Empty>
                    ) : (
                        <div className="space-y-2">
                            {notifications.slice(0, 6).map(n => (
                                <button
                                    key={n.id}
                                    onClick={() => onJump("workspace", n.dealToken)}
                                    className="w-full text-left flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all group"
                                >
                                    <span
                                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ background: n.urgent ? "#EF4444" : PHASE_COLORS[n.phase] }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white/85 text-sm font-medium truncate">{n.title}</p>
                                        {n.body && <p className="text-white/40 text-xs truncate mt-0.5">{n.body}</p>}
                                    </div>
                                    <span className="text-[9px] tracking-[0.2em] uppercase text-white/30 shrink-0">
                                        {PHASE_NAMES[n.phase]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel title="Recent activity" icon={Activity} count={allAudit.length}>
                    {allAudit.length === 0 ? (
                        <Empty>No audit entries yet.</Empty>
                    ) : (
                        <div className="space-y-2">
                            {allAudit.map(e => (
                                <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-white/30 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white/75 text-xs">
                                            <span className="font-medium text-white">{e._dealName}</span>
                                            <span className="text-white/40"> · </span>
                                            {e.action}
                                            {e.phaseBefore !== undefined && e.phaseAfter !== undefined && e.phaseBefore !== e.phaseAfter && (
                                                <span className="text-white/40"> · P{e.phaseBefore} → P{e.phaseAfter}</span>
                                            )}
                                        </p>
                                        <p className="text-white/30 text-[10px] mt-0.5">
                                            {new Date(e.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            {e.actor === "admin" && e.actorEmail ? ` · ${e.actorEmail.split("@")[0]}` : ` · ${e.actor}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Tile({ icon: Icon, label, value, sub, accent, onClick }: {
    icon: React.ElementType; label: string; value: string | number; sub?: string;
    accent: string; onClick?: () => void;
}) {
    return (
        <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className="text-left bg-white/[0.03] border border-white/8 rounded-2xl p-5 hover:bg-white/[0.05] hover:border-white/15 transition-all group"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                    <Icon size={16} style={{ color: accent }} />
                </div>
                <ArrowRight size={14} className="text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-[9px] tracking-[0.4em] uppercase text-white/30">{label}</p>
            <p className="text-white text-3xl font-medium mt-1 font-mono">{value}</p>
            {sub && <p className="text-white/40 text-[11px] mt-2 truncate">{sub}</p>}
        </motion.button>
    );
}

function Panel({ title, icon: Icon, count, children }: {
    title: string; icon: React.ElementType; count: number; children: React.ReactNode;
}) {
    return (
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Icon size={14} className="text-white/40" />
                    <p className="text-[10px] tracking-[0.4em] uppercase text-white/40">{title}</p>
                </div>
                <span className="text-white/30 text-xs font-mono">{count}</span>
            </div>
            {children}
        </div>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return (
        <div className="py-8 text-center">
            <p className="text-white/30 text-xs">{children}</p>
        </div>
    );
}
