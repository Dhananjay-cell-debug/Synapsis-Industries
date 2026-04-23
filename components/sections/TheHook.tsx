"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import IslandScene from "@/components/canvas/IslandScene";
import { storyContent } from "@/config/neverlandContent";

// ── Shared scroll progress (module-level to avoid rerenders) ──
const scrollRef = { progress: 0 };

// ── Scroll-driven Camera ──
function IslandCamera() {
    useFrame((state) => {
        const p = scrollRef.progress;
        const lerp = (a: number, b: number, t: number) =>
            a + (b - a) * Math.max(0, Math.min(1, t));
        const ph = (s: number, e: number) =>
            Math.max(0, Math.min(1, (p - s) / (e - s)));

        // Starting shot: slightly left of island, wide, ocean left / island right
        // Act 1 (0–15%): Establish — wide shot
        // Act 2 (15–55%): Push right toward character on island
        // Act 3 (55–75%): Close on character face
        // Act 4 (75–85%): Snap
        // Act 5 (85–100%): Pan left over ocean to distant mountain

        let camX = lerp(-2.0, 2.5, ph(0.15, 0.60)); // move right toward island
        let camY = lerp(2.5, 1.8, ph(0.15, 0.60));  // come down slightly
        let camZ = lerp(12, 6.5, ph(0.15, 0.60));  // push in

        let lookX = lerp(3.0, 4.5, ph(0.15, 0.70));  // look at island/character
        let lookY = lerp(1.5, 2.0, ph(0.30, 0.70));  // look at face height
        let lookZ = lerp(1.5, 2.0, ph(0.0, 0.20));

        // Act 5: pan left over the open ocean toward mountain island
        if (p > 0.82) {
            const t5 = ph(0.82, 1.0);
            camX = lerp(2.5, -6, t5);
            camY = lerp(1.8, 3.5, t5);
            camZ = lerp(6.5, 8.0, t5);
            lookX = lerp(4.5, -12, t5);
            lookY = lerp(2.0, 1.5, t5);
            lookZ = lerp(2.0, -30, t5);
        }

        state.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.04);
        state.camera.lookAt(new THREE.Vector3(lookX, lookY, lookZ));
    });
    return null;
}

// ── Typewriter + Fade ──
function TypewriterFade({ text, delay = 0, style = {} }: { text: string; delay?: number; style?: React.CSSProperties }) {
    const [displayed, setDisplayed] = useState("");
    const [phase, setPhase] = useState<"wait" | "type" | "hold" | "fade" | "done">("wait");
    const idxRef = useRef(0);
    useEffect(() => {
        const t = setTimeout(() => {
            setPhase("type");
            const iv = setInterval(() => {
                idxRef.current++;
                setDisplayed(text.slice(0, idxRef.current));
                if (idxRef.current >= text.length) {
                    clearInterval(iv);
                    setPhase("hold");
                    setTimeout(() => { setPhase("fade"); setTimeout(() => setPhase("done"), 1000); }, 2200);
                }
            }, 42);
            return () => clearInterval(iv);
        }, delay);
        return () => clearTimeout(t);
    }, []);
    if (phase === "done" || phase === "wait") return null;
    return (
        <span style={{ ...style, opacity: phase === "fade" ? 0 : 1, transition: phase === "fade" ? "opacity 1s ease" : "none", display: "block" }}>
            {displayed}
            {phase === "type" && <span style={{ borderRight: "2px solid rgba(255,255,255,0.9)", animation: "twBlink 0.7s step-end infinite" }} />}
        </span>
    );
}

// ── Main ──
export default function TheHook() {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [prog, setProg] = useState(0);
    const [flashOp, setFlashOp] = useState(0);

    useEffect(() => {
        const onScroll = () => {
            if (!wrapRef.current) return;
            const rect = wrapRef.current.getBoundingClientRect();
            const total = wrapRef.current.offsetHeight - window.innerHeight;
            const p = Math.max(0, Math.min(1, -rect.top / total));
            scrollRef.progress = p;
            setProg(p);
            // Snap flash at 75–83%
            setFlashOp(Math.max(0, Math.sin(Math.max(0, Math.min(1, (p - 0.75) / 0.08)) * Math.PI) * 0.9));
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <>
            <style>{`
                @keyframes twBlink { 0%,100%{opacity:1} 50%{opacity:0} }
                @keyframes scrollDot { 0%,100%{transform:translateY(0);opacity:1} 50%{transform:translateY(10px);opacity:0.3} }
            `}</style>

            {/* 420vh scroll runway */}
            <div ref={wrapRef} style={{ height: "420vh", position: "relative" }}>
                <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>

                    {/* ── Full 3D Canvas ── */}
                    <Canvas
                        camera={{ position: [-2, 2.5, 12], fov: 55, near: 0.1, far: 300 }}
                        style={{ position: "absolute", inset: 0 }}
                        shadows
                        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
                    >
                        <IslandScene />
                        <IslandCamera />
                    </Canvas>

                    {/* ── Snap flash ── */}
                    <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "white", opacity: flashOp, pointerEvents: "none" }} />

                    {/* Sparks at snap */}
                    {flashOp > 0.05 && [...Array(8)].map((_, i) => (
                        <div key={i} style={{
                            position: "absolute", top: "42%", right: "35%",
                            width: 6, height: 6, borderRadius: "50%", background: "#fffa80",
                            opacity: flashOp, zIndex: 21, pointerEvents: "none",
                            transform: `rotate(${i * 45}deg) translateY(-${22 + i * 9}px)`,
                            boxShadow: "0 0 14px 7px rgba(255,240,50,0.9)",
                        }} />
                    ))}

                    {/* ── Typewriter text (Act 1 only) ── */}
                    {prog < 0.12 && (
                        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 2rem", pointerEvents: "none" }}>
                            <TypewriterFade
                                text={storyContent.hero}
                                delay={700}
                                style={{ fontSize: "clamp(1.5rem,4vw,3rem)", fontWeight: 600, color: "white", textShadow: "0 2px 24px rgba(0,0,0,0.7)", marginBottom: 14, fontFamily: "Outfit,sans-serif", letterSpacing: "-0.02em" }}
                            />
                            <TypewriterFade
                                text={storyContent.subtitle}
                                delay={storyContent.hero.length * 42 + 1000}
                                style={{ fontSize: "clamp(0.9rem,2vw,1.3rem)", color: "rgba(255,255,255,0.88)", textShadow: "0 1px 12px rgba(0,0,0,0.6)", fontFamily: "Outfit,sans-serif", fontWeight: 300 }}
                            />
                        </div>
                    )}

                    {/* Mountain caption — Act 5 */}
                    {prog > 0.86 && (
                        <div style={{ position: "absolute", bottom: 64, left: "50%", transform: "translateX(-50%)", zIndex: 10, textAlign: "center", opacity: Math.min(1, (prog - 0.86) / 0.14), pointerEvents: "none" }}>
                            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, letterSpacing: 5, fontFamily: "monospace", textTransform: "uppercase" }}>The Story Awaits</p>
                        </div>
                    )}

                    {/* Scroll hint */}
                    {prog < 0.04 && (
                        <div style={{ position: "absolute", bottom: 38, left: "50%", transform: "translateX(-50%)", zIndex: 10, textAlign: "center", pointerEvents: "none" }}>
                            <div style={{ width: 28, height: 44, border: "2px solid rgba(255,255,255,0.45)", borderRadius: 14, margin: "0 auto 8px", display: "flex", justifyContent: "center", paddingTop: 6 }}>
                                <div style={{ width: 3, height: 8, borderRadius: 2, background: "rgba(255,255,255,0.75)", animation: "scrollDot 1.4s ease-in-out infinite" }} />
                            </div>
                            <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 10, letterSpacing: 4, fontFamily: "monospace" }}>SCROLL</p>
                        </div>
                    )}
                </div>
            </div >
        </>
    );
}