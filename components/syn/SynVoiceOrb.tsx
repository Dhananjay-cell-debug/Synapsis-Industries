"use client";

// ─── SYN VOICE ORB ────────────────────────────────────────────────────────
// Premium transparent glass bulb with glossy white+blue liquid inside.
// The liquid flows turbulently while Syn is speaking, settles calm while
// listening / idle, and continuously emits soft smoke wisps. No text — the
// living animation IS the interface.
//
// State → behaviour:
//   speaking   → liquid churns fast, bright, strong smoke
//   listening  → liquid breathes gently, azure-led, light smoke
//   thinking   → slow deliberate swirl
//   idle/conn  → liquid stable, slow drift
//   error      → dim, desaturated

import { motion } from "framer-motion";
import { useId } from "react";

type OrbState =
    | "connecting" | "idle" | "listening" | "thinking" | "speaking" | "ended" | "error";

const AZURE = "#11B8EA";
const ROYAL = "#3B6AE8";

interface Props { state: OrbState; size?: number; }

export default function SynVoiceOrb({ state, size = 232 }: Props) {
    const uid = useId().replace(/[:]/g, "");
    const goo = `goo-${uid}`;

    const speaking = state === "speaking";
    const listening = state === "listening";
    const thinking = state === "thinking";
    const error = state === "error";

    // Motion energy by state
    const amp = speaking ? 30 : listening ? 16 : thinking ? 21 : 8;   // px travel of liquid blobs
    const dur = speaking ? 2.1 : listening ? 3.6 : thinking ? 4.2 : 7.4; // base loop seconds
    const lead = listening ? AZURE : ROYAL;                            // dominant tint

    // Glass shell rim inset from the glow halo
    const rim = Math.round(size * 0.085);

    // Liquid blob recipe — white sheen blobs + blue mass blobs, merged by goo filter
    const blobs = [
        { c: "rgba(255,255,255,0.95)", r: 0.40, x: -0.10, y: -0.12, ph: 0.0, hi: true },
        { c: "rgba(214,240,255,0.90)", r: 0.34, x: 0.14, y: 0.10, ph: 0.7, hi: true },
        { c: `${AZURE}f2`, r: 0.46, x: 0.08, y: -0.04, ph: 1.3 },
        { c: `${ROYAL}f0`, r: 0.50, x: -0.12, y: 0.16, ph: 1.9 },
        { c: `${AZURE}e6`, r: 0.30, x: 0.18, y: -0.16, ph: 2.5 },
    ];

    const smokeOpacity = error ? 0 : speaking ? 0.55 : listening ? 0.3 : 0.18;

    return (
        <div
            className="relative grid place-items-center"
            style={{ width: size, height: size, filter: error ? "saturate(0.35) brightness(0.8)" : undefined }}
        >
            {/* goo filter — merges blobs into one liquid mass */}
            <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
                <defs>
                    <filter id={goo}>
                        <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.045} result="b" />
                        <feColorMatrix in="b" type="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" result="g" />
                        <feBlend in="SourceGraphic" in2="g" />
                    </filter>
                </defs>
            </svg>

            {/* Ambient halo behind the glass */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    width: size * 1.05, height: size * 1.05,
                    background: `radial-gradient(circle, ${lead}55 0%, transparent 68%)`,
                    filter: `blur(${size * 0.11}px)`,
                }}
                animate={{
                    scale: speaking ? [1, 1.12, 1] : listening ? [1, 1.07, 1] : [1, 1.03, 1],
                    opacity: error ? 0.25 : speaking ? [0.7, 0.95, 0.7] : [0.5, 0.7, 0.5],
                }}
                transition={{ duration: dur * 0.9, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Smoke wisps rising off the liquid */}
            <div
                className="absolute pointer-events-none"
                style={{ width: size, height: size * 1.5, bottom: size * 0.18, opacity: smokeOpacity }}
            >
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            left: `${22 + i * 18}%`,
                            bottom: "34%",
                            width: size * (0.22 + (i % 2) * 0.08),
                            height: size * (0.22 + (i % 2) * 0.08),
                            background: `radial-gradient(circle, ${i % 2 ? "#dbeeff" : AZURE}55 0%, transparent 70%)`,
                            filter: `blur(${size * 0.05}px)`,
                        }}
                        animate={{
                            y: [0, -size * (speaking ? 0.62 : 0.42)],
                            x: [0, (i % 2 ? 1 : -1) * size * 0.07, 0],
                            scale: [0.5, 1.25, 1.55],
                            opacity: [0, 0.85, 0],
                        }}
                        transition={{
                            duration: speaking ? 3.4 : 5.2,
                            repeat: Infinity,
                            ease: "easeOut",
                            delay: i * (speaking ? 0.7 : 1.1),
                        }}
                    />
                ))}
            </div>

            {/* Glass body */}
            <motion.div
                className="absolute rounded-full overflow-hidden"
                style={{
                    width: size - rim * 2, height: size - rim * 2,
                    background: "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.16), rgba(10,22,46,0.55) 70%)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    boxShadow: `inset 0 ${size * 0.04}px ${size * 0.12}px rgba(255,255,255,0.22), inset 0 -${size * 0.09}px ${size * 0.18}px rgba(7,18,40,0.7), 0 ${size * 0.06}px ${size * 0.22}px -${size * 0.04}px ${lead}77`,
                    backdropFilter: "blur(2px)",
                }}
                animate={{ scale: speaking ? [1, 1.025, 1] : listening ? [1, 1.015, 1] : [1, 1.008, 1] }}
                transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
            >
                {/* Liquid volume base */}
                <div
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(circle at 50% 38%, ${AZURE}40 0%, ${ROYAL}66 55%, ${ROYAL}33 100%)` }}
                />

                {/* Flowing liquid blobs (gooey) */}
                <div className="absolute inset-0" style={{ filter: `url(#${goo})` }}>
                    {blobs.map((b, i) => {
                        const d = size - rim * 2;
                        const bs = d * b.r;
                        return (
                            <motion.div
                                key={i}
                                className="absolute rounded-full"
                                style={{
                                    width: bs, height: bs,
                                    left: `calc(50% - ${bs / 2}px)`,
                                    top: `calc(${b.hi ? 44 : 52}% - ${bs / 2}px)`,
                                    background: `radial-gradient(circle at 38% 34%, ${b.c}, transparent 72%)`,
                                }}
                                animate={{
                                    x: [b.x * size - amp, b.x * size + amp, b.x * size - amp * 0.6, b.x * size - amp],
                                    y: [b.y * size + amp * 0.7, b.y * size - amp, b.y * size + amp, b.y * size + amp * 0.7],
                                    scale: [1, 1.18, 0.92, 1],
                                }}
                                transition={{
                                    duration: dur + b.ph * 0.6,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: b.ph,
                                }}
                            />
                        );
                    })}
                </div>

                {/* Top surface sheen */}
                <div
                    className="absolute inset-x-0 top-0"
                    style={{
                        height: "55%",
                        background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)",
                        mixBlendMode: "screen",
                    }}
                />
            </motion.div>

            {/* Specular highlight — glass gloss */}
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: size * 0.30, height: size * 0.20,
                    top: size * 0.20, left: size * 0.26,
                    background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%)",
                    filter: `blur(${size * 0.012}px)`,
                    transform: "rotate(-25deg)",
                }}
            />
            {/* Crescent rim light */}
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: size - rim * 2, height: size - rim * 2,
                    boxShadow: `inset -${size * 0.02}px -${size * 0.03}px ${size * 0.06}px ${AZURE}aa`,
                    opacity: 0.6,
                }}
            />
        </div>
    );
}
