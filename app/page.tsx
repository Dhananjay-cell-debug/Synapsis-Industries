"use client";

import { useRef, useState, useEffect } from "react";
import Section3Calibrator from "@/components/dom/Section3Calibrator";
import ScrollingTicker from "@/components/ui/ScrollingTicker";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { HomeIcon, CompassIcon } from "lucide-react";
import { PROBLEM_CONFIG } from "@/config/problem-animation";
import { useProblemStore } from "@/store/useProblemStore";
import { ReactLenis } from "@studio-freight/react-lenis";
import dynamic from "next/dynamic";

// Narrative Sections
import TheProblem from "@/components/sections/TheProblem";
import ThePhilosophy from "@/components/sections/ThePhilosophy";
import ServiceHub from "@/components/sections/ServiceHub";
import DeepDiveProduction from "@/components/sections/DeepDiveProduction";
import DeepDiveMarketing from "@/components/sections/DeepDiveMarketing";
import DeepDiveTech from "@/components/sections/DeepDiveTech";
import TheShowreel from "@/components/sections/TheShowreel";
import CaseStudies from "@/components/sections/CaseStudies";
import Process from "@/components/sections/Process";
import TheArchitects from "@/components/sections/TheArchitects";
import Voices from "@/components/sections/Voices";
import SelectedPartners from "@/components/sections/SelectedPartners";
import FAQ from "@/components/sections/FAQ";
import TerminalCTA from "@/components/sections/TerminalCTA";
import { Timeline } from "@/components/ui/timeline";

const timelineData = [
    { title: "The Reality", content: (<p className="text-white/80 text-lg md:text-2xl font-light mb-8">Most businesses are still doing things manually. Every repeated task, every delayed integration, every manual handoff — that's money leaving your business every single day.</p>) },
    { title: "The Gap", content: (<p className="text-white/80 text-lg md:text-2xl font-light mb-8">The teams who will dominate the next decade are the ones building automated systems now. Not hiring more people — building smarter infrastructure.</p>) },
    { title: "The Offer", content: (<p className="text-white/80 text-lg md:text-2xl font-light mb-8">I architect and deploy end-to-end digital ecosystems. AI agents, automated workflows, full-stack systems — built fast, built to last. One person. Zero agency overhead. Maximum leverage.</p>) },
];

const CanvasWrapper = dynamic(() => import("@/components/canvas/CanvasWrapper"), { ssr: false });

const REVEAL_STRIPS = [
    { w: 15, l: 0 }, { w: 18, l: 15 }, { w: 15, l: 33 },
    { w: 19, l: 48 }, { w: 16, l: 67 }, { w: 17, l: 83 },
];

function CavePeelController() {
    useEffect(() => {
        const STAGGER = 0.12, STRIP_RANGE = 0.40, REVEAL_ZONE = 0.75;
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.5);
        const onScroll = () => {
            const scrollY = window.scrollY, vh = window.innerHeight;
            const cave = document.getElementById('cave-canvas-container') as HTMLElement | null;
            if (!cave) return;
            const winStart = vh * 5, winEnd = vh * 6, totalP = (scrollY - winStart) / (winEnd - winStart);
            if (totalP < 0 || totalP > 1) {
                cave.style.zIndex = '0'; cave.style.maskImage = 'none'; cave.style.webkitMaskImage = 'none';
                // After peel completes (totalP > 1), cave is invisible — don't let it eat clicks
                cave.style.pointerEvents = totalP < 0 ? 'auto' : 'none'; return;
            }
            cave.style.zIndex = '9'; cave.style.maskSize = '100% 100%'; cave.style.maskRepeat = 'no-repeat'; cave.style.pointerEvents = 'none';
            const revealP = Math.max(0, Math.min(1, totalP / REVEAL_ZONE));
            const rects = REVEAL_STRIPS.map(({ w, l }, i) => {
                const raw = Math.max(0, Math.min(1, (revealP - i * STAGGER) / STRIP_RANGE));
                const peeledPct = easeOut(raw) * 100, remainPct = Math.max(0, 100 - peeledPct);
                return `<rect x="${l}%" y="${peeledPct}%" width="${w + 0.5}%" height="${remainPct}%" fill="white"/>`;
            }).join('');
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${rects}</svg>`, url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            cave.style.maskImage = url; cave.style.webkitMaskImage = url;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return null;
}

function TickerSection() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onScroll = () => {
            const el = ref.current; if (!el) return;
            const totalP = (window.scrollY - window.innerHeight * 5) / window.innerHeight;
            el.style.opacity = (totalP >= 0 && totalP <= 1.75) ? '1' : '0';
            // Slightly wider range than opacity — prevents Lenis lag from briefly killing clicks
            el.style.pointerEvents = (totalP >= -0.05 && totalP <= 2.0) ? 'auto' : 'none';
        };
        window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return (
        <div id="ticker-section-container" ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 8, background: '#0A0F1E', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: '8vh', overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
            <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                    <p className="text-[11px] tracking-[0.5em] uppercase text-white/40 font-outfit mb-4">Synapsis Industries</p>
                    <h2 className="font-serif text-white text-5xl md:text-7xl leading-[1.0] mb-6">Systems that<br /><em>scale.</em></h2>
                    <p className="text-white/50 text-base max-w-sm mx-auto mb-8">Built for founders, agencies, and brands who want results — not just deliverables.</p>
                    <div className="flex items-center justify-center gap-4">
                        <a
                            href="/auth/signin"
                            className="px-6 py-3 text-xs font-semibold tracking-[0.18em] uppercase border border-white/20 text-white/70 hover:text-white hover:border-white/50 transition-all duration-300"
                            style={{ backdropFilter: "blur(8px)", background: "rgba(255,255,255,0.04)", pointerEvents: 'auto' }}
                        >
                            Login
                        </a>
                        <button
                            onClick={() => window.scrollBy({ top: window.innerHeight * 2, behavior: "smooth" })}
                            className="px-7 py-3 text-xs font-semibold tracking-[0.18em] uppercase text-[#0A0F1E] hover:opacity-90 transition-opacity duration-300"
                            style={{ background: "#11B8EA", pointerEvents: 'auto' }}
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
        const onScroll = () => {
            const scrollY = window.scrollY, vh = window.innerHeight;
            const s2 = document.getElementById('ticker-section-container') as HTMLElement | null;
            if (!s2) return;
            const pStart = vh * 6, pEnd = vh * 6.75, totalP = (scrollY - pStart) / (pEnd - pStart);
            if (totalP < 0 || totalP > 1) { s2.style.zIndex = '8'; s2.style.maskImage = 'none'; s2.style.webkitMaskImage = 'none'; return; }
            s2.style.opacity = '1'; s2.style.zIndex = '11'; s2.style.maskSize = '100% 100%'; s2.style.maskRepeat = 'no-repeat';
            const revealP = Math.max(0, Math.min(1, totalP / REVEAL_ZONE));
            const rects = REVEAL_STRIPS.map(({ w, l }, i) => { const raw = Math.max(0, Math.min(1, (revealP - i * STAGGER) / STRIP_RANGE)); const peeledPct = easeOut(raw) * 100; return `<rect x="${l}%" y="${peeledPct}%" width="${w + 0.5}%" height="${100 - peeledPct}%" fill="white"/>`; }).join('');
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${rects}</svg>`, url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
            s2.style.maskImage = url; s2.style.webkitMaskImage = url;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return null;
}

function ProblemSection({ progress }: { progress: number }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current; if (!el) return;
        el.style.opacity = (progress > 0 && progress < 1) ? '1' : '0';
        el.style.pointerEvents = (progress > 0 && progress < 1) ? 'auto' : 'none';
        el.style.zIndex = PROBLEM_CONFIG.Z_INDEX.SECTION.toString();
    }, [progress]);
    return (<div ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 7, opacity: 0, pointerEvents: 'none' }}><TheProblem progress={progress} /></div>);
}

export default function Home() {
    const [activeSection, setActiveSection] = useState(0);
    const [s3Progress, setS3Progress] = useState(0);
    const s3ProgressRef = useRef(0);
    const activeSectionRef = useRef(0);
    const config = useProblemStore();
    useEffect(() => {
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }
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
            const nextSection = scrollY < vh * 0.6 ? 0 : scrollY < vh * 4.5 ? 1 : 2;
            if (activeSectionRef.current !== nextSection) {
                activeSectionRef.current = nextSection;
                setActiveSection(nextSection);
            }
            const s3Start = (vh * config.startVh) / 100, s3Duration = (vh * config.durationVh) / 100;
            const currentP = (scrollY - s3Start) / s3Duration;
            const nextProgress = Math.max(0, Math.min(1, currentP));
            if (Math.abs(s3ProgressRef.current - nextProgress) > 0.005) {
                s3ProgressRef.current = nextProgress;
                setS3Progress(nextProgress);
            }
            });
        };
        window.addEventListener("scroll", handleScroll, { passive: true }); handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, [config.startVh, config.durationVh]);

    return (
        <ReactLenis root>
            <Section3Calibrator />
            <CavePeelController /><TickerSection /><S2PeelController /><ProblemSection progress={s3Progress} />
            <main className="relative w-full min-h-[400vh]" style={{ backgroundColor: "#0A0F1E", cursor: "none" }}>
                <div id="cave-canvas-container" className="fixed inset-0 z-0 h-screen w-full"><CanvasWrapper bgColor="#0A0F1E" groundColor="#11B8EA" /></div>
                <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 50%, rgba(10,15,30,0.5) 100%)" }} />
                <div className="fixed inset-0 z-[1] pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(17,184,234,0.04) 0%, transparent 40%, transparent 60%, rgba(59,106,232,0.06) 100%)" }} />
                <div className="fixed inset-0 z-[2] pointer-events-none opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: "128px 128px" }} />
                <div className="relative z-10 w-full pointer-events-none">
                    <section className="w-full pointer-events-none" style={{ height: "600vh" }} /><div id="problem-section" />
                    <section className="w-full pointer-events-none" style={{ height: "100vh" }} />
                    <section className="w-full relative pointer-events-auto" style={{ minHeight: `${config.durationVh + 400}vh`, paddingTop: `${config.timelineOffsetVh}vh`, zIndex: PROBLEM_CONFIG.Z_INDEX.TIMELINE }}><Timeline data={timelineData} /></section>
                    <div className="pointer-events-auto flex flex-col w-full">
                        <ThePhilosophy /><ServiceHub /><DeepDiveProduction /><DeepDiveMarketing /><DeepDiveTech /><TheShowreel /><CaseStudies /><Process /><TheArchitects /><Voices /><SelectedPartners /><FAQ /><TerminalCTA />
                    </div>
                </div>
            </main>
        </ReactLenis>
    );
}
