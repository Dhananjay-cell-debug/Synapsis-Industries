"use client";

// ─── SYN ACTIVITY BUTTON ───────────────────────────────────────────────────
// Top-bar pulsing button. Click → slide-down panel showing every action
// Syn has taken, filterable by deal, with acknowledge + per-deal kill-switch.

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check, ShieldOff, ShieldCheck, RotateCcw, Filter } from "lucide-react";

interface SynAction {
    id: string;
    created_at: string;
    deal_token: string | null;
    action_type: string;
    target_action: string | null;
    outcome: string;
    checklist_id: string | null;
    evidence: Record<string, unknown>;
    note: string | null;
    initiated_by: string;
    acknowledged_by_admin: boolean;
}

const ACCENT = "#11B8EA";
const ACCENT_DEEP = "#3B6AE8";

export default function SynActivityButton({ onOpenDeal }: { onOpenDeal?: (token: string) => void }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<SynAction[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const [filterUnack, setFilterUnack] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`/api/admin/syn/activity?limit=100${filterUnack ? "&unackOnly=1" : ""}`, { cache: "no-store" });
            const j = await r.json();
            setItems(j.items || []);
            setUnread(j.unreadCount || 0);
        } finally { setLoading(false); }
    }, [filterUnack]);

    useEffect(() => {
        load();
        const iv = setInterval(load, 30_000);
        return () => clearInterval(iv);
    }, [load]);

    async function acknowledge(ids: string[]) {
        await fetch("/api/admin/syn/activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
        });
        await load();
    }

    async function toggleKillSwitch(dealToken: string, currentlyActive: boolean) {
        const reason = currentlyActive ? "" : window.prompt("Reason for engaging kill-switch?") || "Manually engaged";
        if (!reason && !currentlyActive) return;
        await fetch("/api/admin/syn/kill-switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dealToken, active: !currentlyActive, reason }),
        });
        await load();
    }

    function badgeColor(outcome: string) {
        if (outcome === "success") return "#10b981";
        if (outcome === "blocked") return "#f59e0b";
        if (outcome === "error") return "#ef4444";
        return "#94a3b8";
    }

    return (
        <>
            <button
                type="button"
                aria-label="Syn activity"
                onClick={() => setOpen(o => !o)}
                className="relative grid place-items-center w-9 h-9 rounded-lg transition-colors hover:bg-white/5"
                style={{ border: `1px solid ${ACCENT}40` }}
            >
                <Sparkles size={15} style={{ color: ACCENT }} />
                {unread > 0 && (
                    <span
                        className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full text-[9px] font-bold text-white"
                        style={{ background: "#ef4444" }}
                    >
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
                {unread > 0 && (
                    <span
                        className="absolute inset-0 rounded-lg pointer-events-none animate-pulse"
                        style={{ boxShadow: `0 0 0 2px ${ACCENT}30` }}
                    />
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]"
                            onClick={() => setOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: 480, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 480, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 28 }}
                            className="fixed top-0 right-0 bottom-0 z-[85] w-full sm:w-[480px] md:w-[540px] flex flex-col"
                            style={{
                                background: "#0A0F1E",
                                borderLeft: `1px solid ${ACCENT}40`,
                                boxShadow: `-20px 0 60px -20px ${ACCENT}30`,
                            }}
                        >
                            <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}>
                                        <Sparkles size={16} className="text-white" strokeWidth={2.2} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] tracking-[0.3em] uppercase font-semibold" style={{ color: ACCENT }}>Syn · Activity Feed</p>
                                        <p className="text-white/80 text-sm font-semibold mt-0.5">{items.length} action(s) · {unread} unread</p>
                                    </div>
                                </div>
                                <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-lg grid place-items-center hover:bg-white/5">
                                    <X size={18} className="text-white/70" />
                                </button>
                            </header>

                            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/5 text-[11px]">
                                <button
                                    onClick={() => setFilterUnack(f => !f)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors"
                                    style={{
                                        background: filterUnack ? `${ACCENT}20` : "transparent",
                                        border: `1px solid ${filterUnack ? ACCENT : "rgba(255,255,255,0.1)"}`,
                                        color: filterUnack ? ACCENT : "rgba(255,255,255,0.7)",
                                    }}
                                >
                                    <Filter size={11} /> Unread only
                                </button>
                                {unread > 0 && (
                                    <button
                                        onClick={() => acknowledge(items.filter(i => !i.acknowledged_by_admin).map(i => i.id))}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-white/70 hover:bg-white/5"
                                    >
                                        <Check size={11} /> Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={() => load()}
                                    className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md text-white/70 hover:bg-white/5"
                                >
                                    <RotateCcw size={11} /> Refresh
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                                {loading && items.length === 0 && <p className="text-white/40 text-xs text-center py-12">Loading…</p>}
                                {!loading && items.length === 0 && (
                                    <p className="text-white/40 text-xs text-center py-12">No Syn activity yet. Once Sprint 3 cron sweeps or you hit the manual verify endpoint, actions appear here.</p>
                                )}
                                {items.map(item => (
                                    <div
                                        key={item.id}
                                        className="rounded-lg p-3 transition-colors hover:bg-white/[0.03] cursor-pointer"
                                        style={{
                                            background: item.acknowledged_by_admin ? "rgba(255,255,255,0.02)" : "rgba(17,184,234,0.04)",
                                            border: `1px solid ${item.acknowledged_by_admin ? "rgba(255,255,255,0.06)" : `${ACCENT}30`}`,
                                        }}
                                        onClick={() => { if (!item.acknowledged_by_admin) acknowledge([item.id]); }}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span
                                                        className="inline-block w-2 h-2 rounded-full"
                                                        style={{ background: badgeColor(item.outcome) }}
                                                    />
                                                    <p className="text-white/90 text-xs font-semibold">
                                                        {item.action_type}{item.target_action ? `: ${item.target_action}` : ""}
                                                    </p>
                                                    <span className="text-[9px] text-white/40 uppercase tracking-wider">{item.outcome}</span>
                                                </div>
                                                {item.note && <p className="text-white/60 text-[11px] mt-1">{item.note}</p>}
                                                {item.checklist_id && (
                                                    <p className="text-white/40 text-[10px] mt-1 font-mono">checklist: {item.checklist_id}</p>
                                                )}
                                                {item.deal_token && (
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onOpenDeal?.(item.deal_token!); }}
                                                            className="text-[10px] underline hover:no-underline"
                                                            style={{ color: ACCENT }}
                                                        >
                                                            open deal
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleKillSwitch(item.deal_token!, false); }}
                                                            className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"
                                                            title="Engage kill-switch for this deal"
                                                        >
                                                            <ShieldOff size={10} /> kill-switch
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[9px] text-white/30 whitespace-nowrap">
                                                {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
