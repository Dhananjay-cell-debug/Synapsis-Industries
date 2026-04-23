"use client";

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface StaggeredPiecesProps {
    children: React.ReactNode;
    pieces?: number;
    className?: string;
}

export default function StaggeredPieces({ children, pieces = 4, className = "" }: StaggeredPiecesProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const slicesRef = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const ctx = gsap.context(() => {
            if (!containerRef.current) return;

            // We want the slices to start offset and come into alignment when the section is fully in view.
            slicesRef.current.forEach((slice, i) => {
                if (!slice) return;

                // Create a varied offset for the staggering effect
                // E.g. pieces: 0, 1, 2, 3 -> offsets: 100, -150, 200, -80
                const direction = i % 2 === 0 ? 1 : -1;
                const offset = (100 + (i * 40)) * direction;

                gsap.fromTo(
                    slice,
                    { y: offset },
                    {
                        y: 0,
                        ease: "none",
                        scrollTrigger: {
                            trigger: containerRef.current,
                            start: "top bottom", // Starts when top of container hits bottom of screen
                            end: "center center", // Ends when container is centered
                            scrub: 1, // Smooth scrub
                        },
                    }
                );
            });
        }, containerRef);

        return () => ctx.revert();
    }, []);

    // Create the clipped segments
    const segments = Array.from({ length: pieces }).map((_, i) => {
        const widthPercent = 100 / pieces;
        const leftPercent = i * widthPercent;
        const rightPercent = 100 - (leftPercent + widthPercent);

        return (
            <div
                key={i}
                ref={(el) => {
                    slicesRef.current[i] = el;
                }}
                className="absolute inset-0 w-full h-full will-change-transform"
                style={{
                    // clip-path: inset(top right bottom left)
                    clipPath: `inset(0 ${rightPercent}% 0 ${leftPercent}%)`,
                }}
            >
                {children}
            </div>
        );
    });

    return (
        <div ref={containerRef} className={`relative w-full ${className}`} style={{ minHeight: "100vh" }}>
            {/* The individual sliced pieces that animate */}
            {segments}

            {/* We also render a visually hidden exact copy for screen readers and natural flow layout if needed. 
                But since segments are absolute, we need one static relative element to push the height in the DOM. 
                We use visibility: hidden block to set the height natively. */}
            <div className="relative w-full opacity-0 pointer-events-none" aria-hidden="true" style={{ visibility: "hidden" }}>
                {children}
            </div>
        </div>
    );
}
