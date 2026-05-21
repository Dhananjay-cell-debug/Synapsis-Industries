"use client";

// ─── SYN VOICE PANEL ──────────────────────────────────────────────────────
// Calling-style slide-in drawer (right side, ~440px). Reuses /api/syn/chat/[token].
//
// Behavior:
//   - Auto-connects on mount: requests mic, starts continuous STT + VAD
//   - Hands-free: user can just talk. VAD detects voice start (barge-in
//     interrupts Syn's TTS) and voice end (silence → auto-submit to brain)
//   - Markdown stripped before TTS so asterisks/hashes aren't read literally
//   - Premium calling layout: avatar + live timer + mute / end / speaker
//
// Cloned voice swap point: replace drainTTS() to fetch /api/voice/tts
// (returns WAV/MP3 in Dhananjay's cloned voice) once XTTS-v2 or ElevenLabs
// is wired into the backend. Sprint 1.5 / 2.

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Settings2, Sparkles, X } from "lucide-react";
import SynVoiceOrb from "./SynVoiceOrb";

type State = "connecting" | "idle" | "listening" | "thinking" | "speaking" | "ended" | "error";

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
const SENTENCE_END = /([.!?।]|\n\n)\s*$/;

// Cloned voice: when enabled, TTS is fetched from /api/voice/tts (Dhananjay's
// approved XTTS clone). Falls back to the browser OS voice if the engine is
// offline/unconfigured, so the panel never breaks.
const USE_CLONED_VOICE = process.env.NEXT_PUBLIC_SYN_CLONED_VOICE === "1";

// VAD tuning — tested for built-in laptop mic with echoCancellation on
const VOICE_THRESHOLD = 0.022;                 // RMS to detect voice (idle/speaking → listening)
const VOICE_THRESHOLD_WHILE_SPEAKING = 0.045;  // higher bar during TTS playback (echo bleed)
const VOICE_MIN_DURATION_MS = 220;             // sustained voice needed to confirm (avoid clicks/pops)
const SILENCE_TIMEOUT_MS = 1200;               // silence after speech → end of utterance

// Strip all markdown / emoji noise before TTS so it doesn't speak asterisks aloud
function stripForVoice(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/\*([^*\s][^*]*?[^*\s]|\S)\*/g, "$1")
        .replace(/(?<!\w)_([^_\s][^_]*?[^_\s]|\S)_(?!\w)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s+/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])|[☀-➿]/g, "")
        .replace(/---+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]+/g, " ")
        .trim();
}

export default function SynVoicePanel({ mode, token, clientName, phase, onClose }: Props) {
    const isClient = mode === "client";
    const apiBase = isClient ? `/api/syn/chat/${token}` : `/api/syn/admin-chat`;

    const [state, setState] = useState<State>("connecting");
    const [muted, setMuted] = useState(false);
    const [speakerOn, setSpeakerOn] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [history, setHistory] = useState<Msg[]>([]);
    const [reply, setReply] = useState("");
    const [interim, setInterim] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [callStart, setCallStart] = useState<number | null>(null);
    const [callTimer, setCallTimer] = useState(0);
    const [voiceList, setVoiceList] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
    const [showSettings, setShowSettings] = useState(false);

    // Mutable refs — survive re-renders, used inside callbacks/loops
    const stateRef = useRef<State>("connecting");
    const mutedRef = useRef(false);
    const speakerOnRef = useRef(true);
    const streamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const vadRafRef = useRef<number | null>(null);
    const recognitionRef = useRef<any>(null);
    const restartRecRef = useRef<boolean>(true);
    const transcriptRef = useRef<string>("");
    const voiceActiveRef = useRef<boolean>(false);
    const voiceStartTsRef = useRef<number>(0);
    const lastVoiceTsRef = useRef<number>(0);
    const ttsQueueRef = useRef<string[]>([]);
    const speakingRef = useRef<boolean>(false);
    const abortRef = useRef<AbortController | null>(null);
    const submittedRef = useRef<boolean>(false);
    const clonedAudioRef = useRef<HTMLAudioElement | null>(null);   // current cloned-voice playback
    const clonedDisabledRef = useRef<boolean>(false);               // flips true if engine 503/unreachable → use browser voice rest of session
    const ttsAbortRef = useRef<AbortController | null>(null);       // aborts an in-flight /api/voice/tts fetch on barge-in

    // Mirror state into refs so loops/callbacks read current values
    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { mutedRef.current = muted; }, [muted]);
    useEffect(() => { speakerOnRef.current = speakerOn; }, [speakerOn]);

    // Call timer tick
    useEffect(() => {
        if (!callStart) return;
        const iv = setInterval(() => setCallTimer(Math.floor((Date.now() - callStart) / 1000)), 1000);
        return () => clearInterval(iv);
    }, [callStart]);

    // Load system TTS voices, prefer Indian English male
    useEffect(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        const load = () => {
            const voices = window.speechSynthesis.getVoices();
            setVoiceList(voices);
            const preferred =
                voices.find(v => /en-IN.*male/i.test(v.name + " " + v.lang)) ||
                voices.find(v => /Ravi|Hemant|Heera/i.test(v.name)) ||
                voices.find(v => /en-IN/i.test(v.lang)) ||
                voices.find(v => /Indian/i.test(v.name)) ||
                voices.find(v => /male/i.test(v.name) && /en/i.test(v.lang)) ||
                voices.find(v => /en/i.test(v.lang)) ||
                voices[0];
            if (preferred && !selectedVoiceURI) setSelectedVoiceURI(preferred.voiceURI);
        };
        load();
        window.speechSynthesis.onvoiceschanged = load;
        return () => { if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = null; };
    }, [selectedVoiceURI]);

    // Load existing session history
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

    // ─── Stop ALL playback (browser TTS + cloned-voice audio) — for barge-in,
    //     speaker-off, end-call, unmount. ──────────────────────────────────
    const stopAllPlayback = useCallback(() => {
        try { window.speechSynthesis.cancel(); } catch { /* */ }
        try { ttsAbortRef.current?.abort(); } catch { /* */ }
        const a = clonedAudioRef.current;
        if (a) {
            try { a.pause(); a.src = ""; } catch { /* */ }
            clonedAudioRef.current = null;
        }
        speakingRef.current = false;
    }, []);

    // Browser OS-voice fallback for a single utterance. Chains via onend.
    const speakBrowser = useCallback((clean: string, done: () => void) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) { done(); return; }
        const u = new SpeechSynthesisUtterance(clean);
        const v = voiceList.find(x => x.voiceURI === selectedVoiceURI);
        if (v) u.voice = v;
        u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
        u.onstart = () => { setState("speaking"); };
        u.onend = () => { done(); };
        u.onerror = () => { done(); };
        try { window.speechSynthesis.speak(u); }
        catch { done(); }
    }, [voiceList, selectedVoiceURI]);

    // Cloned voice for a single utterance: fetch /api/voice/tts → play WAV.
    // Resolves on natural end; rejects (→ caller falls back to browser voice)
    // on engine 503/unreachable. Aborted playback resolves quietly (barge-in).
    const speakCloned = useCallback((clean: string) => new Promise<void>((resolve, reject) => {
        const ac = new AbortController();
        ttsAbortRef.current = ac;
        fetch("/api/voice/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: clean }),
            signal: ac.signal,
        }).then(async (res) => {
            if (res.status === 503) { clonedDisabledRef.current = true; reject(new Error("unconfigured")); return; }
            if (!res.ok) { reject(new Error(`engine ${res.status}`)); return; }
            const blob = await res.blob();
            if (ac.signal.aborted) { resolve(); return; }
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            clonedAudioRef.current = audio;
            audio.onended = () => { URL.revokeObjectURL(url); if (clonedAudioRef.current === audio) clonedAudioRef.current = null; resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("play error")); };
            setState("speaking");
            audio.play().catch(() => { URL.revokeObjectURL(url); reject(new Error("play blocked")); });
        }).catch((e) => {
            if (ac.signal.aborted) { resolve(); return; }   // barge-in / unmount: not an error
            reject(e);
        });
    }), []);

    // ─── TTS queue: chain utterances via completion callback ──────────────
    const drainTTS = useCallback(() => {
        if (typeof window === "undefined") return;
        if (!speakerOnRef.current) {
            ttsQueueRef.current = [];
            stopAllPlayback();
            setState(s => (s === "speaking" ? "idle" : s));
            return;
        }
        if (speakingRef.current) return;
        const next = ttsQueueRef.current.shift();
        if (!next) {
            setState(s => (s === "speaking" ? "idle" : s));
            return;
        }
        const clean = stripForVoice(next);
        if (!clean || clean.length < 1) { drainTTS(); return; }

        speakingRef.current = true;
        setState("speaking");
        const advance = () => { speakingRef.current = false; drainTTS(); };

        if (USE_CLONED_VOICE && !clonedDisabledRef.current) {
            speakCloned(clean)
                .then(advance)
                .catch(() => { speakBrowser(clean, advance); });  // engine down → OS voice
        } else {
            speakBrowser(clean, advance);
        }
    }, [stopAllPlayback, speakBrowser, speakCloned]);

    // ─── Submit accumulated transcript to brain, stream reply ────────────
    const sendToSyn = useCallback(async (userText: string) => {
        const text = userText.trim();
        if (!text || submittedRef.current) return;
        submittedRef.current = true;

        setHistory(h => [...h, { role: "user", content: text }]);
        setReply("");
        setInterim("");
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
                const events = raw.split("\n\n");
                raw = events.pop() || "";

                for (const ev of events) {
                    const lines = ev.split("\n");
                    let evt = ""; let dataLine = "";
                    for (const ln of lines) {
                        if (ln.startsWith("event:")) evt = ln.slice(6).trim();
                        if (ln.startsWith("data:")) dataLine = ln.slice(5).trim();
                    }
                    if (!dataLine) continue;
                    let parsed: any = null;
                    try { parsed = JSON.parse(dataLine); } catch { continue; }
                    if (evt === "session" && parsed?.sessionId) setSessionId(parsed.sessionId);
                    if (evt === "token" && typeof parsed?.delta === "string") {
                        accumulated += parsed.delta;
                        buffer += parsed.delta;
                        setReply(prev => prev + parsed.delta);

                        // Flush buffer to TTS on sentence boundary
                        if (SENTENCE_END.test(buffer) && stripForVoice(buffer).length > 4) {
                            ttsQueueRef.current.push(buffer);
                            buffer = "";
                            drainTTS();
                        }
                    }
                    if (evt === "error") throw new Error(parsed?.error || "Stream error");
                }
            }

            // Flush remaining buffer
            if (buffer.trim().length > 0) {
                ttsQueueRef.current.push(buffer);
                drainTTS();
            }

            setHistory(h => [...h, { role: "assistant", content: accumulated || "(no response)" }]);

            // If speaker is off, jump to idle immediately
            if (!speakerOnRef.current) {
                setState(s => (s === "thinking" || s === "speaking" ? "idle" : s));
            } else if (ttsQueueRef.current.length === 0 && !speakingRef.current) {
                setState(s => (s === "thinking" ? "idle" : s));
            }
        } catch (e: any) {
            if (e?.name === "AbortError") { submittedRef.current = false; return; }
            console.error("[voice send]", e);
            setErrorMsg(String(e?.message || e).slice(0, 240));
            setState("error");
            setTimeout(() => setState("idle"), 2000);
        } finally {
            submittedRef.current = false;
        }
    }, [apiBase, sessionId, drainTTS]);

    // Keep latest sendToSyn in a ref so VAD loop can call it without re-binding
    const sendToSynRef = useRef(sendToSyn);
    useEffect(() => { sendToSynRef.current = sendToSyn; }, [sendToSyn]);

    // ─── Init: mic permissions, AudioContext, STT, VAD ───────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (typeof window === "undefined") return;
            const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SR) {
                setErrorMsg("Voice not supported in this browser. Use Chrome or Edge on desktop.");
                setState("error");
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;

                const AC: any = (window.AudioContext || (window as any).webkitAudioContext);
                const ctx: AudioContext = new AC();
                const source = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 1024;
                analyser.smoothingTimeConstant = 0.4;
                source.connect(analyser);
                audioCtxRef.current = ctx;
                analyserRef.current = analyser;

                // Start STT with auto-restart on end
                const startRec = () => {
                    if (!restartRecRef.current || cancelled) return;
                    const rec = new SR();
                    rec.lang = "en-IN";
                    rec.continuous = true;
                    rec.interimResults = true;

                    rec.onresult = (event: any) => {
                        const s = stateRef.current;
                        // CRITICAL: only capture the user's words while we're actually
                        // listening / idle. During "speaking" the mic picks up Syn's own
                        // TTS (echo) — if we transcribed that it would corrupt the next
                        // turn ("kuch aur interpret kar raha hai"). Barge-in is handled
                        // purely by the VAD RMS loop, NOT by STT, so we can safely drop
                        // everything that isn't a genuine listening window.
                        if (s !== "listening" && s !== "idle") return;

                        let interimT = "";
                        let finalT = "";
                        for (let i = event.resultIndex; i < event.results.length; i++) {
                            const r = event.results[i];
                            if (r.isFinal) finalT += r[0].transcript + " ";
                            else interimT += r[0].transcript;
                        }
                        if (finalT) {
                            transcriptRef.current = (transcriptRef.current + " " + finalT).trim();
                        }
                        const combined = (transcriptRef.current + " " + interimT).trim();
                        if (combined) setInterim(combined);
                    };

                    rec.onerror = (e: any) => {
                        if (e.error === "no-speech" || e.error === "aborted") return;
                        console.warn("[stt error]", e.error);
                    };

                    rec.onend = () => {
                        recognitionRef.current = null;
                        if (restartRecRef.current && !cancelled) {
                            setTimeout(() => { try { startRec(); } catch { } }, 200);
                        }
                    };

                    try { rec.start(); recognitionRef.current = rec; }
                    catch { /* may throw "already started" — ignore */ }
                };
                startRec();

                setState("idle");
                setCallStart(Date.now());

                // ─── VAD loop (runs at ~60fps via rAF) ───────────────────
                const tick = () => {
                    if (cancelled || !analyserRef.current) return;
                    const a = analyserRef.current;
                    const buf = new Float32Array(a.fftSize);
                    a.getFloatTimeDomainData(buf);
                    let sum = 0;
                    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                    const rms = Math.sqrt(sum / buf.length);

                    const threshold = stateRef.current === "speaking"
                        ? VOICE_THRESHOLD_WHILE_SPEAKING
                        : VOICE_THRESHOLD;
                    const now = performance.now();
                    const isVoice = !mutedRef.current && rms > threshold;
                    const s = stateRef.current;

                    if (isVoice) {
                        lastVoiceTsRef.current = now;
                        if (!voiceActiveRef.current) {
                            voiceStartTsRef.current = now;
                            voiceActiveRef.current = true;
                        }
                        // Sustained voice → transition / barge-in
                        if (now - voiceStartTsRef.current > VOICE_MIN_DURATION_MS) {
                            if (s === "speaking") {
                                // Barge-in: kill TTS (browser + cloned), switch to listening
                                ttsQueueRef.current = [];
                                stopAllPlayback();
                                transcriptRef.current = "";
                                setReply("");
                                setState("listening");
                            } else if (s === "idle") {
                                setState("listening");
                            }
                        }
                    } else {
                        // Silence — if voice was active and quiet > timeout, end utterance
                        if (voiceActiveRef.current && now - lastVoiceTsRef.current > SILENCE_TIMEOUT_MS) {
                            voiceActiveRef.current = false;
                            if (s === "listening") {
                                const text = transcriptRef.current.trim();
                                transcriptRef.current = "";
                                if (text.length > 1) {
                                    void sendToSynRef.current(text);
                                } else {
                                    setInterim("");
                                    setState("idle");
                                }
                            }
                        }
                    }
                    vadRafRef.current = requestAnimationFrame(tick);
                };
                vadRafRef.current = requestAnimationFrame(tick);
            } catch (e: any) {
                if (cancelled) return;
                console.error("[voice init]", e);
                setErrorMsg(e?.message?.includes("Permission")
                    ? "Mic permission denied. Allow microphone in browser settings."
                    : (e?.message || "Could not start voice"));
                setState("error");
            }
        })();

        return () => {
            cancelled = true;
            restartRecRef.current = false;
            if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
            try { recognitionRef.current?.stop?.(); } catch { }
            streamRef.current?.getTracks().forEach(t => t.stop());
            audioCtxRef.current?.close().catch(() => { });
            stopAllPlayback();
            ttsQueueRef.current = [];
            abortRef.current?.abort();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Controls ───────────────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        setMuted(m => {
            const next = !m;
            if (streamRef.current) {
                streamRef.current.getAudioTracks().forEach(t => (t.enabled = !next));
            }
            if (next) {
                voiceActiveRef.current = false;
                if (stateRef.current === "listening") setState("idle");
            }
            return next;
        });
    }, []);

    const toggleSpeaker = useCallback(() => {
        setSpeakerOn(s => {
            const next = !s;
            if (!next) {
                ttsQueueRef.current = [];
                stopAllPlayback();
                setState(st => (st === "speaking" ? "idle" : st));
            }
            return next;
        });
    }, [stopAllPlayback]);

    const endCall = useCallback(() => {
        setState("ended");
        stopAllPlayback();
        ttsQueueRef.current = [];
        abortRef.current?.abort();
        restartRecRef.current = false;
        try { recognitionRef.current?.stop?.(); } catch { }
        setTimeout(() => onClose(), 280);
    }, [onClose, stopAllPlayback]);

    // ─── Copy ───────────────────────────────────────────────────────────
    const statusLine: Record<State, string> = {
        connecting: "Connecting…",
        idle: "Listening — just speak",
        listening: "I'm hearing you…",
        thinking: "Thinking",
        speaking: "Syn is speaking",
        ended: "Call ended",
        error: errorMsg || "Connection issue",
    };
    const statusSubtitle: Record<State, string> = {
        connecting: "Allow mic when prompted",
        idle: "Auto-listens. Mute mic if you want a break.",
        listening: "Pause for ~1 sec to send",
        thinking: "Reading your deal state",
        speaking: "Just talk over — I'll stop",
        ended: "",
        error: "Reopen voice agent to retry",
    };

    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60).toString().padStart(2, "0");
        const ss = (s % 60).toString().padStart(2, "0");
        return `${m}:${ss}`;
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/55 backdrop-blur-[3px] z-[90]"
                onClick={endCall}
            />

            <motion.aside
                initial={{ x: 480, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 480, opacity: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 28 }}
                className="fixed top-0 right-0 bottom-0 z-[95] w-full sm:w-[460px] flex flex-col"
                style={{
                    background: "linear-gradient(180deg, #060B1A 0%, #0A1228 50%, #060A18 100%)",
                    borderLeft: `1px solid ${AZURE}22`,
                    boxShadow: `-30px 0 80px -20px rgba(0,0,0,0.7)`,
                }}
            >
                {/* Header — caller chip + actions */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <motion.div
                                className="w-11 h-11 rounded-full grid place-items-center"
                                animate={{
                                    boxShadow: state === "speaking"
                                        ? [`0 0 0 0 ${AZURE}80`, `0 0 0 12px ${AZURE}00`]
                                        : state === "listening"
                                            ? [`0 0 0 0 ${AZURE}60`, `0 0 0 10px ${AZURE}00`]
                                            : `0 0 18px ${AZURE}55`,
                                }}
                                transition={state === "speaking" || state === "listening"
                                    ? { duration: 1.2, repeat: Infinity, ease: "easeOut" }
                                    : { duration: 0.5 }}
                                style={{ background: `linear-gradient(135deg, ${ROYAL}, ${AZURE})` }}
                            >
                                <Sparkles size={18} className="text-white" strokeWidth={1.8} />
                            </motion.div>
                        </div>
                        <div>
                            <div className="text-white/95 font-semibold text-[14px] leading-none">SYN</div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-white/55 text-[10px] uppercase tracking-[0.18em]">
                                    {state === "connecting" || state === "error"
                                        ? state
                                        : `voice · ${fmtTime(callTimer)}`}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <IconBtn onClick={() => setShowSettings(s => !s)} ariaLabel="Voice settings">
                            <Settings2 size={15} />
                        </IconBtn>
                        <IconBtn onClick={endCall} ariaLabel="Close">
                            <X size={17} />
                        </IconBtn>
                    </div>
                </div>

                {/* Settings drawer */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-b border-white/5"
                        >
                            <div className="px-5 py-4">
                                <div className="text-white/50 text-[10px] uppercase tracking-[0.2em] mb-2">Voice output</div>
                                <select
                                    value={selectedVoiceURI}
                                    onChange={e => setSelectedVoiceURI(e.target.value)}
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white/90 text-xs outline-none focus:border-[#11B8EA]/60"
                                >
                                    {voiceList.map(v => (
                                        <option key={v.voiceURI} value={v.voiceURI} className="bg-[#0A0F1E]">
                                            {v.name} ({v.lang})
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-3 text-white/40 text-[10px] leading-relaxed">
                                    {USE_CLONED_VOICE
                                        ? "Using Dhananjay's cloned voice (XTTS-v2). This OS voice is only the fallback if the voice engine is unreachable."
                                        : "Currently using your OS's TTS voice. The cloned voice (Dhananjay's XTTS-v2 recording) activates when the voice engine is configured."}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main — living glass-liquid orb (no transcript / no reply text) */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
                    <SynVoiceOrb state={state} size={236} />

                    {/* Status (mood only — never the words spoken) */}
                    <div className="mt-10 text-center">
                        <div className="text-white text-[17px] font-light tracking-wide">
                            {statusLine[state]}
                        </div>
                        <div className="text-white/45 text-[11px] mt-1.5">
                            {statusSubtitle[state]}
                        </div>
                    </div>

                    {/* Only surface hard errors — never the conversation itself */}
                    <div className="mt-5 w-full max-w-sm min-h-[24px] px-3">
                        <AnimatePresence mode="wait">
                            {state === "error" && (
                                <motion.div
                                    key="err"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center text-rose-300/90 text-xs"
                                >
                                    {errorMsg}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Call controls */}
                <div className="px-6 pt-5 pb-6 border-t border-white/5">
                    <div className="flex items-center justify-center gap-6">
                        <CallBtn onClick={toggleMute} variant={muted ? "danger" : "neutral"} ariaLabel={muted ? "Unmute mic" : "Mute mic"}>
                            {muted ? <MicOff size={20} /> : <Mic size={20} />}
                        </CallBtn>
                        <CallBtn onClick={endCall} variant="end" big ariaLabel="End call">
                            <PhoneOff size={26} />
                        </CallBtn>
                        <CallBtn onClick={toggleSpeaker} variant={speakerOn ? "neutral" : "danger"} ariaLabel={speakerOn ? "Mute speaker" : "Unmute speaker"}>
                            {speakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        </CallBtn>
                    </div>

                    {history.length > 0 && (
                        <button
                            onClick={() => setHistoryOpen(o => !o)}
                            className="mt-5 w-full text-center text-white/40 hover:text-white/75 text-[10px] uppercase tracking-[0.22em] transition-colors"
                        >
                            {historyOpen ? "Hide" : "View"} conversation ({history.length})
                        </button>
                    )}

                    <AnimatePresence>
                        {historyOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 220, opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mt-3"
                            >
                                <div className="max-h-[220px] overflow-y-auto space-y-3 pr-2">
                                    {history.slice(-14).map((m, i) => (
                                        <div key={i} className="text-xs">
                                            <div className={`text-[9px] uppercase tracking-[0.18em] mb-0.5 ${m.role === "user" ? "text-cyan-400" : "text-blue-400"}`}>
                                                {m.role === "user" ? (clientName ? clientName.split(" ")[0] : "You") : "Syn"}
                                            </div>
                                            <div className="text-white/75 leading-snug">
                                                {stripForVoice(m.content)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.aside>
        </>
    );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function IconBtn({ children, onClick, ariaLabel }: { children: React.ReactNode; onClick: () => void; ariaLabel: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            className="w-9 h-9 rounded-full grid place-items-center text-white/60 hover:text-white hover:bg-white/[0.07] transition"
        >
            {children}
        </button>
    );
}

function CallBtn({
    children, onClick, variant, big, ariaLabel,
}: {
    children: React.ReactNode;
    onClick: () => void;
    variant: "neutral" | "danger" | "end";
    big?: boolean;
    ariaLabel: string;
}) {
    const size = big ? 64 : 52;
    const styles: React.CSSProperties =
        variant === "end"
            ? { background: "#DC2626", color: "#fff", boxShadow: "0 10px 26px -8px rgba(220,38,38,0.55)" }
            : variant === "danger"
                ? { background: "rgba(220,38,38,0.16)", color: "#FCA5A5", border: "1px solid rgba(220,38,38,0.38)" }
                : { background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" };
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            className="rounded-full grid place-items-center transition-all hover:scale-105 active:scale-95"
            style={{ width: size, height: size, ...styles }}
        >
            {children}
        </button>
    );
}
