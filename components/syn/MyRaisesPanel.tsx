"use client";

// ─── MY RAISES PANEL ──────────────────────────────────────────────────────
// Client-side viewer for everything they've raised + admin responses.
// Solves the missing painpoint: until now, admin acks/updates/resolutions
// only landed in email — nothing surfaced inside the portal. This panel
// lists every raise with status + full response thread.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    X, MessageSquareWarning, AlertCircle, ChevronLeft, CheckCircle,
    Clock, Activity, Bell,
} from "lucide-react";

const SOFT_CYAN = "#7DD3FC";
const ACCENT_DEEP = "#0284C7";

type Status = "open" | "acknowledged" | "in_progress" | "resolved" | "rejected";

interface RaisedItem {
    id: string;
    kind: "doubt" | "issue";
    status: Status;
    title: string | null;
    description: string;
    created_at: string;
    updated_at: string;
    has_unread_admin_response: boolean;
    phase: number | null;
}

interface Response {
    id: string;
    from_role: "admin" | "client" | "system";
    body: string;
    kind: "ack" | "progress" | "resolution" | "reply";
    created_at: string;
}

const STATUS_META: Record<Status, { fg: string; bg: string; label: string; icon: any }> = {
    open:         { fg: "#D97706", bg: "#FEF3C7", label: "Waiting",     icon: Clock },
    acknowledged: { fg: "#0284C7", bg: "#DBEAFE", label: "Acknowledged", icon: Bell },
    in_progress:  { fg: "#2563EB", bg: "#DBEAFE", label: "In progress",  icon: Activity },
    resolved:     { fg: "#059669", bg: "#D1FAE5", label: "Resolved",     icon: CheckCircle },
    rejected:     { fg: "#DC2626", bg: "#FEE2E2", label: "Rejected",     icon: AlertCircle },
};

interface Props {
    token: string;
    onClose: () => void;
    onRead?: () => void; // bubble up when something got marked read
}

export default function MyRaisesPanel({ token, onClose, onRead }: Props) {
    const [items, setItems] = useState<RaisedItem[]>([]);
    const [openItemId, setOpenItemId] = useState<string | null>(null);
    const [openItem, setOpenItem] = useState<RaisedItem | null>(null);
    const [responses, setResponses] = useState<Response[]>([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        try {
            const r = await fetch(`/api/syn/raised/${token}`, { cache: "no-store" });
            if (r.ok) {
                const d = await r.json();
                setItems(d.items || []);
            }
        } finally { setLoading(false); }
    }

    useEffect(() => { load(); }, [token]);

    async function openItemFn(id: string) {
        setOpenItemId(id);
        setOpenItem(null);
        setResponses([]);
        try {
            const r = await fetch(`/api/syn/raised/${token}?id=${id}`, { cache: "no-store" });
            if (r.ok) {
                const d = await r.json();
                setOpenItem(d.item);
                setResponses(d.responses || []);
                // The GET also marks has_unread_admin_response=false server-side
                onRead?.();
                // Refresh list so the unread dot disappears in the master list
                load();
            }
        } catch { /* silent */ }
    }

    function back() {
        setOpenItemId(null);
        setOpenItem(null);
        setResponses([]);
    }

    const fmt = (ts: string) => new Date(ts).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-black/45 backdrop-blur-sm px-4 py-8"
            onClick={onClose}
            style={{ cursor: "auto" }}
        >
            <motion.div
                initial={{ scale: 0.96, y: 8, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                style={{ border: `1px solid ${SOFT_CYAN}`, cursor: "auto" }}
                onClick={e => e.stopPropagation()}
            >
                <style jsx>{`
                    div :global(*) { cursor: auto !important; }
                    div :global(button) { cursor: pointer !important; }
                `}</style>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: `${SOFT_CYAN}50`, background: `${SOFT_CYAN}10` }}>
                    <div className="flex items-center gap-2">
                        {openItem && (
                            <button onClick={back} className="w-7 h-7 grid place-items-center rounded-lg hover:bg-slate-100">
                                <ChevronLeft size={16} className="text-slate-700" />
                            </button>
                        )}
                        <p className="text-sm font-semibold" style={{ color: ACCENT_DEEP }}>
                            {openItem ? (openItem.title || "Raised item") : "My doubts & issues"}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100">
                        <X size={16} className="text-slate-600" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* List view */}
                    {!openItem && (
                        <div className="px-4 py-3 space-y-2">
                            {loading && <p className="text-center text-xs text-slate-400 py-8">Loading…</p>}
                            {!loading && items.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-slate-700 text-sm font-medium">Nothing raised yet.</p>
                                    <p className="text-slate-400 text-xs mt-1">When you submit a doubt or issue, it lands here with every reply.</p>
                                </div>
                            )}
                            {items.map(it => {
                                const s = STATUS_META[it.status];
                                const Icon = s.icon;
                                return (
                                    <button
                                        key={it.id}
                                        onClick={() => openItemFn(it.id)}
                                        className="w-full text-left rounded-xl p-3 transition-all hover:scale-[1.005]"
                                        style={{ background: "#fff", border: `1px solid ${SOFT_CYAN}50`, boxShadow: it.has_unread_admin_response ? `0 0 0 2px ${SOFT_CYAN}55` : undefined }}
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {it.kind === "doubt"
                                                    ? <MessageSquareWarning size={13} style={{ color: ACCENT_DEEP }} />
                                                    : <AlertCircle size={13} className="text-red-600" />
                                                }
                                                <p className="text-slate-800 text-xs font-semibold truncate">{it.title || it.description.slice(0, 60)}</p>
                                            </div>
                                            {it.has_unread_admin_response && (
                                                <span className="shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1" title="New update" />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span
                                                className="px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                                                style={{ background: s.bg, color: s.fg }}
                                            >
                                                <Icon size={9} />
                                                {s.label}
                                            </span>
                                            <span className="text-slate-400">{fmt(it.updated_at || it.created_at)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Detail view */}
                    {openItem && (
                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    {(() => {
                                        const s = STATUS_META[openItem.status];
                                        const Icon = s.icon;
                                        return (
                                            <span
                                                className="px-2 py-1 rounded-full font-semibold flex items-center gap-1 text-[10px]"
                                                style={{ background: s.bg, color: s.fg }}
                                            >
                                                <Icon size={10} />
                                                {s.label}
                                            </span>
                                        );
                                    })()}
                                    <span className="text-slate-400 text-[10px]">{fmt(openItem.created_at)}</span>
                                </div>
                                <p className="text-[10px] tracking-[0.2em] uppercase text-slate-500 font-semibold mb-1">Your description</p>
                                <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap p-3 rounded-lg" style={{ background: "#F8FAFC", border: `1px solid ${SOFT_CYAN}30` }}>
                                    {openItem.description}
                                </p>
                            </div>

                            <div>
                                <p className="text-[10px] tracking-[0.2em] uppercase text-slate-500 font-semibold mb-2">Replies from Dhananjay</p>
                                {responses.length === 0 ? (
                                    <p className="text-slate-400 text-xs italic px-3 py-4 rounded-lg" style={{ background: "#F8FAFC", border: `1px dashed ${SOFT_CYAN}40` }}>
                                        No replies yet. You'll see them here the moment Dhananjay sends one.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {responses.filter(r => r.from_role === "admin").map(r => (
                                            <div key={r.id} className="p-3 rounded-lg" style={{ background: r.kind === "resolution" ? "#ECFDF5" : "#F0F9FF", border: `1px solid ${r.kind === "resolution" ? "#A7F3D0" : "#BAE6FD"}` }}>
                                                <p className="text-[9px] tracking-[0.2em] uppercase font-semibold mb-1.5" style={{ color: r.kind === "resolution" ? "#059669" : ACCENT_DEEP }}>
                                                    {r.kind === "ack" && "Acknowledged"}
                                                    {r.kind === "progress" && "Update"}
                                                    {r.kind === "resolution" && "Resolved"}
                                                    {r.kind === "reply" && "Reply"}
                                                    {" · "}{fmt(r.created_at)}
                                                </p>
                                                <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">{r.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
