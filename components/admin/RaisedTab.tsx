"use client";

// ─── ADMIN — DOUBTS & ISSUES TAB ───────────────────────────────────────────
// Lives inside Mission Control. Two pill tabs: Doubts / Issues.
// Each row → click opens a detail drawer with chat context, recordings,
// response history, and the admin reply console (Ack / Update / Resolve).

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquareWarning, AlertCircle, ChevronRight, X,
    Video as VideoIcon, Mic, Send, Check, Loader2, Clock,
} from "lucide-react";

type Kind = "doubt" | "issue";
type Status = "open" | "acknowledged" | "in_progress" | "resolved" | "rejected";

interface RaisedItem {
    id: string;
    deal_token: string;
    kind: Kind;
    status: Status;
    title: string | null;
    description: string;
    screen_recording_url: string | null;
    voice_recording_url: string | null;
    client_name: string | null;
    client_email: string | null;
    company: string | null;
    phase: number | null;
    chat_context: any[] | null;
    created_at: string;
    updated_at: string;
    acknowledged_at: string | null;
    resolved_at: string | null;
    has_unread_admin_response: boolean;
}

interface Response {
    id: string;
    from_role: "admin" | "client" | "system";
    body: string;
    kind: "ack" | "progress" | "resolution" | "reply";
    created_at: string;
}

const STATUS_STYLE: Record<Status, { bg: string; fg: string; label: string }> = {
    open:         { bg: "bg-amber-500/15", fg: "text-amber-400", label: "Open" },
    acknowledged: { bg: "bg-sky-500/15",   fg: "text-sky-400",   label: "Acknowledged" },
    in_progress:  { bg: "bg-blue-500/15",  fg: "text-blue-400",  label: "In progress" },
    resolved:     { bg: "bg-emerald-500/15", fg: "text-emerald-400", label: "Resolved" },
    rejected:     { bg: "bg-rose-500/15",  fg: "text-rose-400",  label: "Rejected" },
};

export default function RaisedTab() {
    const [kind, setKind] = useState<Kind>("doubt");
    const [items, setItems] = useState<RaisedItem[]>([]);
    const [counts, setCounts] = useState({ doubts: 0, issues: 0, open: 0, resolved: 0 });
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);

    async function load() {
        try {
            const r = await fetch(`/api/admin/raised?kind=all`, { cache: "no-store" });
            if (r.ok) {
                const d = await r.json();
                setItems(d.items || []);
                setCounts(d.counts || { doubts: 0, issues: 0, open: 0, resolved: 0 });
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }

    useEffect(() => {
        load();
        const iv = setInterval(load, 20_000);
        return () => clearInterval(iv);
    }, []);

    const filtered = items.filter(i => i.kind === kind);
    const openItem = items.find(i => i.id === openId) || null;

    return (
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mt-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-[10px] tracking-[0.4em] uppercase text-white/30">From the client portal</p>
                    <p className="text-white text-xl font-medium mt-1">Doubts & Issues</p>
                </div>
                <div className="flex items-center gap-2">
                    <PillTab
                        active={kind === "doubt"}
                        onClick={() => setKind("doubt")}
                        icon={<MessageSquareWarning size={12} />}
                        label="Doubts Raised"
                        count={counts.doubts}
                        accent="#0EA5E9"
                    />
                    <PillTab
                        active={kind === "issue"}
                        onClick={() => setKind("issue")}
                        icon={<AlertCircle size={12} />}
                        label="Issues Raised"
                        count={counts.issues}
                        accent="#EF4444"
                    />
                </div>
            </div>

            {loading ? (
                <div className="py-10 text-center text-white/30 text-xs">Loading…</div>
            ) : filtered.length === 0 ? (
                <div className="py-10 text-center">
                    <p className="text-white/30 text-xs">No {kind === "doubt" ? "doubts" : "issues"} raised yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(it => {
                        const s = STATUS_STYLE[it.status];
                        return (
                            <button
                                key={it.id}
                                onClick={() => setOpenId(it.id)}
                                className="w-full text-left flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all group relative"
                            >
                                {it.has_unread_admin_response && (
                                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-white/90 text-sm font-medium truncate">
                                            {it.title || it.description.slice(0, 80)}
                                        </p>
                                        <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.fg}`}>
                                            {s.label}
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-[11px] truncate">
                                        {it.client_name} · {it.company || "no company"} · P{it.phase ?? "—"} · {new Date(it.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                                <ChevronRight size={14} className="text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                            </button>
                        );
                    })}
                </div>
            )}

            <AnimatePresence>
                {openItem && (
                    <DetailDrawer
                        item={openItem}
                        onClose={() => setOpenId(null)}
                        onMutated={() => load()}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Pill Tab ──────────────────────────────────────────────────────────────
function PillTab({ active, onClick, icon, label, count, accent }: {
    active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number; accent: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                active ? "text-white" : "text-white/40 hover:text-white/70 border-white/8 hover:border-white/15"
            }`}
            style={active ? { background: `${accent}20`, borderColor: `${accent}50`, color: accent } : undefined}
        >
            {icon}
            {label}
            <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${active ? "bg-white/10" : "bg-white/5"}`}>{count}</span>
        </button>
    );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────
function DetailDrawer({ item, onClose, onMutated }: {
    item: RaisedItem; onClose: () => void; onMutated: () => void;
}) {
    const [responses, setResponses] = useState<Response[]>([]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState<null | "ack" | "progress" | "resolution" | "reply">(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch(`/api/admin/raised/${item.id}`, { cache: "no-store" });
                if (r.ok) {
                    const d = await r.json();
                    setResponses(d.responses || []);
                }
            } catch { /* silent */ }
        })();
    }, [item.id]);

    async function send(kind: "ack" | "progress" | "resolution" | "reply") {
        setSending(kind);
        setError(null);
        try {
            const body: any = { kind };
            if (kind === "reply" || kind === "progress") {
                if (!draft.trim()) { setError("Write a message first."); setSending(null); return; }
                body.body = draft.trim();
            } else if (draft.trim()) {
                body.body = draft.trim();
            }
            const r = await fetch(`/api/admin/raised/${item.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                throw new Error(d?.error || "Send failed");
            }
            setDraft("");
            // Refetch responses
            const r2 = await fetch(`/api/admin/raised/${item.id}`, { cache: "no-store" });
            if (r2.ok) {
                const d2 = await r2.json();
                setResponses(d2.responses || []);
            }
            onMutated();
        } catch (e: any) {
            setError(e?.message || "Send failed");
        } finally {
            setSending(null);
        }
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.aside
                initial={{ x: 520, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 520, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="fixed top-0 right-0 bottom-0 z-[95] w-full md:w-[560px] bg-[#0A0F1E] border-l border-white/10 flex flex-col"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div>
                        <p className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-1">
                            {item.kind === "doubt" ? "Doubt" : "Issue"} · P{item.phase ?? "—"}
                        </p>
                        <p className="text-white font-medium text-base">{item.title || item.description.slice(0, 70)}</p>
                        <p className="text-white/40 text-xs mt-0.5">
                            {item.client_name} · {item.company || "no co."} · {new Date(item.created_at).toLocaleString("en-IN")}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-white/5 text-white/50">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Description */}
                    <Section title="Description">
                        <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{item.description}</p>
                    </Section>

                    {/* Recordings (issue) */}
                    {item.screen_recording_url && (
                        <Section title="Screen recording" icon={<VideoIcon size={12} />}>
                            <video src={item.screen_recording_url} controls className="w-full rounded-lg bg-black max-h-72" />
                        </Section>
                    )}
                    {item.voice_recording_url && (
                        <Section title="Voice note" icon={<Mic size={12} />}>
                            <audio src={item.voice_recording_url} controls className="w-full" />
                        </Section>
                    )}

                    {/* Response history */}
                    {responses.length > 0 && (
                        <Section title="Response history">
                            <div className="space-y-2">
                                {responses.map(r => (
                                    <div key={r.id} className={`p-3 rounded-lg border ${r.from_role === "admin" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/[0.02] border-white/5"}`}>
                                        <p className="text-[9px] tracking-[0.2em] uppercase mb-1 text-white/40">
                                            {r.from_role} · {r.kind} · {new Date(r.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                        <p className="text-white/80 text-xs leading-relaxed whitespace-pre-line">{r.body}</p>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>

                {/* ─── Reply console ───────────────────────────────────── */}
                <div className="border-t border-white/10 p-4 space-y-2">
                    <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        rows={3}
                        placeholder="Custom message (optional for Ack/Resolve — required for Update)…"
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/85 text-sm placeholder-white/30 outline-none resize-none focus:border-white/25"
                    />
                    {error && <p className="text-rose-400 text-xs">{error}</p>}
                    <div className="grid grid-cols-3 gap-2">
                        <ActionButton
                            icon={<Clock size={12} />}
                            label="Send Ack"
                            kind="ack"
                            sending={sending}
                            onClick={() => send("ack")}
                            disabled={item.status !== "open"}
                            accent="#0EA5E9"
                        />
                        <ActionButton
                            icon={<Send size={12} />}
                            label="Update"
                            kind="progress"
                            sending={sending}
                            onClick={() => send("progress")}
                            disabled={item.status === "resolved"}
                            accent="#3B6AE8"
                        />
                        <ActionButton
                            icon={<Check size={12} />}
                            label="Mark Resolved"
                            kind="resolution"
                            sending={sending}
                            onClick={() => send("resolution")}
                            disabled={item.status === "resolved"}
                            accent="#10B981"
                        />
                    </div>
                    <p className="text-[10px] text-white/30 leading-relaxed">
                        Ack and Resolve auto-template if message is empty. Resolve also emails the client.
                    </p>
                </div>
            </motion.aside>
        </>
    );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-2">
                {icon}
                <p className="text-[10px] tracking-[0.3em] uppercase text-white/40 font-semibold">{title}</p>
            </div>
            {children}
        </div>
    );
}

function ActionButton({
    icon, label, kind, sending, onClick, disabled, accent,
}: {
    icon: React.ReactNode; label: string;
    kind: "ack" | "progress" | "resolution";
    sending: string | null; onClick: () => void; disabled: boolean; accent: string;
}) {
    const isSending = sending === kind;
    return (
        <button
            onClick={onClick}
            disabled={disabled || !!sending}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}
        >
            {isSending ? <Loader2 size={12} className="animate-spin" /> : icon}
            {label}
        </button>
    );
}
