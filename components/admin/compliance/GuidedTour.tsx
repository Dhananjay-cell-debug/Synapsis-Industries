// ─── GUIDED TOUR — spotlight / coachmark engine ────────────────────────────
// Dims the whole screen, cuts a "spotlight" around one target element, pulses
// a ring on it, and shows a tooltip card explaining what it is. Clicking the
// spotlight OR "Next" advances. Steps can carry a `view` so the parent switches
// the compliance screen as the tour walks through routes.

"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, X } from "lucide-react";
import { COMPLIANCE } from "./ui";

export interface TourStep {
    target?: string;   // data-tour attribute value; omit → centered card
    view?: string;     // compliance view id to switch to for this step
    title: string;
    body: string;
}

const PAD = 7;
const CARD_W = 326;
const GAP = 18;

function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
}

export default function GuidedTour({
    steps, stepIndex, onNext, onBack, onSkip,
}: {
    steps: TourStep[];
    stepIndex: number;
    onNext: () => void;
    onBack: () => void;
    onSkip: () => void;
}) {
    const step = steps[stepIndex];
    const [rect, setRect] = useState<DOMRect | null>(null);
    const isLast = stepIndex === steps.length - 1;
    const isFirst = stepIndex === 0;

    // measure target (re-measures a few times to survive view switches + scroll)
    useEffect(() => {
        let cancelled = false;
        const measure = () => {
            if (cancelled) return;
            if (!step.target) { setRect(null); return; }
            const el = document.querySelector(`[data-tour="${step.target}"]`);
            if (el) {
                el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                setRect(el.getBoundingClientRect());
            } else {
                setRect(null);
            }
        };
        measure();
        const t1 = setTimeout(measure, 130);
        const t2 = setTimeout(measure, 400);
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            cancelled = true;
            clearTimeout(t1); clearTimeout(t2);
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [step]);

    // tooltip placement
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    let cardStyle: React.CSSProperties;
    if (!rect) {
        cardStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    } else if (rect.right + GAP + CARD_W < vw) {
        cardStyle = { top: clamp(rect.top - 8, 16, vh - 300), left: rect.right + GAP };
    } else if (rect.bottom + GAP + 240 < vh) {
        cardStyle = { top: rect.bottom + GAP, left: clamp(rect.left, 16, vw - CARD_W - 16) };
    } else {
        cardStyle = { top: clamp(rect.top - 250, 16, vh - 280), left: clamp(rect.left, 16, vw - CARD_W - 16) };
    }

    return (
        <div className="fixed inset-0 z-[9990]" style={{ cursor: "default" }}>
            {/* click-catcher — keeps focus on the tour */}
            <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

            {/* spotlight box — dims everything else via huge box-shadow */}
            {rect && (
                <motion.div
                    initial={false}
                    animate={{
                        top: rect.top - PAD,
                        left: rect.left - PAD,
                        width: rect.width + PAD * 2,
                        height: rect.height + PAD * 2,
                    }}
                    transition={{ type: "spring", stiffness: 320, damping: 34 }}
                    onClick={onNext}
                    className="absolute rounded-xl cursor-pointer"
                    style={{
                        boxShadow: `0 0 0 9999px rgba(8,12,24,0.80)`,
                        zIndex: 9995,
                    }}
                >
                    {/* pulsing ring */}
                    <motion.span
                        className="absolute inset-0 rounded-xl"
                        style={{ border: `2px solid ${COMPLIANCE.accent}` }}
                        animate={{ boxShadow: [
                            `0 0 0 0 rgba(12,151,196,0.45)`,
                            `0 0 0 10px rgba(12,151,196,0)`,
                        ] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                </motion.div>
            )}

            {/* full-screen dim when no target (centered steps) */}
            {!rect && <div className="absolute inset-0" style={{ background: "rgba(8,12,24,0.80)" }} />}

            {/* tooltip card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={stepIndex}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="absolute rounded-2xl overflow-hidden"
                    style={{
                        ...cardStyle,
                        width: CARD_W,
                        zIndex: 9999,
                        background: "#fff",
                        boxShadow: "0 12px 48px -8px rgba(8,12,24,0.55)",
                        border: `1px solid ${COMPLIANCE.hairline}`,
                    }}
                >
                    {/* accent bar */}
                    <div style={{ height: 3, background: `linear-gradient(90deg, ${COMPLIANCE.accent}, ${COMPLIANCE.accentDark})` }} />
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span
                                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                                style={{ color: COMPLIANCE.accent }}
                            >
                                Guided tour · {stepIndex + 1} / {steps.length}
                            </span>
                            <button
                                onClick={onSkip}
                                className="p-1 rounded-md hover:bg-black/[0.05] transition-colors"
                                aria-label="Skip tour"
                            >
                                <X size={14} style={{ color: COMPLIANCE.muted }} />
                            </button>
                        </div>

                        <h3
                            className="font-serif leading-snug mb-1.5"
                            style={{ fontSize: "1.35rem", color: COMPLIANCE.ink, letterSpacing: "-0.01em" }}
                        >
                            {step.title}
                        </h3>
                        <p className="text-[13px] leading-relaxed mb-4" style={{ color: COMPLIANCE.body }}>
                            {step.body}
                        </p>

                        {/* progress dots */}
                        <div className="flex gap-1 mb-4">
                            {steps.map((_, i) => (
                                <span
                                    key={i}
                                    className="h-1 rounded-full transition-all"
                                    style={{
                                        width: i === stepIndex ? 18 : 6,
                                        background: i <= stepIndex ? COMPLIANCE.accent : COMPLIANCE.hairline,
                                    }}
                                />
                            ))}
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                onClick={onSkip}
                                className="text-[11px] font-semibold transition-colors hover:opacity-70"
                                style={{ color: COMPLIANCE.muted }}
                            >
                                Skip tour
                            </button>
                            <div className="flex items-center gap-2">
                                {!isFirst && (
                                    <button
                                        onClick={onBack}
                                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-black/[0.04]"
                                        style={{ color: COMPLIANCE.body }}
                                    >
                                        <ArrowLeft size={13} /> Back
                                    </button>
                                )}
                                <button
                                    onClick={onNext}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                                    style={{ background: COMPLIANCE.accent }}
                                >
                                    {isLast ? "Done" : "Next"} {!isLast && <ArrowRight size={13} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
