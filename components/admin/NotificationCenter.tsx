"use client";

// ─── NOTIFICATION CENTER — bell icon in topbar ──────────────────────────────
// Polls /api/admin/notifications every 30s. Shows unread badge + popover list.
// Click on a notification → routes to that deal's workspace.

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { PHASE_NAMES, PHASE_COLORS } from "@/lib/phases/constants";
import type { Notification } from "@/lib/phases/schema";

interface Props {
    onOpenDeal: (token: string) => void;
}

const POLL_MS = 30000;

export default function NotificationCenter({ onOpenDeal }: Props) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const [urgent, setUrgent] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    const fetchOnce = async () => {
        try {
            const r = await fetch("/api/admin/notifications");
            if (!r.ok) return;
            const d = await r.json();
            setItems(d.notifications || []);
            setUrgent(d.urgentCount || 0);
        } catch {}
    };

    useEffect(() => {
        fetchOnce();
        const t = setInterval(fetchOnce, POLL_MS);
        return () => clearInterval(t);
    }, []);

    // Close popover on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
                <Bell size={16} className="text-white/60" />
                {items.length > 0 && (
                    <span
                        className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-1 ${urgent > 0 ? "bg-red-500 text-white" : "bg-[#11B8EA] text-[#0A0F1E]"}`}
                    >
                        {items.length > 99 ? "99+" : items.length}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 mt-2 w-[380px] max-h-[500px] overflow-y-auto bg-[#0D1526] border border-white/10 rounded-xl shadow-2xl z-50"
                    >
                        <div className="sticky top-0 bg-[#0D1526] border-b border-white/8 px-4 py-3 flex items-center justify-between">
                            <p className="text-[10px] tracking-[0.4em] uppercase text-white/50 font-semibold">Notifications</p>
                            <span className="text-white/40 text-xs font-mono">
                                {urgent > 0 && <span className="text-red-400">{urgent} urgent · </span>}
                                {items.length} total
                            </span>
                        </div>

                        {items.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-white/30 text-sm">All clear. Nothing pending.</p>
                            </div>
                        ) : (
                            <div className="p-1">
                                {items.map(n => (
                                    <button
                                        key={n.id}
                                        onClick={() => { setOpen(false); onOpenDeal(n.dealToken); }}
                                        className="w-full text-left flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                        <span
                                            className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                                            style={{ background: n.urgent ? "#EF4444" : PHASE_COLORS[n.phase] }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-white/90 text-sm font-medium truncate">{n.title}</p>
                                                <span className="text-[9px] tracking-wider uppercase text-white/30 shrink-0 font-bold">
                                                    {PHASE_NAMES[n.phase]}
                                                </span>
                                            </div>
                                            {n.body && <p className="text-white/45 text-xs mt-0.5 line-clamp-2">{n.body}</p>}
                                            <p className="text-white/25 text-[10px] mt-1">
                                                {new Date(n.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
