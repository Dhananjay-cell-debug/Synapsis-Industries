"use client";

import { useEffect, useRef, useState } from "react";

export default function FairyCursor() {
    const cursorRef = useRef<HTMLDivElement>(null);
    const pos = useRef({ x: 0, y: 0 });
    const target = useRef({ x: 0, y: 0 });
    const [isPopped, setIsPopped] = useState(false);

    useEffect(() => {
        // Only on desktop
        if (window.innerWidth < 1280) return;

        const handleMouseMove = (e: MouseEvent) => {
            target.current.x = e.clientX;
            target.current.y = e.clientY;

            // Check if hovering over interactive element
            const el = e.target as HTMLElement;
            const isInteractive = el.closest("a, button, [role='button'], .fairy-hover, .neverland-link");
            setIsPopped(!!isInteractive);
        };

        const animate = () => {
            // Smooth lerp follow — slightly slower when popped
            const speed = isPopped ? 0.1 : 0.15;
            pos.current.x += (target.current.x - pos.current.x) * speed;
            pos.current.y += (target.current.y - pos.current.y) * speed;

            if (cursorRef.current) {
                cursorRef.current.style.left = `${pos.current.x}px`;
                cursorRef.current.style.top = `${pos.current.y}px`;
            }

            requestAnimationFrame(animate);
        };

        window.addEventListener("mousemove", handleMouseMove);
        const raf = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            cancelAnimationFrame(raf);
        };
    }, [isPopped]);

    return (
        <div
            ref={cursorRef}
            className="hidden xl:block fixed z-[9999] pointer-events-none"
            style={{
                width: isPopped ? "40px" : "16px",
                height: isPopped ? "40px" : "16px",
                borderRadius: "50%",
                backgroundColor: isPopped ? "#e3869c" : "#1a1a1a",
                transform: "translate(-50%, -50%)",
                mixBlendMode: isPopped ? "multiply" : "difference",
                transition: "width 0.25s cubic-bezier(.77,0,.175,1), height 0.25s cubic-bezier(.77,0,.175,1), background-color 0.25s cubic-bezier(.77,0,.175,1)",
                top: 0,
                left: 0,
                opacity: 0.85,
            }}
        />
    );
}
