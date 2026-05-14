"use client";

// ─── RAISE DOUBT MODAL ─────────────────────────────────────────────────────
// Lightweight escalation form. Pulls recent chat context server-side so
// Dhananjay sees the full thread when he opens it in Mission Control.

import { useState } from "react";
import { motion } from "framer-motion";
import { X, MessageSquareWarning, Loader2 } from "lucide-react";

interface Props {
    token: string;
    sessionId: string | null;
    onClose: () => void;
    onSubmitted: () => void;
}

const SOFT_CYAN = "#7DD3FC";
const ACCENT_DEEP = "#0284C7";

const MAX = 1500;

export default function RaiseDoubtModal({ token, sessionId, onClose, onSubmitted }: Props) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    async function submit() {
        if (!description.trim()) {
            setError("Please describe your doubt before submitting.");
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const r = await fetch(`/api/syn/raise-doubt/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim() || undefined,
                    description: description.trim(),
                    chatSessionId: sessionId || undefined,
                }),
            });
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                throw new Error(d?.detail || d?.error || "Submission failed");
            }
            setDone(true);
            setTimeout(() => { onSubmitted(); }, 1400);
        } catch (e: any) {
            setError(e?.message || "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-sm px-4"
            onClick={onClose}
            style={{ cursor: "auto" }}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                style={{ border: `1px solid ${SOFT_CYAN}`, cursor: "auto" }}
                onClick={e => e.stopPropagation()}
            >
                <style jsx>{`
                    div :global(*) { cursor: auto !important; }
                    div :global(button) { cursor: pointer !important; }
                    div :global(input), div :global(textarea) { cursor: text !important; }
                `}</style>

                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: `${SOFT_CYAN}50`, background: `${SOFT_CYAN}10` }}>
                    <div className="flex items-center gap-2">
                        <MessageSquareWarning size={16} style={{ color: ACCENT_DEEP }} />
                        <p className="text-sm font-semibold" style={{ color: ACCENT_DEEP }}>Raise Doubt</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100">
                        <X size={16} className="text-slate-600" />
                    </button>
                </div>

                {done ? (
                    <div className="px-6 py-10 text-center">
                        <div className="w-14 h-14 mx-auto rounded-full grid place-items-center mb-3" style={{ background: `${SOFT_CYAN}20`, border: `2px solid ${SOFT_CYAN}` }}>
                            <span className="text-2xl">✓</span>
                        </div>
                        <p className="text-slate-800 font-semibold text-sm">Doubt submitted</p>
                        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                            Dhananjay has been notified. You'll see an acknowledgement here and in your email shortly.
                        </p>
                    </div>
                ) : (
                    <div className="px-5 py-4 space-y-3">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Couldn't get the answer you needed from Syn? Drop the gist below and we'll route it to Dhananjay with your full chat context attached.
                        </p>

                        <div>
                            <label className="text-[10px] tracking-[0.2em] uppercase text-slate-500 font-semibold">Title (optional)</label>
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Short headline"
                                className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none bg-slate-50"
                                style={{ border: `1px solid ${SOFT_CYAN}40` }}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] tracking-[0.2em] uppercase text-slate-500 font-semibold">Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value.slice(0, MAX))}
                                rows={5}
                                placeholder="Describe what you'd like clarified or decided…"
                                className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none bg-slate-50 resize-none"
                                style={{ border: `1px solid ${SOFT_CYAN}40` }}
                            />
                            <p className="text-[10px] text-slate-400 mt-1 text-right">{description.length}/{MAX}</p>
                        </div>

                        {error && (
                            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                        )}

                        <button
                            onClick={submit}
                            disabled={submitting || !description.trim()}
                            className="w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ background: `linear-gradient(135deg, #0EA5E9 0%, ${ACCENT_DEEP} 100%)` }}
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            {submitting ? "Sending…" : "Submit doubt"}
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
