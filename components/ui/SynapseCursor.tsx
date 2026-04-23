"use client";

import { useEffect, useRef } from "react";

export default function SynapseCursor() {
    const wrapRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<SVGCircleElement>(null);
    const dotRef = useRef<SVGCircleElement>(null);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        const move = (e: MouseEvent) => {
            wrap.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        };

        const onOver = (e: MouseEvent) => {
            const isInteractive = !!(e.target as HTMLElement).closest(
                "a, button, [role='button'], input, textarea, select"
            );
            if (ringRef.current) {
                ringRef.current.setAttribute("r", isInteractive ? "20" : "13");
                ringRef.current.setAttribute("stroke-opacity", isInteractive ? "1" : "0.6");
            }
            if (dotRef.current) {
                dotRef.current.setAttribute("r", isInteractive ? "4.5" : "3");
            }
        };

        document.addEventListener("mousemove", move, { passive: true });
        document.addEventListener("mouseover", onOver, { passive: true });
        return () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseover", onOver);
        };
    }, []);

    return (
        <div
            ref={wrapRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                pointerEvents: "none",
                zIndex: 99999,
                willChange: "transform",
            }}
        >
            <svg width="1" height="1" style={{ overflow: "visible" }}>
                <defs>
                    <filter id="synapse-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Outer ring — grows on hover */}
                <circle
                    ref={ringRef}
                    cx="0" cy="0" r="13"
                    fill="none"
                    stroke="#11B8EA"
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                    style={{ transition: "r 0.22s cubic-bezier(.4,0,.2,1), stroke-opacity 0.22s" }}
                />

                {/* N/S/E/W tick marks — fixed, outside ring */}
                <line x1="0" y1="-17" x2="0" y2="-23" stroke="#11B8EA" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
                <line x1="0" y1="17" x2="0" y2="23" stroke="#11B8EA" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
                <line x1="17" y1="0" x2="23" y2="0" stroke="#11B8EA" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
                <line x1="-17" y1="0" x2="-23" y2="0" stroke="#11B8EA" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />

                {/* Center dot with glow */}
                <circle
                    ref={dotRef}
                    cx="0" cy="0" r="3"
                    fill="#11B8EA"
                    filter="url(#synapse-glow)"
                    style={{ transition: "r 0.15s cubic-bezier(.4,0,.2,1)" }}
                />
            </svg>
        </div>
    );
}
