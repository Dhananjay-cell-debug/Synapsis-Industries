"use client";

import { useEffect, useState } from "react";

export default function Loader() {
    const [visible, setVisible] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Start fade after 1.5s
        const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
        // Remove from DOM after fade completes (2s transition)
        const removeTimer = setTimeout(() => setVisible(false), 3500);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[9998] flex items-center justify-center transition-opacity duration-[2000ms]"
            style={{
                backgroundColor: "#0A0F1E",
                opacity: fadeOut ? 0 : 1,
                pointerEvents: fadeOut ? "none" : "auto",
            }}
        >
            <div className="text-center">
                {/* Pulsing V logo */}
                <div
                    className="text-7xl md:text-9xl font-serif"
                    style={{
                        animation: "pulse-loader 2s ease-in-out infinite",
                        color: "#11B8EA",
                    }}
                >
                    V.
                </div>
                <p className="text-sm tracking-[0.3em] uppercase mt-4" style={{ color: "#11B8EA", opacity: 0.6 }}>
                    Synapsis Industries
                </p>
            </div>

            <style jsx>{`
                @keyframes pulse-loader {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.3; transform: scale(1.05); }
                }
            `}</style>
        </div>
    );
}
