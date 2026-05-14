"use client";

// ─── SYN CHAT PANEL ────────────────────────────────────────────────────────
// Right-side white slide-in. Streams DeepSeek responses.
// Client mode: shows Raise Doubt + Raise Issue.
// Admin mode:  strategy console, no raise buttons.
// Fixes in this revision:
//   - textarea auto-resizes up to ~10 lines, then internal scroll
//   - voice-to-text only commits FINAL transcripts (no more duplicate phrases)
//   - admin endpoint routing

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    X, Send, Paperclip, Mic, Square, Sparkles, AlertCircle, MessageSquareWarning, Bell,
} from "lucide-react";
import RaiseDoubtModal from "./RaiseDoubtModal";
import RaiseIssueModal from "./RaiseIssueModal";
import MyRaisesPanel from "./MyRaisesPanel";
import { Inbox } from "lucide-react";

interface Msg { id: string; role: "user" | "assistant"; content: string; pending?: boolean }

interface Props {
    mode: "client" | "admin";
    token?: string;
    clientName?: string;
    phase?: number;
    onClose: () => void;
    onRaisedResolved?: () => void;
}

const SOFT_CYAN = "#7DD3FC";
const ACCENT_CYAN = "#0EA5E9";
const ACCENT_DEEP = "#0284C7";

const MAX_TEXTAREA_PX = 220; // ~10 lines @ 22px line-height

export default function SynChatPanel({
    mode, token, clientName, phase, onClose, onRaisedResolved,
}: Props) {
    const isClient = mode === "client";
    const apiBase = isClient ? `/api/syn/chat/${token}` : `/api/syn/admin-chat`;

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doubtOpen, setDoubtOpen] = useState(false);
    const [issueOpen, setIssueOpen] = useState(false);
    const [raisesOpen, setRaisesOpen] = useState(false);
    const [recording, setRecording] = useState(false);
    const [unreadRaised, setUnreadRaised] = useState(0);
    const [totalRaised, setTotalRaised] = useState(0);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const recognitionRef = useRef<any>(null);

    // ─── Load latest session on open ─────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch(apiBase, { cache: "no-store" });
                if (!r.ok || cancelled) return;
                const d = await r.json();
                if (cancelled) return;
                if (d?.session?.id) setSessionId(d.session.id);
                if (Array.isArray(d?.messages) && d.messages.length) {
                    setMessages(d.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
                }
            } catch { /* silent */ }
        })();
        return () => { cancelled = true; };
    }, [apiBase]);

    // ─── Load raised unread count (client only) ──────────────────────────
    useEffect(() => {
        if (!isClient || !token) return;
        let cancelled = false;
        const load = async () => {
            try {
                const r = await fetch(`/api/syn/raised/${token}`, { cache: "no-store" });
                if (!r.ok || cancelled) return;
                const d = await r.json();
                if (cancelled) return;
                setUnreadRaised(d?.counts?.unread || 0);
                setTotalRaised((d?.items || []).length);
            } catch { /* silent */ }
        };
        load();
        const iv = setInterval(load, 15_000);
        return () => { cancelled = true; clearInterval(iv); };
    }, [isClient, token]);

    // Auto-scroll
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    // Focus input on open
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Auto-resize textarea up to MAX_TEXTAREA_PX
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        const next = Math.min(el.scrollHeight, MAX_TEXTAREA_PX);
        el.style.height = next + "px";
        el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_PX ? "auto" : "hidden";
    }, [input]);

    // ─── Send a message — streamed ───────────────────────────────────────
    async function send() {
        const text = input.trim();
        if (!text || streaming) return;
        setError(null);

        const userMsg: Msg = { id: `u_${Date.now()}`, role: "user", content: text };
        const assistantId = `a_${Date.now()}`;
        const assistantMsg: Msg = { id: assistantId, role: "assistant", content: "", pending: true };
        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setInput("");
        setStreaming(true);

        try {
            const res = await fetch(apiBase, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, sessionId }),
            });

            if (!res.ok || !res.body) {
                const detail = await res.text().catch(() => "");
                throw new Error(detail || `Syn failed (${res.status})`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const events = buf.split("\n\n");
                buf = events.pop() || "";
                for (const ev of events) {
                    const lines = ev.split("\n");
                    let evt = ""; let dataLine = "";
                    for (const ln of lines) {
                        if (ln.startsWith("event:")) evt = ln.slice(6).trim();
                        if (ln.startsWith("data:")) dataLine = ln.slice(5).trim();
                    }
                    if (!dataLine) continue;
                    let payload: any = null;
                    try { payload = JSON.parse(dataLine); } catch { continue; }
                    if (evt === "session" && payload?.sessionId) setSessionId(payload.sessionId);
                    if (evt === "token" && typeof payload?.delta === "string") {
                        setMessages(prev => prev.map(m =>
                            m.id === assistantId ? { ...m, content: m.content + payload.delta, pending: true } : m
                        ));
                    }
                    if (evt === "error") throw new Error(payload?.error || "Stream error");
                    if (evt === "done") {
                        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, pending: false } : m));
                    }
                }
            }
        } catch (e: any) {
            setError(e?.message || "Something went wrong");
            setMessages(prev => prev.filter(m => m.id !== assistantId || m.content.length > 0).map(m =>
                m.id === assistantId ? { ...m, pending: false } : m
            ));
        } finally {
            setStreaming(false);
        }
    }

    // ─── Voice input — FINAL transcripts only (no duplicates) ───────────
    function toggleVoiceInput() {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            setError("Speech recognition not supported in this browser.");
            return;
        }
        if (recording) {
            try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
            setRecording(false);
            return;
        }
        const rec = new SR();
        rec.lang = "en-IN";
        rec.continuous = true;       // keep listening until stopped
        rec.interimResults = true;   // get interim for visual feedback
        let committedIndex = 0;      // only commit results past this index once
        rec.onresult = (ev: any) => {
            let finalChunk = "";
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const result = ev.results[i];
                if (result.isFinal && i >= committedIndex) {
                    finalChunk += result[0].transcript;
                    committedIndex = i + 1;
                }
            }
            const trimmed = finalChunk.trim();
            if (trimmed) {
                setInput(prev => (prev ? prev.replace(/\s+$/, "") + " " : "") + trimmed);
            }
        };
        rec.onend = () => setRecording(false);
        rec.onerror = () => setRecording(false);
        recognitionRef.current = rec;
        rec.start();
        setRecording(true);
    }

    function onAttachClick() {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "image/*,application/pdf,.txt,.md,.json";
        inp.onchange = async () => {
            const f = inp.files?.[0];
            if (!f) return;
            setInput(prev => (prev ? prev + "\n" : "") + `[attached: ${f.name} · ${(f.size / 1024).toFixed(0)}KB]`);
        };
        inp.click();
    }

    function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    const headerTitle = isClient
        ? `Syn ${clientName ? `· hi, ${clientName.split(" ")[0]}` : ""}`
        : `Syn · Strategy console`;
    const headerLabel = isClient ? "Synapsis · Concierge" : "Synapsis · Admin";

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[90]"
                onClick={onClose}
            />

            <motion.aside
                initial={{ x: 480, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 480, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="fixed top-0 right-0 bottom-0 z-[95] w-full sm:w-[460px] md:w-[500px] bg-white shadow-2xl flex flex-col"
                style={{
                    cursor: "auto",
                    borderLeft: `1px solid ${SOFT_CYAN}`,
                    boxShadow: `-20px 0 60px -20px ${SOFT_CYAN}40, -8px 0 24px -8px rgba(0,0,0,0.15)`,
                } as React.CSSProperties}
            >
                <style jsx>{`
                    aside :global(*) { cursor: auto !important; }
                    aside :global(button), aside :global(a) { cursor: pointer !important; }
                    aside :global(input), aside :global(textarea) { cursor: text !important; }
                `}</style>

                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: `${SOFT_CYAN}80`, background: `linear-gradient(180deg, ${SOFT_CYAN}10 0%, rgba(255,255,255,1) 100%)` }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-xl grid place-items-center"
                            style={{ background: `linear-gradient(135deg, ${ACCENT_CYAN} 0%, ${ACCENT_DEEP} 100%)` }}
                        >
                            <Sparkles size={16} className="text-white" strokeWidth={2.2} />
                        </div>
                        <div>
                            <p className="text-[10px] tracking-[0.3em] uppercase font-semibold" style={{ color: ACCENT_DEEP }}>
                                {headerLabel}
                            </p>
                            <p className="text-slate-800 text-sm font-semibold mt-0.5">
                                {headerTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-lg grid place-items-center hover:bg-slate-100 transition-colors"
                        aria-label="Close chat"
                    >
                        <X size={18} className="text-slate-600" />
                    </button>
                </div>

                {/* Raise actions row — client only */}
                {isClient && (
                    <div className="flex items-center gap-2 px-5 py-2.5 border-b bg-slate-50" style={{ borderColor: `${SOFT_CYAN}50` }}>
                        <button
                            onClick={() => setDoubtOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02]"
                            style={{ background: "#fff", border: `1px solid ${SOFT_CYAN}`, color: ACCENT_DEEP }}
                        >
                            <MessageSquareWarning size={12} />
                            Raise Doubt
                        </button>
                        <button
                            onClick={() => setIssueOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02]"
                            style={{ background: "#fff", border: "1px solid #FECACA", color: "#DC2626" }}
                        >
                            <AlertCircle size={12} />
                            Raise Issue
                        </button>
                        <div className="ml-auto" />
                        {totalRaised > 0 && (
                            <button
                                onClick={() => setRaisesOpen(true)}
                                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02]"
                                style={{
                                    background: unreadRaised > 0 ? `${ACCENT_DEEP}` : "#fff",
                                    border: `1px solid ${unreadRaised > 0 ? ACCENT_DEEP : SOFT_CYAN}`,
                                    color: unreadRaised > 0 ? "#fff" : ACCENT_DEEP,
                                }}
                            >
                                <Inbox size={12} />
                                My updates
                                {unreadRaised > 0 && (
                                    <span className="ml-1 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full bg-white text-red-600 text-[9px] font-bold">
                                        {unreadRaised}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Sticky banner when there are unread responses */}
                {isClient && unreadRaised > 0 && !raisesOpen && (
                    <button
                        onClick={() => setRaisesOpen(true)}
                        className="w-full px-5 py-2.5 flex items-center gap-2 text-left transition-colors"
                        style={{ background: `${ACCENT_DEEP}10`, borderBottom: `1px solid ${ACCENT_DEEP}30` }}
                    >
                        <Bell size={13} style={{ color: ACCENT_DEEP }} />
                        <p className="text-xs font-semibold flex-1" style={{ color: ACCENT_DEEP }}>
                            Dhananjay responded to {unreadRaised === 1 ? "your raise" : `${unreadRaised} of your raises`}
                        </p>
                        <span className="text-[10px] font-semibold underline" style={{ color: ACCENT_DEEP }}>View</span>
                    </button>
                )}

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center py-8">
                            <div
                                className="w-14 h-14 mx-auto rounded-2xl grid place-items-center mb-3"
                                style={{ background: `linear-gradient(135deg, ${SOFT_CYAN}40 0%, ${ACCENT_CYAN}20 100%)` }}
                            >
                                <Sparkles size={22} style={{ color: ACCENT_DEEP }} />
                            </div>
                            <p className="text-slate-800 font-semibold text-sm">
                                {isClient ? "Hi, I'm Syn." : "Dhananjay — strategy mode."}
                            </p>
                            <p className="text-slate-500 text-xs mt-1 leading-relaxed max-w-[280px] mx-auto">
                                {isClient
                                    ? "Anything about your project, your phase, or Synapsis itself — I've got you. If I can't solve it, I'll route it to Dhananjay."
                                    : "Bounce ideas, drafts, decision frameworks, or anything strategic for Synapsis. Off the record — no client data leaks here."}
                            </p>
                            <div className="grid gap-2 mt-5">
                                {(isClient
                                    ? ["What does my current phase mean?", "What do I need to do next?", "How does the payment system work?"]
                                    : ["Help me draft a project brief response", "Sanity check my pricing for this project", "Strategy for following up with cold leads"]
                                ).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setInput(s)}
                                        className="text-left px-3 py-2 rounded-lg text-xs text-slate-700 transition-all"
                                        style={{ background: `${SOFT_CYAN}15`, border: `1px solid ${SOFT_CYAN}50` }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map(m => (
                        <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                                    m.role === "user"
                                        ? "text-white rounded-br-md"
                                        : "text-slate-800 rounded-bl-md"
                                }`}
                                style={
                                    m.role === "user"
                                        ? { background: `linear-gradient(135deg, ${ACCENT_CYAN} 0%, ${ACCENT_DEEP} 100%)` }
                                        : { background: `${SOFT_CYAN}10`, border: `1px solid ${SOFT_CYAN}40` }
                                }
                            >
                                {m.content}
                                {m.pending && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current ml-1 animate-pulse" />}
                            </div>
                        </div>
                    ))}

                    {error && (
                        <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}
                </div>

                {/* Input bar */}
                <div className="p-3 border-t bg-white" style={{ borderColor: `${SOFT_CYAN}50` }}>
                    <div
                        className="flex items-end gap-1.5 rounded-2xl bg-slate-50 px-2.5 py-2 transition-all"
                        style={{ border: `1px solid ${SOFT_CYAN}60` }}
                    >
                        <button
                            onClick={onAttachClick}
                            className="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-200 text-slate-500 transition-colors shrink-0"
                            aria-label="Attach file"
                            disabled={streaming}
                        >
                            <Paperclip size={15} />
                        </button>
                        <button
                            onClick={toggleVoiceInput}
                            className={`w-8 h-8 grid place-items-center rounded-lg transition-colors shrink-0 ${recording ? "bg-red-100 text-red-600" : "hover:bg-slate-200 text-slate-500"}`}
                            aria-label={recording ? "Stop dictation" : "Voice input"}
                            disabled={streaming}
                        >
                            {recording ? <Square size={13} fill="currentColor" /> : <Mic size={15} />}
                        </button>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={onKey}
                            placeholder={streaming ? "Syn is thinking…" : (isClient ? "Ask Syn anything about your project…" : "Talk to Syn…")}
                            rows={1}
                            disabled={streaming}
                            className="flex-1 bg-transparent text-slate-800 text-[13px] placeholder-slate-400 outline-none resize-none py-1.5 leading-[22px]"
                            style={{ minHeight: 24, maxHeight: MAX_TEXTAREA_PX }}
                        />
                        <button
                            onClick={send}
                            disabled={streaming || !input.trim()}
                            className="w-8 h-8 grid place-items-center rounded-lg transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed self-end"
                            style={{
                                background: `linear-gradient(135deg, ${ACCENT_CYAN} 0%, ${ACCENT_DEEP} 100%)`,
                                color: "#fff",
                            }}
                            aria-label="Send"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                    {isClient && (
                        <p className="text-[9px] text-slate-400 mt-1.5 px-1 tracking-wide">
                            Syn is an AI concierge. For anything it can't solve, use <span className="font-semibold" style={{ color: ACCENT_DEEP }}>Raise Doubt</span> or <span className="font-semibold text-red-600">Raise Issue</span>.
                        </p>
                    )}
                </div>
            </motion.aside>

            {/* Raise modals — client only */}
            {isClient && token && doubtOpen && (
                <RaiseDoubtModal
                    token={token}
                    sessionId={sessionId}
                    onClose={() => setDoubtOpen(false)}
                    onSubmitted={() => { setDoubtOpen(false); onRaisedResolved?.(); }}
                />
            )}
            {isClient && token && issueOpen && (
                <RaiseIssueModal
                    token={token}
                    onClose={() => setIssueOpen(false)}
                    onSubmitted={() => { setIssueOpen(false); onRaisedResolved?.(); }}
                />
            )}
            {isClient && token && raisesOpen && (
                <MyRaisesPanel
                    token={token}
                    onClose={() => setRaisesOpen(false)}
                    onRead={() => {
                        // Refresh unread count after read
                        fetch(`/api/syn/raised/${token}`, { cache: "no-store" })
                            .then(r => r.ok ? r.json() : null)
                            .then(d => {
                                if (d) {
                                    setUnreadRaised(d?.counts?.unread || 0);
                                    onRaisedResolved?.();
                                }
                            })
                            .catch(() => {});
                    }}
                />
            )}
        </>
    );
}
