"use client";

// ─── SYN VOICE PANEL ──────────────────────────────────────────────────────
// Full-screen voice conversation overlay. Reuses /api/syn/chat/[token]
// for the brain. Browser Web Speech API for STT + speechSynthesis for TTS.
// Cloned XTTS voice will swap in at Sprint 1.5 by replacing speakViaBrowser
// with a fetch to /api/voice/tts that returns Dhananjay's cloned WAV.

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Volume2, VolumeX, Settings2, Sparkles } from "lucide-react";

type State = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Msg { role: "user" | "assistant"; content: string; }

interface Props {
    mode: "client" | "admin";
    token?: string;
    clientName?: string;
    phase?: number;
    onClose: () => void;
}

const AZURE = "#11B8EA";
const ROYAL = "#3B6AE8";

// Sentence-boundary regex — flushes buffer to TTS queue when matched
const SENTENCE_END = /([.!?।]|\n\n)\s*$/;

export default function SynVoicePanel({ mode, token, clientName, phase, onClose }: Props) {
    const isClient = mode === "client";
    const apiBase = isClient ? `/api/syn/chat/${token}` : `/api/syn/admin-chat`;

    const [state, setState] = useState<State>("idle");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [transcript, setTranscript] = useState("");        // live STT transcript
    const [pendingTranscript, setPendingTranscript] = useState(""); // partial
    const [reply, setReply] = useState("");                  // current assistant reply
    const [history, setHistory] = useState<Msg[]>([]);       // running session
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [voiceList, setVoiceList] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
    const [showSettings, setShowSettings] = useState(false);

    const recognitionRef = useRef<any>(null);
    const ttsQueueRef = useRef<string[]>([]);
    const speakingRef = useRef<boolean>(false);
    const abortRef = useRef<AbortController | null>(null);

    // ─── Load existing session messages on mount ─────────────────────────
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
                    setHistory(d.messages.map((m: any) => ({ role: m.role, content: m.content })));
                }
            } catch { /* silent */ }
        })();
        return () => { cancelled = true; };
    }, [apiBase]);

    // ─── Discover available system voices ─────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        const load = () => {
            const voices = window.speechSynthesis.getVoices();
            setVoiceList(voices);
            // Prefer Indian English male voice if available
            const preferred =
                voices.find(v => /en-IN.*Male/i.test(v.name + v.lang)) ||
                voices.find(v => /en-IN/i.test(v.lang)) ||
                voices.find(v => /Indian/i.test(v.name)) ||
                voices.find(v => /Male/i.test(v.name) && /en/i.test(v.lang)) ||
                voices.find(v => /en/i.test(v.lang)) ||
                voices[0];
            if (preferred && !selectedVoiceURI) setSelectedVoiceURI(preferred.voiceURI);
        };
        load();
        window.speechSynthesis.onvoiceschanged = load;
        return () => { if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = null; };
    }, [selectedVoiceURI]);

    // ─── Cleanup on unmount ───────────────────────────────────────────────
    useEffect(() => {
        return () => {
            try { recognitionRef.current?.stop?.(); } catch {}
            try { window.speechSynthesis?.cancel?.(); } catch {}
            abortRef.current?.abort();
        };
    }, []);

    // ─── TTS queue: enqueue + auto-drain by chaining utterance.onend ──────
    const drainTTS = useCallback(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        if (speakingRef.current) return; // already speaking; chain handles next
        const next = ttsQueueRef.current.shift();
        if (!next) {
            // Queue drained — only flip to idle if not currently in another state
            setState(s => (s === "speaking" ? "idle" : s));
            return;
        }
        const u = new SpeechSynthesisUtterance(next);
        const v = voiceList.find(x => x.voiceURI === selectedVoiceURI);
        if (v) u.voice = v;
        u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
        u.onstart = () => { speakingRef.current = true; setState("speaking"); };
        u.onend = () => {
            speakingRef.current = false;
            // Chain next chunk without setTimeout flicker
            drainTTS();
        };
        u.onerror = (e) => {
            console.error("[voice tts]", e);
            speakingRef.current = false;
            drainTTS();
        };
        window.speechSynthesis.speak(u);
    }, [voiceList, selectedVoiceURI]);

    const enqueueTTS = useCallback((text: string) => {
        if (!ttsEnabled || !text.trim()) return;
        ttsQueueRef.current.push(text);
        drainTTS();
    }, [drainTTS, ttsEnabled]);

    // ─── Send a message to the brain and stream the reply ─────────────────
    const sendToSyn = useCallback(async (userText: string) => {
        const text = userText.trim();
        if (!text) return;

        // Push user turn to UI history immediately
        setHistory(h => [...h, { role: "user", content: text }]);
        setReply("");
        setState("thinking");
        setErrorMsg(null);

        // Cancel any in-flight stream
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        let buffer = "";
        let accumulated = "";

        try {
            const res = await fetch(apiBase, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, sessionId }),
                signal: abortRef.current.signal,
            });

            if (!res.ok || !res.body) {
                const errBody = await res.text().catch(() => "");
                throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let raw = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                raw += decoder.decode(value, { stream: true });

                const lines = raw.split("\n");
                raw = lines.pop() || "";

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line.startsWith("event:") && !line.startsWith("data:")) continue;
                    if (line.startsWith("event:")) {
                        // event-only lines; next iteration carries data
                        continue;
                    }
                    const payload = line.slice(5).trim();
                    try {
                        const parsed = JSON.parse(payload);
                        if (parsed.sessionId && !sessionId) setSessionId(parsed.sessionId);
                        if (typeof parsed.delta === "string") {
                            accumulated += parsed.delta;
                            buffer += parsed.delta;
                            setReply(prev => prev + parsed.delta);

                            // Flush buffer to TTS on sentence boundary
                            if (SENTENCE_END.test(buffer) && buffer.trim().length > 6) {
                                enqueueTTS(buffer);
                                buffer = "";
                            }
                        }
                    } catch { /* malformed chunk, skip */ }
                }
            }

            // Flush final tail
            if (buffer.trim().length > 0) {
                enqueueTTS(buffer);
            }

            // Commit assistant turn to history
            setHistory(h => [...h, { role: "assistant", content: accumulated || "(no response)" }]);

            // If TTS disabled, jump straight to idle
            if (!ttsEnabled) setState("idle");
            // Otherwise speaking state will transition itself when queue drains
        } catch (e: any) {
            if (e?.name === "AbortError") return;
            console.error("[voice send]", e);
            setErrorMsg(String(e?.message || e).slice(0, 240));
            setState("error");
        }
    }, [apiBase, sessionId, enqueueTTS, ttsEnabled]);

    // ─── Start / stop microphone (Web Speech API) ─────────────────────────
    const startListening = useCallback(() => {
        if (typeof window === "undefined") return;
        const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            setErrorMsg("Speech recognition not supported in this browser. Use Chrome or Edge.");
            setState("error");
            return;
        }

        // Cancel any TTS that may be playing
        try { window.speechSynthesis?.cancel?.(); } catch {}
        ttsQueueRef.current = [];
        speakingRef.current = false;

        const rec = new SR();
        rec.lang = "en-IN";
        rec.continuous = true;
        rec.interimResults = true;

        let finalText = "";
        let lastInterim = "";

        rec.onresult = (event: any) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                if (r.isFinal) {
                    finalText += r[0].transcript + " ";
                } else {
                    interim += r[0].transcript;
                }
            }
            lastInterim = interim;
            setPendingTranscript(interim);
            if (finalText) setTranscript(finalText);
        };

        rec.onerror = (e: any) => {
            console.error("[voice stt]", e);
            if (e.error === "no-speech") return; // benign
            setErrorMsg(`Mic error: ${e.error}`);
        };

        rec.onend = () => {
            // Auto-finalize: send whatever was captured (closure-local, not React state)
            const combined = (finalText + " " + lastInterim).trim();
            setPendingTranscript("");
            if (combined.length > 0) {
                sendToSyn(combined);
            } else {
                setState("idle");
            }
        };

        rec.start();
        recognitionRef.current = rec;
        setState("listening");
        setTranscript("");
        setPendingTranscript("");
    }, [sendToSyn]);

    const stopListening = useCallback(() => {
        try { recognitionRef.current?.stop?.(); } catch {}
    }, []);

    const onMicToggle = useCallback(() => {
        if (state === "listening") {
            stopListening();
        } else if (state === "speaking" || state === "thinking") {
            // Interrupt — cancel TTS, abort fetch, start fresh listening
            try { window.speechSynthesis?.cancel?.(); } catch {}
            ttsQueueRef.current = [];
            abortRef.current?.abort();
            startListening();
        } else {
            startListening();
        }
    }, [state, startListening, stopListening]);

    // ─── State-driven copy ────────────────────────────────────────────────
    const stateLabel: Record<State, string> = {
        idle: "Tap to speak",
        listening: "Listening...",
        thinking: "Thinking...",
        speaking: "Syn is speaking",
        error: "Something broke",
    };
    const stateSubtitle: Record<State, string> = {
        idle: "Press the mic and ask anything",
        listening: "Speak naturally — Hinglish welcome",
        thinking: "Reading your deal state, formulating",
        speaking: "Tap to interrupt",
        error: errorMsg ?? "Tap to retry",
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{
                background: "radial-gradient(ellipse at center, rgba(11,18,38,0.95) 0%, rgba(5,8,18,0.98) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
            }}
        >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-full grid place-items-center"
                        style={{
                            background: `linear-gradient(135deg, ${ROYAL}, ${AZURE})`,
                            boxShadow: `0 0 24px ${AZURE}55`,
                        }}
                    >
                        <Sparkles size={16} className="text-white" />
                    </div>
                    <div>
                        <div className="text-white/95 text-sm font-semibold tracking-wide">SYN</div>
                        <div className="text-white/45 text-[10px] uppercase tracking-[0.2em]">Voice agent · {isClient ? "Client" : "Admin"} mode</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setTtsEnabled(v => !v)}
                        aria-label={ttsEnabled ? "Mute Syn" : "Unmute Syn"}
                        className="w-10 h-10 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/8 transition"
                    >
                        {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowSettings(v => !v)}
                        aria-label="Voice settings"
                        className="w-10 h-10 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/8 transition"
                    >
                        <Settings2 size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close voice agent"
                        className="w-10 h-10 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/8 transition"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Settings panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute top-20 right-6 w-[300px] rounded-2xl p-4 z-10"
                        style={{
                            background: "rgba(15,22,40,0.92)",
                            border: `1px solid ${AZURE}30`,
                            backdropFilter: "blur(18px)",
                            WebkitBackdropFilter: "blur(18px)",
                        }}
                    >
                        <div className="text-white/85 text-xs font-semibold mb-3 tracking-wide">VOICE OUTPUT</div>
                        <select
                            value={selectedVoiceURI}
                            onChange={e => setSelectedVoiceURI(e.target.value)}
                            className="w-full bg-[#0a0f1e] text-white/90 text-xs rounded-lg px-3 py-2 border border-white/10 focus:border-[#11B8EA] outline-none"
                        >
                            {voiceList.map(v => (
                                <option key={v.voiceURI} value={v.voiceURI}>
                                    {v.name} ({v.lang})
                                </option>
                            ))}
                        </select>
                        <p className="text-white/40 text-[10px] mt-3 leading-relaxed">
                            Browser TTS for now. Cloned voice (XTTS-v2) drops in once Sprint 0 samples are approved.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Center stack: orb + transcript */}
            <div className="flex flex-col items-center justify-center w-full max-w-3xl px-6">
                {/* Orb */}
                <button
                    type="button"
                    onClick={onMicToggle}
                    aria-label="Toggle microphone"
                    className="relative group focus:outline-none"
                    style={{ width: 260, height: 260 }}
                >
                    {/* Outer halo */}
                    <motion.div
                        className="absolute inset-0 rounded-full"
                        animate={{
                            scale: state === "listening" ? [1, 1.18, 1] : state === "speaking" ? [1, 1.10, 1] : state === "thinking" ? [1, 1.04, 1] : [1, 1.02, 1],
                            opacity: state === "idle" ? 0.35 : 0.65,
                        }}
                        transition={{
                            duration: state === "listening" ? 0.9 : state === "speaking" ? 1.1 : state === "thinking" ? 2.5 : 4,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        style={{
                            background: `radial-gradient(circle, ${state === "listening" ? AZURE : ROYAL}55 0%, transparent 70%)`,
                            filter: "blur(28px)",
                        }}
                    />
                    {/* Mid ring */}
                    <motion.div
                        className="absolute inset-6 rounded-full"
                        animate={{
                            rotate: state === "thinking" ? 360 : 0,
                            scale: state === "speaking" ? [1, 1.04, 1] : 1,
                        }}
                        transition={{
                            rotate: { duration: 6, repeat: Infinity, ease: "linear" },
                            scale: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
                        }}
                        style={{
                            background: `conic-gradient(from 0deg, ${ROYAL}, ${AZURE}, ${ROYAL})`,
                            opacity: 0.45,
                            filter: "blur(8px)",
                        }}
                    />
                    {/* Core */}
                    <motion.div
                        className="absolute inset-10 rounded-full grid place-items-center"
                        animate={{
                            boxShadow: state === "listening"
                                ? [`0 0 60px ${AZURE}80`, `0 0 100px ${AZURE}aa`, `0 0 60px ${AZURE}80`]
                                : state === "speaking"
                                    ? [`0 0 50px ${ROYAL}90`, `0 0 80px ${ROYAL}aa`, `0 0 50px ${ROYAL}90`]
                                    : `0 0 40px ${ROYAL}70`,
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                            background: `radial-gradient(circle at 30% 30%, ${AZURE}, ${ROYAL} 70%, #0a0f1e 100%)`,
                            border: `1px solid ${AZURE}66`,
                        }}
                    >
                        {state === "listening" ? (
                            <Mic size={56} className="text-white" strokeWidth={1.6} />
                        ) : state === "error" ? (
                            <MicOff size={56} className="text-white" strokeWidth={1.6} />
                        ) : (
                            <Sparkles size={48} className="text-white/95" strokeWidth={1.4} />
                        )}
                    </motion.div>
                </button>

                {/* Label */}
                <div className="mt-10 text-center">
                    <div className="text-white text-xl font-light tracking-wide">
                        {stateLabel[state]}
                    </div>
                    <div className="text-white/50 text-sm mt-1.5">
                        {stateSubtitle[state]}
                    </div>
                </div>

                {/* Live transcript area */}
                <div className="mt-8 w-full max-w-xl min-h-[80px]">
                    <AnimatePresence mode="wait">
                        {state === "listening" && (transcript || pendingTranscript) && (
                            <motion.div
                                key="transcript"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="text-center text-white/85 text-base leading-relaxed px-6"
                            >
                                <span className="text-white">{transcript}</span>
                                <span className="text-white/40">{pendingTranscript}</span>
                            </motion.div>
                        )}
                        {(state === "speaking" || state === "thinking") && reply && (
                            <motion.div
                                key="reply"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="text-center text-white/90 text-base leading-relaxed px-6 max-h-[180px] overflow-y-auto"
                            >
                                {reply}
                            </motion.div>
                        )}
                        {state === "error" && (
                            <motion.div
                                key="err"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center text-rose-300/90 text-sm px-6"
                            >
                                {errorMsg}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Bottom history pill */}
            {history.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-full px-6">
                    <details className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
                        <summary className="cursor-pointer px-4 py-2.5 text-white/60 text-xs tracking-wide uppercase select-none">
                            Conversation ({history.length})
                        </summary>
                        <div className="px-4 pb-4 pt-1 max-h-[260px] overflow-y-auto space-y-3">
                            {history.slice(-8).map((m, i) => (
                                <div key={i} className="text-sm">
                                    <div className={`text-[10px] uppercase tracking-wider mb-0.5 ${m.role === "user" ? "text-[#11B8EA]" : "text-[#3B6AE8]"}`}>
                                        {m.role === "user" ? (clientName || "You") : "Syn"}
                                    </div>
                                    <div className="text-white/80 leading-relaxed">{m.content}</div>
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            )}
        </motion.div>
    );
}
