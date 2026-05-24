"use client";

import { useEffect, useRef, useState } from "react";
import { useOverlayStore } from "@/store/useOverlayStore";

function LetterReveal({ text, className, style, delay = 0 }: {
    text: string, className?: string, style?: React.CSSProperties, delay?: number
}) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const letters = ref.current?.querySelectorAll(".letter");
        if (!letters) return;

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
    const { top, left } = useOverlayStore();
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        const handleScroll = () => {
            // Fade out the overlay cleanly over the first 120px of scroll
            const newOpacity = Math.max(0, 1 - window.scrollY / 120);
            setOpacity(newOpacity);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div
            className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-[var(--spacing-container)] transition-opacity duration-150"
            style={{
                width: "100vw",
                height: "100vh",
                opacity,
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

            {/* Nameplate Title — centered */}
            <div
                className="text-center text-white whitespace-nowrap select-none"
                style={{
                    position: "absolute",
                    top: `${top}%`,
                    left: `${left}%`,
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
                className="uppercase tracking-widest -rotate-90 origin-bottom-right select-none"
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
