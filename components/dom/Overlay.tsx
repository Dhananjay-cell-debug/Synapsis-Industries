"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function LetterReveal({ text, className, style, delay = 0 }: {
    text: string, className?: string, style?: React.CSSProperties, delay?: number
}) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const letters = ref.current?.querySelectorAll(".letter");
        if (!letters) return;

        // In 3D space, IntersectionObserver can be unreliable due to matrix3d transforms.
        // We'll just trigger the reveal unconditionally on mount with a small delay.
        setTimeout(() => {
            letters.forEach((el, i) => {
                const span = el as HTMLElement;
                setTimeout(() => {
                    span.style.opacity = "1";
                    span.style.transform = "translateY(0)";
                }, delay + i * 60);
            });
        }, 100);
    }, [delay]);

    return (
        <span ref={ref} className={className} style={style}>
            {text.split("").map((char, i) => (
                <span
                    key={i}
                    className="letter inline-block transition-all duration-700 ease-out"
                    style={{
                        opacity: 0,
                        transform: "translateY(12px)",
                    }}
                >
                    {char === " " ? "\u00A0" : char}
                </span>
            ))}
        </span>
    );
}

export default function Overlay() {
    // The artificial scroll fading has been entirely removed!
    // The overlay will now physically sit in the 3D world as a wall/glass pane.
    // When the camera physically dollies into the scene, it will pass through this textual wall,
    // leaving the text behind and out of view automatically!

    return (
        <div
            className="absolute pointer-events-none z-50 flex flex-col justify-between p-[var(--spacing-container)]"
            style={{
                width: "100vw",
                height: "100vh",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)"
            }}
        >

            {/* Left Tag — "Dhananjay Chitmilla" */}
            <div
                className="origin-center bg-white text-black px-3 py-2 text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-2"
                style={{
                    position: "absolute",
                    top: "48%",
                    left: "0vw",
                    transform: "translateY(-50%) rotate(-90deg)",
                }}
            >
                <span style={{ fontSize: "14px", lineHeight: 1 }}>↑</span>
                Dhananjay Chitmilla
            </div>

            {/* Top HUD */}
            <div className="flex justify-between items-start w-full">
                <div className="flex flex-col gap-1" />
                <div className="flex gap-8 items-center">
                    <div className="w-8 h-[1px] bg-black/40" />
                </div>
            </div>

            {/* Right Aligned Title — with letter reveal + scroll fade */}
            <div
                className="text-center text-white whitespace-nowrap"
                style={{
                    position: "absolute",
                    top: "47.5%",
                    left: "68%",
                    transform: "translate(-50%, -50%)",
                }}
            >
                <LetterReveal
                    text="SYNAPSIS"
                    className="font-serif leading-[1.0] drop-shadow-sm block"
                    style={{ fontSize: "clamp(2.5rem, 4vw, 3.5rem)" }}
                    delay={300}
                />
                <LetterReveal
                    text="INDUSTRIES"
                    className="font-serif leading-[1.0] mb-2 drop-shadow-sm block"
                    style={{ fontSize: "clamp(2.5rem, 4vw, 3.5rem)" }}
                    delay={700}
                />
                <LetterReveal
                    text="Systems that scale. Automation"
                    className="font-light opacity-80 tracking-widest block"
                    style={{ fontSize: "0.9rem" }}
                    delay={1600}
                />
                <LetterReveal
                    text="that works while you sleep."
                    className="font-light opacity-80 tracking-widest block"
                    style={{ fontSize: "0.9rem" }}
                    delay={2000}
                />
            </div>

            {/* Scroll Indicator */}
            <div
                className="uppercase tracking-widest -rotate-90 origin-bottom-right"
                style={{
                    position: "absolute",
                    bottom: "26vw",
                    right: "65vw",
                    fontSize: "10px",
                    color: "#ffffff",
                }}
            >
                Scroll To Explore
            </div>

        </div>
    );
}
