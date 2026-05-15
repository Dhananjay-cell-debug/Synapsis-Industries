"use client";

import { useRef, useState, useEffect } from "react";
import ScrollingTicker from "@/components/ui/ScrollingTicker";
import { ReactLenis } from "@studio-freight/react-lenis";
import dynamic from "next/dynamic";

import SynapsisHomepage from "@/components/sections/SynapsisHomepage";

const CanvasWrapper = dynamic(() => import("@/components/canvas/CanvasWrapper"), { ssr: false });

// Reveal-strip geometry for the paper-peel mask (cave → ticker, ticker → homepage)
const REVEAL_STRIPS = [
    { w: 15, l: 0 }, { w: 18, l: 15 }, { w: 15, l: 33 },
    { w: 19, l: 48 }, { w: 16, l: 67 }, { w: 17, l: 83 },
];

/* ─────────── Scroll windows (in viewport-heights) ───────────
    0   – 5.0  vh  Cave / 3D walkthrough alone
    5.0 – 6.0  vh  Cave peels away; ticker fades in underneath
    6.0 – 6.75 vh  Ticker / login peels away
    6.75+      vh  SynapsisHomepage (natural scroll)
   ──────────────────────────────────────────────────────────── */

function CavePeelController() {
    useEffect(() => {
        const STAGGER = 0.12, STRIP_RANGE = 0.40, REVEAL_ZONE = 0.75;
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.5);
        let lastUrlKey = '', rafId = 0, pending = false;
        const compute = () => {
            pending = false;
            const scrollY = window.scrollY, vh = window.innerHeight;
            const cave = document.getElementById('cave-canvas-container') as HTMLElement | null;
            if (!cave) return;
            const winStart = vh * 5, winEnd = vh * 6, totalP = (scrollY - winStart) / (winEnd - winStart);
            if (totalP < 0 || totalP > 1) {
                cave.style.zIndex = '0'; cave.style.maskImage = 'none'; cave.style.webkitMaskImage = 'none';
                cave.style.pointerEvents = totalP < 0 ? 'auto' : 'none';
                cave.style.visibility = totalP > 1 ? 'hidden' : 'visible';
                lastUrlKey = '';
                return;
            }
            cave.style.visibility = 'visible';
            cave.style.zIndex = '9'; cave.style.maskSize = '100% 100%'; cave.style.maskRepeat = 'no-repeat'; cave.style.pointerEvents = 'none';
            const revealP = Math.max(0, Math.min(1, totalP / REVEAL_ZONE));
            const key = revealP.toFixed(3);
            if (key === lastUrlKey) return;
            lastUrlKey = key;
            const rects = REVEAL_STRIPS.map(({ w, l }, i) => {
                const raw = Math.max(0, Math.min(1, (revealP - i * STAGGER) / STRIP_RANGE));
                const peeledPct = easeOut(raw) * 100, remainPct = Math.max(0, 100 - peeledPct);
                return `<rect x="${l}%" y="${peeledPct}%" width="${w + 0.5}%" height="${remainPct}%" fill="white"/>`;
            }).join('');
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${rects}</svg>`;
            const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            cave.style.maskImage = url; cave.style.webkitMaskImage = url;
        };
        const onScroll = () => { if (pending) return; pending = true; rafId = requestAnimationFrame(compute); };
        window.addEventListener('scroll', onScroll, { passive: true });
        compute();
        return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafId); };
    }, []);
    return null;
}

function TickerSection() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onScroll = () => {
            const el = ref.current; if (!el) return;
            const totalP = (window.scrollY - window.innerHeight * 5) / window.innerHeight;
            // Visible: peel-in (5→6) and peel-out window (6→6.75). Past 6.75 → fully gone.
            el.style.opacity = (totalP >= 0 && totalP <= 1.75) ? '1' : '0';
            el.style.pointerEvents = (totalP >= -0.05 && totalP <= 2.0) ? 'auto' : 'none';
        };
        window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return (
        <div
            id="ticker-section-container"
            ref={ref}
            style={{
                position: 'fixed', inset: 0, zIndex: 8, background: '#0A0F1E',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                paddingTop: '8vh', overflow: 'hidden', opacity: 0, pointerEvents: 'none'
            }}
        >
            <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                    <p className="text-[11px] tracking-[0.5em] uppercase text-white/40 font-outfit mb-4">Synapsis Industries</p>
                    <h2 className="font-serif text-white text-5xl md:text-7xl leading-[1.0] mb-6">Systems that<br /><em>scale.</em></h2>
                    <p className="text-white/50 text-base max-w-sm mx-auto mb-8">Built for founders, agencies, and brands who want results — not just deliverables.</p>
                    <div className="flex items-center justify-center gap-4" style={{ zIndex: 100, position: 'relative' }}>
                        <a
                            href="/auth/signin"
                            onClick={(e) => { e.stopPropagation(); window.location.href = "/auth/signin"; }}
                            className="px-6 py-3 text-xs font-semibold tracking-[0.18em] uppercase border border-white/20 text-white/70 hover:text-white hover:border-white/50 transition-all duration-300 cursor-pointer inline-block"
                            style={{ backdropFilter: "blur(8px)", background: "rgba(255,255,255,0.04)", pointerEvents: "auto", position: "relative", zIndex: 200 }}
                        >
                            Login
                        </a>
                        <button
                            onClick={() => window.scrollBy({ top: window.innerHeight * 2, behavior: "smooth" })}
                            className="px-7 py-3 text-xs font-semibold tracking-[0.18em] uppercase text-[#0A0F1E] hover:opacity-90 transition-opacity duration-300 cursor-pointer"
                            style={{ background: "#11B8EA" }}
                        >
                            Explore More ↓
                        </button>
                    </div>
                </div>
            </div>
            <div className="pb-8 flex flex-col gap-2">
                <ScrollingTicker baseVelocity={-4} scrollDependent fontSize="2vw" className="font-bold uppercase tracking-tight text-white/80">SYNAPSIS INDUSTRIES • AI AUTOMATION • FULL STACK DEVELOPMENT • AGENTIC WORKFLOWS •</ScrollingTicker>
                <ScrollingTicker baseVelocity={3} scrollDependent delay={200} fontSize="2vw" className="font-bold uppercase tracking-tight text-white/20">API INTEGRATION • PAYMENT SYSTEMS • DIGITAL ECOSYSTEM ARCHITECTURE • SCALE •</ScrollingTicker>
                <ScrollingTicker baseVelocity={-5} scrollDependent delay={400} fontSize="2vw" className="font-bold uppercase tracking-tight text-white/80">BUILD SYSTEMS • NOT JUST WEBSITES • AUTOMATE EVERYTHING • GROW FASTER •</ScrollingTicker>
            </div>
        </div>
    );
}

function S2PeelController() {
    useEffect(() => {
        const STAGGER = 0.12, STRIP_RANGE = 0.40, REVEAL_ZONE = 0.75;
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.5);
        let lastUrlKey = '', rafId = 0, pending = false;
        const compute = () => {
            pending = false;
            const scrollY = window.scrollY, vh = window.innerHeight;
            const s2 = document.getElementById('ticker-section-container') as HTMLElement | null;
            if (!s2) return;
            const pStart = vh * 6, pEnd = vh * 6.75, totalP = (scrollY - pStart) / (pEnd - pStart);
            if (totalP < 0 || totalP > 1) {
                s2.style.zIndex = '8'; s2.style.maskImage = 'none'; s2.style.webkitMaskImage = 'none';
                lastUrlKey = '';
                return;
            }
            s2.style.opacity = '1'; s2.style.zIndex = '11'; s2.style.maskSize = '100% 100%'; s2.style.maskRepeat = 'no-repeat';
            const revealP = Math.max(0, Math.min(1, totalP / REVEAL_ZONE));
            const key = revealP.toFixed(3);
            if (key === lastUrlKey) return;
            lastUrlKey = key;
            const rects = REVEAL_STRIPS.map(({ w, l }, i) => {
                const raw = Math.max(0, Math.min(1, (revealP - i * STAGGER) / STRIP_RANGE));
                const peeledPct = easeOut(raw) * 100;
                return `<rect x="${l}%" y="${peeledPct}%" width="${w + 0.5}%" height="${100 - peeledPct}%" fill="white"/>`;
            }).join('');
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${rects}</svg>`;
            const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            s2.style.maskImage = url; s2.style.webkitMaskImage = url;
        };
        const onScroll = () => { if (pending) return; pending = true; rafId = requestAnimationFrame(compute); };
        window.addEventListener('scroll', onScroll, { passive: true });
        compute();
        return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafId); };
    }, []);
    return null;
}

export default function Home() {
    const [, setActiveSection] = useState(0);
    const activeSectionRef = useRef(0);

    useEffect(() => {
        if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                const scrollY = window.scrollY, vh = window.innerHeight;
                // 0 = cave, 1 = ticker, 2 = homepage
                const nextSection = scrollY < vh * 0.6 ? 0 : scrollY < vh * 6 ? 1 : 2;
                if (activeSectionRef.current !== nextSection) {
                    activeSectionRef.current = nextSection;
                    setActiveSection(nextSection);
                }
            });
        };
        window.addEventListener("scroll", handleScroll, { passive: true }); handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <ReactLenis root>
            <CavePeelController />
            <TickerSection />
            <S2PeelController />
            <main className="relative w-full" style={{ backgroundColor: "#0A0F1E", cursor: "none" }}>
                {/* Fixed 3D / atmospherics — only over the first ~6.75vh of scroll */}
                <div id="cave-canvas-container" className="fixed inset-0 z-0 h-screen w-full">
                    <CanvasWrapper bgColor="#0A0F1E" groundColor="#11B8EA" />
                </div>
                <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 50%, rgba(10,15,30,0.5) 100%)" }} />
                <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(17,184,234,0.04) 0%, transparent 40%, transparent 60%, rgba(59,106,232,0.06) 100%)" }} />
                <div className="fixed inset-0 z-[2] pointer-events-none opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: "128px 128px" }} />

                {/* Spacer: gives the cave + ticker peel ~6.75vh of scroll runway */}
                <section className="w-full pointer-events-none" style={{ height: "675vh" }} />

                {/* New homepage — natural-flow content starts here */}
                <div className="relative z-10 w-full pointer-events-auto">
                    <SynapsisHomepage />
                </div>
            </main>
        </ReactLenis>
    );
}
