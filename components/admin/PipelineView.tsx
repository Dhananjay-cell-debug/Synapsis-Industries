"use client";

// ─── PIPELINE VIEW — 7-column Kanban grouped by deal.phase ─────────────────
// Every active deal is a card. Phase column = vertical stack. Click a card
// to dive into client workspace. Drag-and-drop for manual phase override is V2;
// V1 uses a "Force Phase" button inside the workspace.

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Building2, IndianRupee, Clock, AlertCircle } from "lucide-react";
import { PHASE_NAMES, PHASE_COLORS, GHOST_ALERT_DAYS, GHOST_WARNING_DAYS } from "@/lib/phases/constants";

interface PipelineDeal {
    token: string;
    name: string;
    company: string;
    status: string;
    phase: number;
    totalPrice?: number;
    payments?: { phase: number; status: string; amount: number }[];
    lastInteractionAt?: number;
    createdAt: number;
}

interface Props {
    deals: PipelineDeal[];
    onOpen: (token: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function PipelineView({ deals, onOpen }: Props) {
    const [filter, setFilter] = useState<"all" | "active" | "stuck">("all");

    const visible = deals.filter(d => {
        if (["rejected", "expired"].includes(d.status)) return false;
        if (filter === "active") return ["elected", "proceeding", "active", "interested"].includes(d.status);
        if (filter === "stuck") {
            if (!d.lastInteractionAt) return false;
            const stale = (Date.now() - d.lastInteractionAt) / DAY_MS;
            return stale >= GHOST_WARNING_DAYS;
        }
        return true;
    });

    const byPhase = Array.from({ length: 8 }, (_, i) => visible.filter(d => d.phase === i));

    // Total counts per phase column
    const totals = byPhase.map(col => col.length);

    return (
        <div className="px-8 py-8">
            <div className="flex items-end justify-between mb-6">
                <div>
                    <h1 className="font-serif text-4xl text-white tracking-tight">Pipeline</h1>
                    <p className="text-white/40 text-sm mt-2 tracking-wide">{visible.length} deals across 8 phases.</p>
                </div>
                <div className="flex items-center gap-1 bg-white/[0.04] border border-white/8 rounded-lg p-1">
                    {(["all", "active", "stuck"] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-all ${filter === f ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
                        >
                            {f === "all" ? "All" : f === "active" ? "Active" : "Stuck"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Horizontally scrolling Kanban */}
            <div className="overflow-x-auto pb-4 -mx-8 px-8">
                <div className="flex gap-3 min-w-max">
                    {byPhase.map((col, phaseIdx) => (
                        <div key={phaseIdx} className="w-[280px] shrink-0">
                            <div
                                className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg"
                                style={{ background: `${PHASE_COLORS[phaseIdx]}10`, border: `1px solid ${PHASE_COLORS[phaseIdx]}25` }}
                            >
                                <div>
                                    <p className="text-[9px] tracking-[0.4em] uppercase font-bold" style={{ color: PHASE_COLORS[phaseIdx] }}>
                                        P{phaseIdx} · {PHASE_NAMES[phaseIdx]}
                                    </p>
                                </div>
                                <span className="text-white/50 text-xs font-mono">{totals[phaseIdx]}</span>
                            </div>

                            <div className="space-y-2 min-h-[200px]">
                                {col.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-white/8 py-8 px-4 text-center">
                                        <p className="text-white/20 text-[10px] tracking-[0.3em] uppercase">Empty</p>
                                    </div>
                                ) : col.map(deal => (
                                    <DealCard key={deal.token} deal={deal} accent={PHASE_COLORS[phaseIdx]} onOpen={onOpen} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function DealCard({ deal, accent, onOpen }: { deal: PipelineDeal; accent: string; onOpen: (token: string) => void }) {
    const now = Date.now();
    const stale = deal.lastInteractionAt ? (now - deal.lastInteractionAt) / DAY_MS : 0;
    const ghost = stale >= GHOST_ALERT_DAYS ? "red" : stale >= GHOST_WARNING_DAYS ? "yellow" : null;

    const paid = (deal.payments || []).filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const collectedPct = deal.totalPrice ? Math.round((paid / deal.totalPrice) * 100) : 0;

    return (
        <motion.button
            layout
            onClick={() => onOpen(deal.token)}
            className="w-full text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/20 rounded-xl p-3 transition-all group relative overflow-hidden"
        >
            {/* Phase accent line */}
            <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: accent }} />

            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{deal.name}</p>
                    <p className="text-white/40 text-[11px] truncate flex items-center gap-1">
                        <Building2 size={10} /> {deal.company}
                    </p>
                </div>
                {ghost && (
                    <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase font-bold ${ghost === "red" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                        <AlertCircle size={9} /> {Math.floor(stale)}d
                    </span>
                )}
            </div>

            {deal.totalPrice ? (
                <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1 text-[10px] text-white/50 font-mono">
                            <IndianRupee size={9} /> {deal.totalPrice.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[9px] text-white/30 tracking-wider uppercase font-mono">
                            {collectedPct}% paid
                        </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${collectedPct}%`, background: accent }} />
                    </div>
                </div>
            ) : (
                <p className="text-[10px] text-white/30 mt-2 italic">No quote yet</p>
            )}

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <span className="text-[9px] tracking-[0.2em] uppercase text-white/30">{deal.status}</span>
                <span className="text-[9px] text-white/30 flex items-center gap-1">
                    <Clock size={9} />
                    {Math.floor((now - deal.createdAt) / DAY_MS)}d
                </span>
            </div>
        </motion.button>
    );
}
