"use client";

// ─── RAISE ISSUE MODAL ─────────────────────────────────────────────────────
// Formal issue form: 800-char description + screen recording + voice note.
// Screen recording: getDisplayMedia + MediaRecorder.
// Voice: getUserMedia({audio: true}) + MediaRecorder.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, AlertCircle, Loader2, Video, Mic, Square, Trash2, Check } from "lucide-react";

// ─── FixedMedia ─────────────────────────────────────────────────────────────
// Chrome's MediaRecorder writes WebM with no duration metadata, so the player
// can't seek and the timeline plays then resets. Workaround: seek to a huge
// time after metadata loads, which forces the browser to scan the whole file
// and compute a real duration. Then snap back to 0.
function FixedMedia({ src, kind, className }: { src: string; kind: "audio" | "video"; className?: string }) {
    const ref = useRef<HTMLMediaElement | null>(null);
    useEffect(() => {
        const el = ref.current as any;
        if (!el) return;
        const onMeta = () => {
            if (el.duration === Infinity || isNaN(el.duration)) {
                const onUpdate = () => {
                    el.removeEventListener("timeupdate", onUpdate);
                    el.currentTime = 0;
                };
                el.addEventListener("timeupdate", onUpdate);
                try { el.currentTime = 1e10; } catch { /* noop */ }
            }
        };
        el.addEventListener("loadedmetadata", onMeta);
        return () => el.removeEventListener("loadedmetadata", onMeta);
    }, [src]);
    return kind === "audio"
        ? <audio ref={ref as any} src={src} controls preload="metadata" className={className} />
        : <video ref={ref as any} src={src} controls preload="metadata" className={className} />;
}

interface Props {
    token: string;
    onClose: () => void;
    onSubmitted: () => void;
}

const MAX_DESC = 800;
const RED = "#DC2626";
const SOFT_RED = "#FECACA";

type RecordingState = "idle" | "recording" | "done";

export default function RaiseIssueModal({ token, onClose, onSubmitted }: Props) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const [screenState, setScreenState] = useState<RecordingState>("idle");
    const [voiceState, setVoiceState] = useState<RecordingState>("idle");
    const [screenBlob, setScreenBlob] = useState<Blob | null>(null);
    const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
    const [screenSecs, setScreenSecs] = useState(0);
    const [voiceSecs, setVoiceSecs] = useState(0);

    const screenRecorder = useRef<MediaRecorder | null>(null);
    const voiceRecorder = useRef<MediaRecorder | null>(null);
    const screenChunks = useRef<Blob[]>([]);
    const voiceChunks = useRef<Blob[]>([]);
    const screenStream = useRef<MediaStream | null>(null);
    const voiceStream = useRef<MediaStream | null>(null);
    const screenTimer = useRef<any>(null);
    const voiceTimer = useRef<any>(null);

    // ─── Screen recording ────────────────────────────────────────────────
    async function startScreen() {
        try {
            setError(null);
            const stream = await (navigator.mediaDevices as any).getDisplayMedia({
                video: { frameRate: { ideal: 12, max: 24 } },
                audio: true,
            });
            screenStream.current = stream;
            const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
                ? "video/webm;codecs=vp9,opus"
                : MediaRecorder.isTypeSupported("video/webm")
                    ? "video/webm"
                    : "";
            const rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 })
                             : new MediaRecorder(stream);
            screenRecorder.current = rec;
            screenChunks.current = [];
            rec.ondataavailable = (e) => { if (e.data?.size > 0) screenChunks.current.push(e.data); };
            rec.onstop = () => {
                const blob = new Blob(screenChunks.current, { type: rec.mimeType || "video/webm" });
                setScreenBlob(blob);
                setScreenState("done");
                clearInterval(screenTimer.current);
                screenStream.current?.getTracks().forEach(t => t.stop());
                screenStream.current = null;
            };
            // If user stops sharing via browser UI, treat as stop
            stream.getVideoTracks()[0]?.addEventListener("ended", () => {
                if (rec.state === "recording") rec.stop();
            });
            setScreenSecs(0);
            screenTimer.current = setInterval(() => setScreenSecs(s => s + 1), 1000);
            rec.start(500);
            setScreenState("recording");
        } catch (e: any) {
            setError(`Screen capture denied: ${e?.message || "permission"}`);
        }
    }

    function stopScreen() {
        try { screenRecorder.current?.stop(); } catch { /* noop */ }
    }

    function clearScreen() {
        setScreenBlob(null);
        setScreenState("idle");
        setScreenSecs(0);
    }

    // ─── Upload video file (alternative to screen recording) ─────────────
    function uploadVideoFile() {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "video/*";
        inp.onchange = async () => {
            const f = inp.files?.[0];
            if (!f) return;
            if (f.size > 50 * 1024 * 1024) {
                setError("Video file is over 50 MB — trim it down a bit.");
                return;
            }
            const buf = await f.arrayBuffer();
            const blob = new Blob([buf], { type: f.type || "video/mp4" });
            setScreenBlob(blob);
            setScreenState("done");
            // estimate duration from <video> element after attach (FixedMedia handles it)
            // For UI, show "uploaded" instead of timer:
            setScreenSecs(0);
        };
        inp.click();
    }

    // ─── Voice recording ─────────────────────────────────────────────────
    async function startVoice() {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            voiceStream.current = stream;
            const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                    ? "audio/webm"
                    : "";
            const rec = mime ? new MediaRecorder(stream, { mimeType: mime })
                             : new MediaRecorder(stream);
            voiceRecorder.current = rec;
            voiceChunks.current = [];
            rec.ondataavailable = (e) => { if (e.data?.size > 0) voiceChunks.current.push(e.data); };
            rec.onstop = () => {
                const blob = new Blob(voiceChunks.current, { type: rec.mimeType || "audio/webm" });
                setVoiceBlob(blob);
                setVoiceState("done");
                clearInterval(voiceTimer.current);
                voiceStream.current?.getTracks().forEach(t => t.stop());
                voiceStream.current = null;
            };
            setVoiceSecs(0);
            voiceTimer.current = setInterval(() => setVoiceSecs(s => s + 1), 1000);
            rec.start(500);
            setVoiceState("recording");
        } catch (e: any) {
            setError(`Microphone denied: ${e?.message || "permission"}`);
        }
    }

    function stopVoice() {
        try { voiceRecorder.current?.stop(); } catch { /* noop */ }
    }

    function clearVoice() {
        setVoiceBlob(null);
        setVoiceState("idle");
        setVoiceSecs(0);
    }

    // ─── Submit ──────────────────────────────────────────────────────────
    async function submit() {
        if (!description.trim()) {
            setError("Please describe the issue before submitting.");
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const fd = new FormData();
            if (title.trim()) fd.append("title", title.trim());
            fd.append("description", description.trim());
            if (screenBlob) fd.append("screen", new File([screenBlob], `screen.webm`, { type: screenBlob.type || "video/webm" }));
            if (voiceBlob) fd.append("voice", new File([voiceBlob], `voice.webm`, { type: voiceBlob.type || "audio/webm" }));

            const r = await fetch(`/api/syn/raise-issue/${token}`, { method: "POST", body: fd });
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                throw new Error(d?.detail || d?.error || "Submission failed");
            }
            setDone(true);
            setTimeout(() => { onSubmitted(); }, 1500);
        } catch (e: any) {
            setError(e?.message || "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    function fmt(secs: number) {
        const m = Math.floor(secs / 60), s = secs % 60;
        return `${m}:${String(s).padStart(2, "0")}`;
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-sm px-4 overflow-y-auto py-8"
            onClick={onClose}
            style={{ cursor: "auto" }}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden my-auto"
                style={{ border: `1px solid ${SOFT_RED}`, cursor: "auto" }}
                onClick={e => e.stopPropagation()}
            >
                <style jsx>{`
                    div :global(*) { cursor: auto !important; }
                    div :global(button) { cursor: pointer !important; }
                    div :global(input), div :global(textarea) { cursor: text !important; }
                `}</style>

                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: SOFT_RED, background: "#FEF2F2" }}>
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} style={{ color: RED }} />
                        <p className="text-sm font-semibold" style={{ color: RED }}>Raise Issue</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-red-100">
                        <X size={16} className="text-slate-600" />
                    </button>
                </div>

                {done ? (
                    <div className="px-6 py-10 text-center">
                        <div className="w-14 h-14 mx-auto rounded-full grid place-items-center mb-3 bg-red-50 border-2 border-red-200">
                            <Check size={24} className="text-red-600" />
                        </div>
                        <p className="text-slate-800 font-semibold text-sm">Issue submitted</p>
                        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                            Dhananjay has been notified with your recording and notes. You'll get an acknowledgement and a resolution email when it's fixed.
                        </p>
                    </div>
                ) : (
                    <div className="px-5 py-4 space-y-3">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Something not working as expected? Drop a short description, and optionally a screen recording + voice note so Dhananjay sees exactly what you saw.
                        </p>

                        <div>
                            <label className="text-[10px] tracking-[0.2em] uppercase text-slate-500 font-semibold">Title (optional)</label>
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Short headline"
                                className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none bg-slate-50"
                                style={{ border: `1px solid ${SOFT_RED}` }}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] tracking-[0.2em] uppercase text-slate-500 font-semibold">
                                Description ({description.length}/{MAX_DESC})
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value.slice(0, MAX_DESC))}
                                rows={4}
                                placeholder="What happened? Where in the portal? What did you expect?"
                                className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none bg-slate-50 resize-none"
                                style={{ border: `1px solid ${SOFT_RED}` }}
                            />
                        </div>

                        {/* ─── Screen recording ─────────────────────────── */}
                        <div className="rounded-lg p-3" style={{ border: `1px solid ${SOFT_RED}`, background: "#FFF7F7" }}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Video size={14} className="text-red-600" />
                                    <p className="text-xs font-semibold text-slate-700">Screen recording (optional)</p>
                                </div>
                                {screenState === "recording" && (
                                    <span className="flex items-center gap-1 text-[11px] text-red-600 font-mono">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> {fmt(screenSecs)}
                                    </span>
                                )}
                                {screenState === "done" && (
                                    <span className="text-[11px] text-green-600 font-mono">{fmt(screenSecs)} captured</span>
                                )}
                            </div>
                            {screenState === "idle" && (
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={startScreen} className="px-3 py-2 rounded-lg bg-white text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors" style={{ border: `1px solid ${SOFT_RED}` }}>
                                        Record screen
                                    </button>
                                    <button onClick={uploadVideoFile} className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors">
                                        Upload video
                                    </button>
                                </div>
                            )}
                            {screenState === "recording" && (
                                <button onClick={stopScreen} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold">
                                    <Square size={11} fill="currentColor" /> Stop recording
                                </button>
                            )}
                            {screenState === "done" && screenBlob && (
                                <div className="flex items-center gap-2">
                                    <FixedMedia kind="video" src={URL.createObjectURL(screenBlob)} className="w-full max-h-40 rounded bg-black" />
                                    <button onClick={clearScreen} className="shrink-0 w-8 h-8 grid place-items-center rounded-lg bg-white hover:bg-red-50" style={{ border: `1px solid ${SOFT_RED}` }} aria-label="Discard recording">
                                        <Trash2 size={13} className="text-red-600" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ─── Voice note ───────────────────────────────── */}
                        <div className="rounded-lg p-3" style={{ border: `1px solid ${SOFT_RED}`, background: "#FFF7F7" }}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Mic size={14} className="text-red-600" />
                                    <p className="text-xs font-semibold text-slate-700">Voice note (optional)</p>
                                </div>
                                {voiceState === "recording" && (
                                    <span className="flex items-center gap-1 text-[11px] text-red-600 font-mono">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> {fmt(voiceSecs)}
                                    </span>
                                )}
                                {voiceState === "done" && (
                                    <span className="text-[11px] text-green-600 font-mono">{fmt(voiceSecs)} captured</span>
                                )}
                            </div>
                            {voiceState === "idle" && (
                                <button onClick={startVoice} className="w-full px-3 py-2 rounded-lg bg-white text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors" style={{ border: `1px solid ${SOFT_RED}` }}>
                                    Start voice note
                                </button>
                            )}
                            {voiceState === "recording" && (
                                <button onClick={stopVoice} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold">
                                    <Square size={11} fill="currentColor" /> Stop recording
                                </button>
                            )}
                            {voiceState === "done" && voiceBlob && (
                                <div className="flex items-center gap-2">
                                    <FixedMedia kind="audio" src={URL.createObjectURL(voiceBlob)} className="flex-1" />
                                    <button onClick={clearVoice} className="shrink-0 w-8 h-8 grid place-items-center rounded-lg bg-white hover:bg-red-50" style={{ border: `1px solid ${SOFT_RED}` }} aria-label="Discard recording">
                                        <Trash2 size={13} className="text-red-600" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                        )}

                        <button
                            onClick={submit}
                            disabled={submitting || !description.trim()}
                            className="w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)" }}
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            {submitting ? "Sending…" : "Submit issue"}
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
