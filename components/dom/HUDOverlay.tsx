"use client";

import { useEffect, useState } from "react";

export default function HUDOverlay() {
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        const handleScroll = () => {
            // Fade out the HUD layout as soon as the user starts scrolling down (fully hidden by 120px)
            const newOpacity = Math.max(0, 1 - window.scrollY / 120);
            setOpacity(newOpacity);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Set pointer-events-none so clicking through the HUD to the 3D canvas works
    return (
        <div 
            className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-150"
            style={{ opacity }}
        >
            {/* Left Tag — "Dhananjay Chitmilla" */}
            <div
                className="bg-white text-black px-3 py-2 text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-2"
                style={{
                    position: "absolute",
                    top: "48%",
                    left: "24px",
                    transform: "translateY(-50%) rotate(-90deg)",
                    transformOrigin: "left center",
                }}
            >
                <span style={{ fontSize: "14px", lineHeight: 1 }}>↑</span>
                Dhananjay Chitmilla
            </div>

            {/* Scroll Indicator */}
            <div
                className="uppercase tracking-widest text-[10px] text-white/70 font-medium flex items-center gap-2"
                style={{
                    position: "absolute",
                    bottom: "100px",
                    left: "80px",
                    transform: "rotate(-90deg)",
                    transformOrigin: "left bottom",
                }}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-[#11B8EA] animate-ping inline-block mr-1" />
                Scroll To Explore
            </div>
        </div>
    );
}
