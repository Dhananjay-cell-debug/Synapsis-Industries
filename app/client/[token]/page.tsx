/** @jsxImportSource react */
/// <reference types="react" />
"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import {
    ArrowRight, Clock, CheckCircle, XCircle, AlertCircle,
    LayoutDashboard, Map, FileQuestion, MessageSquare, Layers, Rocket, Hammer, Sparkles, Package,
    Send, LogOut, ChevronRight, Zap, Target, Users, HelpCircle, Lock
} from "lucide-react";
import PaymentGate from "@/components/ui/PaymentGate";
import BlueprintViewer from "@/components/phases/BlueprintViewer";
import IgnitionView from "@/components/phases/IgnitionView";
import BuildView from "@/components/phases/BuildView";
import DeliverView from "@/components/phases/DeliverView";
import HandoverView from "@/components/phases/HandoverView";
import OrbitView from "@/components/phases/OrbitView";
import { PHASE_NAMES } from "@/lib/phases/constants";

// ─── Constants ───────────────────────────────────────────────────────────────

const QUESTIONS = [
    "The Objective: Imagine this system is completely ready and live. What are the top 3 exact things it MUST be able to do for you to consider this project a massive success?",
    "The Anti-Scope: Is there anything you specifically DO NOT want, or want to keep for a future 'Phase 2' of your own business? (e.g., 'We only want the website now, the mobile app is for next year.')",
    "The Current State: Are we building this completely from scratch, or do you have existing websites, databases, or software that this NEW system needs to connect with?",
    "The Success Metric: Six months after launch, what specific, measurable metric will tell you this investment was worth it? (e.g., 20% increase in leads, 5 hours saved per week).",
    "The Budget: To ensure I don't design a Rolls-Royce system for a Honda Civic budget, what investment range have you allocated for this?",
    "The Timeline: When does this project absolutely need to be live, and what is the exact business cost if we miss that date?",
    "The Authority: Who is the exact, single person who will review the final work and say 'Yes, this is approved'? (To avoid confusing feedback loops).",
    "The Momentum: My systems are built with momentum. Can you commit to reviewing updates and providing feedback within 24-48 hours during the build phase?",
    "The Raw Materials: To build this fast, I need your 'Raw Materials'. Please select what you already have ready to hand over immediately:",
];


const PHASES = [
    {
        name: "Strategic Discovery",
        tag: "DISCOVER · Phase 1",
        duration: "2–3 days",
        desc: "We dive deep into your business goals, target audience, and market positioning to create a solid foundation.",
        you: "Fill discovery questionnaire & provide assets",
        us: "Analyze requirements & define project scope",
        glowA: "#11B8EA", glowB: "#3B6AE8",
    },
    {
        name: "System Architecture",
        tag: "BLUEPRINT · Phase 2",
        duration: "3–5 days",
        desc: "Designing the technical blueprint and user flow. We map out every interaction and data point.",
        you: "Review & approve architectural maps",
        us: "Build component library & state logic",
        glowA: "#3B6AE8", glowB: "#11B8EA",
    },
    {
        name: "Vark Design Language",
        tag: "DESIGN · Phase 3",
        duration: "5–7 days",
        desc: "Applying our signature premium blue-white aesthetic to your specific brand needs. High-fidelity mockups.",
        you: "Design feedback & refinement cycles",
        us: "Full UI design & motion prototyping",
        glowA: "#6366f1", glowB: "#11B8EA",
    },
    {
        name: "Core Development",
        tag: "BUILD · Phase 4",
        duration: "2–4 weeks",
        desc: "The heavy lifting. Building the frontend and backend systems using Next.js 14 and advanced AI tooling.",
        you: "Bi-weekly progress reviews",
        us: "Full-stack implementation & integration",
        glowA: "#11B8EA", glowB: "#6366f1",
    },
    {
        name: "Optimization & QA",
        tag: "POLISH · Phase 5",
        duration: "3–5 days",
        desc: "Stress testing, speed optimization, and polishing every micro-interaction for a premium feel.",
        you: "User acceptance testing (UAT)",
        us: "Performance tuning & bug squashing",
        glowA: "#10b981", glowB: "#3B6AE8",
    },
    {
        name: "Deployment & Scale",
        tag: "IGNITION · Phase 6",
        duration: "1–2 days",
        desc: "Going live. We handle the production rollout and ensure your system is ready for real-world traffic.",
        you: "Final sign-off & launch!",
        us: "Vercel deployment & monitoring setup",
        glowA: "#f59e0b", glowB: "#11B8EA",
    },
    {
        name: "ORBIT — Post-Launch",
        tag: "ORBIT · Phase 7",
        duration: "Ongoing",
        desc: "We don't disappear after launch. Monitoring, iterations, and scale support as your product grows.",
        you: "Share feedback & growth targets",
        us: "Continuous support, optimization & feature drops",
        glowA: "#11B8EA", glowB: "#10b981",
    },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
    from: "client" | "vark";
    text: string;
    time: string;
}

interface DealPayment {
    phase: number;
    percentage: number;
    amount: number;
    status: "pending" | "paid";
    paidAt?: number;
}

interface Deal {
    id: string;
    token: string;
    name: string;
    company: string;
    budget: string;
    need: string;
    status: "pending" | "elected" | "rejected" | "expired" | "proceeding" | "active";
    phase?: number;
    expiryTime?: string;
    messages?: Message[];
    questionnaire?: Record<string, string>;
    totalPrice?: number;
    payments?: DealPayment[];
    projectDays?: number;
    customQuestions?: string[];
    phaseData?: any;
}

// ─── Phase Duration Calculator ────────────────────────────────────────────────

function calcPhaseDurations(totalDays: number): string[] {
    const working = Math.floor(totalDays * 0.75);
    const weights = [0.08, 0.10, 0.14, 0.48, 0.12, 0.05, 0.03];
    return weights.map(w => {
        const d = Math.max(1, Math.round(working * w));
        if (d === 1) return "1 day";
        if (d < 14) return `${d} days`;
        if (d < 21) return "2 weeks";
        if (d < 35) return `${Math.round(d / 7)} weeks`;
        if (d < 50) return "~1 month";
        return `~${Math.round(d / 30)} months`;
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getComplexityProfile(need: string) {
    const n = need.toLowerCase();
    const score = (base: number, signals: [string[], number][]) => {
        const total = signals.reduce((acc, [keywords, weight]) => {
            return acc + (keywords.some(k => n.includes(k)) ? weight : 0);
        }, base);
        return Math.min(100, total);
    };
    return [
        {
            label: "Frontend Logic",
            pct: score(35, [
                [["dashboard", "portal", "platform"], 15],
                [["custom", "complex", "interactive"], 20],
                [["animation", "motion", "3d"], 15],
                [["landing", "website", "web app", "webapp"], 10],
                [["realtime", "real-time", "live"], 10],
            ]),
        },
        {
            label: "Backend Integration",
            pct: score(25, [
                [["api", "integration", "webhook"], 25],
                [["payment", "stripe", "razorpay"], 25],
                [["auth", "authentication", "login"], 15],
                [["database", "db", "cms"], 15],
                [["fullstack", "full stack", "full-stack"], 15],
            ]),
        },
        {
            label: "AI Orchestration",
            pct: score(10, [
                [["ai", "artificial intelligence", "machine learning"], 35],
                [["automation", "automate", "automated"], 30],
                [["agent", "agentic", "workflow"], 30],
                [["chatbot", "llm", "gpt"], 25],
                [["scraper", "scraping", "outreach"], 15],
            ]),
        },
        {
            label: "Motion & UX",
            pct: score(72, [ // Vark standard baseline is always elevated
                [["premium", "luxury", "high-end"], 15],
                [["animation", "motion", "transition"], 15],
                [["3d", "three", "canvas"], 13],
            ]),
        },
    ];
}

// ─── Components ──────────────────────────────────────────────────────────────

function Countdown({ expiryTime }: { expiryTime: string }) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const end = new Date(expiryTime).getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft("Offer Expired");
                clearInterval(timer);
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(timer);
    }, [expiryTime]);

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <Clock size={12} className="text-[#11B8EA]" />
            <span className="text-[10px] font-bold tracking-widest text-[#11B8EA] uppercase">{timeLeft}</span>
        </div>
    );
}

// ─── Tab Content ─────────────────────────────────────────────────────────────

function OverviewTab({ deal, onQuestionnaireClick, onProcessClick, onUnlock, unlocked }: { deal: Deal; onQuestionnaireClick: () => void; onProcessClick: () => void; onUnlock: () => void; unlocked: boolean }) {
    const complexityRows = useMemo(() => getComplexityProfile(deal.need), [deal.need]);
    const isQuestionnaireSubmitted = !!deal.questionnaire;

    return (
        <div className="flex flex-col gap-6">

            {/* Card 1 — Official Selection (White) */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-[2rem] p-10 bg-white flex flex-col">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                    <span className="text-[10px] font-bold tracking-[0.35em] uppercase text-black/40">Official Selection Confirmed</span>
                </div>
                <h1 className="font-serif text-5xl text-[#0A0F1E] leading-tight mb-6">
                    Warm regards,<br />
                    <em>{deal.name}.</em>
                </h1>
                <p className="text-base text-black/55 leading-relaxed max-w-2xl mb-8">
                    We have thoroughly reviewed your project requirements for{" "}
                    <strong className="text-black/80">{deal.need}</strong> at {deal.company}. It is our
                    pleasure to inform you that your candidacy has been officially{" "}
                    <span className="font-bold text-[#11B8EA]">ELECTED</span>. We are prepared to move
                    forward and translate your vision into a robust, high-performance system.
                </p>
                <div className="h-px bg-black/[0.08] mb-8" />
                <div className="grid grid-cols-3 gap-8">
                    {[
                        { label: "Client Profile", value: `${deal.name} · ${deal.company}`, highlight: false },
                        { label: "Elected Service", value: deal.need, highlight: true },
                        { label: "Project Scope", value: deal.budget, highlight: false },
                    ].map((col) => (
                        <div key={col.label}>
                            <p className="text-[9px] tracking-[0.4em] uppercase text-black/30 font-bold mb-1">{col.label}</p>
                            <p className={`text-sm font-semibold ${col.highlight ? "text-[#11B8EA]" : "text-black/80"}`}>{col.value}</p>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Card 2 — What you will know (Glassmorphic Dark) */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="relative rounded-[2rem] p-10 overflow-hidden min-h-[360px] flex flex-col justify-between"
                style={{ background: "rgba(8,12,26,0.95)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {/* Blue leak — top left */}
                <div className="absolute -top-24 -left-24 w-[55%] h-[130%] rounded-full pointer-events-none"
                    style={{ background: "#11B8EA", filter: "blur(80px)", willChange: "transform", animation: "blobFloat 10s ease-in-out infinite" }} />
                {/* Green leak — bottom right */}
                <div className="absolute -bottom-24 -right-24 w-[55%] h-[130%] rounded-full pointer-events-none"
                    style={{ background: "#10b981", filter: "blur(80px)", willChange: "transform", animation: "blobFloat2 12s ease-in-out infinite" }} />
                {/* Glass shine */}
                <div className="absolute inset-0 rounded-[2rem] pointer-events-none"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 50%)", borderTop: "1px solid rgba(255,255,255,0.1)" }} />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/90">Phase 01</span>
                        </div>
                        <div className="h-px w-12 bg-white/20" />
                        <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-white/40">Active Milestone</span>
                    </div>

                    <h1 className="font-serif text-6xl text-white leading-tight mb-8">
                        Strategic Discovery.
                    </h1>

                    <div className="max-w-xl">
                        <p className="text-xl text-white/70 leading-relaxed mb-10">
                            We will cover how we gonna proceed throughout our whole project, here&apos;s what you will know in this phase:
                        </p>
                        <div className="grid grid-cols-1 gap-5">
                            {[
                                { icon: <Target className="text-[#11B8EA]" size={18} />, text: "Blueprint of how we gonna proceed throughout the architecture." },
                                { icon: <Clock className="text-[#10b981]" size={18} />, text: "A clear breakdown of every phase — what happens, in what order, and why." },
                                { icon: <Users className="text-[#11B8EA]" size={18} />, text: "Opportunities to get to know each other better and align visions." },
                                { icon: <HelpCircle className="text-[#10b981]" size={18} />, text: "Some really important questions to clear the operational fog." },
                                { icon: <Zap className="text-[#11B8EA]" size={18} />, text: "Immediate technical next moves and asset requirements." },
                            ].map((step, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-4 group/item">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover/item:border-white/20 transition-colors">
                                        {step.icon}
                                    </div>
                                    <span className="text-sm text-white/60 group-hover/item:text-white/90 transition-colors">{step.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Questionnaire submitted success banner */}
            {isQuestionnaireSubmitted && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-4 px-6 py-4 rounded-2xl border border-[#10b981]/20"
                    style={{ background: "rgba(16,185,129,0.06)" }}>
                    <CheckCircle className="text-[#10b981] shrink-0" size={18} />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-white/80">Questionnaire submitted</p>
                        <p className="text-xs text-white/40">We&apos;ll review your answers and align on next steps.</p>
                    </div>
                    <button onClick={onQuestionnaireClick}
                        className="px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-[#11B8EA]/30 text-[#11B8EA] hover:bg-[#11B8EA]/10 transition-all">
                        View
                    </button>
                </motion.div>
            )}

            {/* Bridge 3 — Philosophy cards */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="grid grid-cols-2 gap-4">
                <div className="relative rounded-2xl p-8 overflow-hidden flex flex-col gap-6"
                    style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}>
                    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full fill-white/5 stroke-white/20 [mask-image:linear-gradient(white,transparent)]">
                        <defs><pattern id="grid-q1" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M0 32V.5H32" fill="none" /></pattern></defs>
                        <rect width="100%" height="100%" fill="url(#grid-q1)" />
                    </svg>
                    <div className="relative z-10 flex flex-col gap-4">
                        <p className="text-[9px] tracking-[0.4em] uppercase text-white/70 font-bold">On preparation</p>
                        <blockquote className="font-serif text-xl text-white leading-snug">
                            &ldquo;Most projects fail not in development — but in the 3 weeks before a single line of code is written.&rdquo;
                        </blockquote>
                    </div>
                </div>
                <div className="relative rounded-2xl p-8 overflow-hidden flex flex-col gap-6 border border-[#3B6AE8]/40"
                    style={{ background: "#0D1830" }}>
                    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full fill-[#3B6AE8]/5 stroke-[#3B6AE8]/20 [mask-image:linear-gradient(white,transparent)]">
                        <defs><pattern id="grid-q2" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M0 32V.5H32" fill="none" /></pattern></defs>
                        <rect width="100%" height="100%" fill="url(#grid-q2)" />
                    </svg>
                    <div className="relative z-10 flex flex-col gap-4">
                        <p className="text-[9px] tracking-[0.4em] uppercase font-bold" style={{ color: "#3B6AE8" }}>On process</p>
                        <blockquote className="font-serif text-xl text-white leading-snug">
                            &ldquo;This might look like overhead. But a sharpened axe cuts ten times deeper than brute force ever could.&rdquo;
                        </blockquote>
                    </div>
                </div>
            </motion.div>

            {/* Assessment */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="relative rounded-2xl border border-white/[0.06] p-8 overflow-hidden"
                style={{ background: "#04070F" }}>
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <p className="text-[9px] tracking-[0.45em] uppercase text-white/25 font-bold mb-1">Project Assessment</p>
                        <h3 className="font-serif text-2xl text-white/85">Build Complexity Profile</h3>
                    </div>
                </div>
                <div className="flex flex-col gap-5">
                    {complexityRows.map((row, i) => {
                        const barColor = row.pct >= 75 ? "#11B8EA" : row.pct >= 45 ? "#3B6AE8" : "rgba(255,255,255,0.18)";
                        return (
                            <div key={row.label} className="flex items-center gap-4">
                                <p className="text-white/40 text-xs w-44 shrink-0 tracking-wide">{row.label}</p>
                                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full"
                                        style={{ background: barColor }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${row.pct}%` }}
                                        transition={{ duration: 1.1, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                                    />
                                </div>
                                <span className="text-[10px] font-bold tracking-widest w-12 text-right tabular-nums" style={{ color: barColor }}>{row.pct}%</span>
                            </div>
                        );
                    })}
                </div>
            </motion.div>

            {/* ─── Unlock Gate ─── */}
            {!unlocked && (
                <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-5"
                    style={{ background: "#0D1526", border: "1px solid rgba(17,184,234,0.15)" }}>
                    <div>
                        <p className="text-[9px] font-black tracking-[0.4em] uppercase text-[#11B8EA] mb-3">checkpoint</p>
                        <h3 className="font-serif text-3xl text-white leading-tight mb-2">done reading?</h3>
                        <p className="text-sm text-white/40 max-w-xs leading-relaxed">
                            see exactly how we proceed throughout the project.
                        </p>
                    </div>
                    <button
                        onClick={onUnlock}
                        className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-85 transition-opacity"
                        style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}
                    >
                        unlock the process <ArrowRight size={15} />
                    </button>
                </div>
            )}


            {/* ─── Payment Gate — only legacy gate for phase 6; 3/4 live in their tabs ─── */}
            {deal.totalPrice && [6].includes(deal.phase || 0) && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <PaymentGate
                        token={deal.token}
                        paymentPhase={deal.phase as 3 | 4 | 6}
                        totalPrice={deal.totalPrice}
                        payments={deal.payments}
                        label={
                            deal.phase === 3 ? "Advance payment to initiate the build" :
                            deal.phase === 4 ? "Milestone payment — mid-project checkpoint" :
                            "Final payment — project complete, deployment ready"
                        }
                        description={
                            deal.phase === 3 ? "Once received, your project workspace fully activates and the build begins." :
                            deal.phase === 4 ? "Confirms the direction is right. Unlocks the final delivery sprint." :
                            "Pay to receive full handover package, credentials, and live deployment."
                        }
                    />
                </motion.div>
            )}

        </div>
    );
}

// ─── SwipeCard (base) ─────────────────────────────────────────────────────────

function SwipeCard({
    cardId, stackPos, totalCards, onSwiped, children, glowA, glowB, disableDrag,
}: {
    cardId: string; stackPos: number; totalCards: number;
    onSwiped: (id: string) => void;
    children: React.ReactNode;
    glowA: string; glowB: string;
    disableDrag?: boolean;
}) {
    const isTopCard = stackPos === totalCards - 1;
    const depth = totalCards - 1 - stackPos;

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-320, 0, 320], [-18, 0, 18]);
    const yLift = useTransform(x, [-320, -160, 0, 160, 320], [-70, -20, 0, -20, -70]);

    const handleDragEnd = (_e: unknown, info: { offset: { x: number } }) => {
        if (Math.abs(info.offset.x) > 90) {
            onSwiped(cardId);
        } else {
            x.set(0);
        }
    };

    const scatterX = !isTopCard ? (depth % 2 === 0 ? depth * 10 : -(depth * 10)) : 0;
    const scatterRot = !isTopCard ? (depth % 2 === 0 ? depth * 3 : -(depth * 3)) : 0;

    return (
        <motion.div
            drag={isTopCard && !disableDrag ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.55}
            style={{
                x: isTopCard ? x : scatterX,
                rotate: isTopCard ? rotate : scatterRot,
                y: isTopCard ? yLift : depth * 8,
                position: "absolute",
                width: "100%",
                height: "520px",
                borderRadius: "1.75rem",
                overflow: "hidden",
                cursor: isTopCard ? "grab" : "default",
                zIndex: stackPos,
                willChange: "transform",
            }}
            animate={{
                scale: isTopCard ? 1 : 1 - depth * 0.035,
                opacity: depth > 4 ? 0 : 1 - depth * 0.12,
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            exit={{ x: x.get() > 0 ? 520 : -520, y: -160, opacity: 0, rotate: x.get() > 0 ? 20 : -20 }}
            onDragEnd={handleDragEnd}
        >
            {/* Solid background — no backdropFilter */}
            <div className="absolute inset-0" style={{ background: "rgba(6,10,20,0.98)" }} />
            {/* Border */}
            <div className="absolute inset-0 rounded-[1.75rem]" style={{ border: "1px solid rgba(255,255,255,0.08)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }} />
            {/* Glow blobs only on visible top cards */}
            {depth < 2 && <>
                <div className="absolute -top-20 -left-20 w-[55%] h-[60%] rounded-full pointer-events-none"
                    style={{ background: glowA, filter: "blur(60px)", opacity: 0.18 }} />
                <div className="absolute -bottom-20 -right-20 w-[55%] h-[60%] rounded-full pointer-events-none"
                    style={{ background: glowB, filter: "blur(60px)", opacity: 0.14 }} />
            </>}
            {/* Glass shine top */}
            <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />

            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </motion.div>
    );
}

// ─── IntroBCard (calibratable climb curve) ────────────────────────────────────

const CLIMB_PHASES = ["DISCOVER","BLUEPRINT","IGNITION","BUILD","DELIVER","HANDOVER","ORBIT"];

function IntroBCard({ stackPos, totalCards, onSwiped }: { stackPos: number; totalCards: number; onSwiped: (id: string) => void }) {
    const [pts, setPts] = useState([
        { x: 5,     y: 65.9  },
        { x: 37.6,  y: 34.3  },
        { x: 79.9,  y: 17.1  },
        { x: 123.9, y: 18    },
        { x: 167.1, y: 27.7  },
        { x: 211.9, y: 19.3  },
        { x: 242.8, y: -17.1 },
    ]);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const LABEL_PTS = [
        { x: 5,     y: 37.1  },
        { x: 61.2,  y: 57.7  },
        { x: 82.4,  y: -3.2  },
        { x: 125.5, y: 49.4  },
        { x: 167.9, y: 5.1   },
        { x: 233.9, y: 44.5  },
        { x: 242.8, y: -30.1 },
    ];
    const svgRef = useRef<SVGSVGElement>(null);
    const rn = (n: number) => Math.round(n * 10) / 10;

    const catmullPath = (points: { x: number; y: number }[]) => {
        const d = [`M ${rn(points[0].x)},${rn(points[0].y)}`];
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(i - 1, 0)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(i + 2, points.length - 1)];
            d.push(`C ${rn(p1.x + (p2.x - p0.x) / 6)},${rn(p1.y + (p2.y - p0.y) / 6)} ${rn(p2.x - (p3.x - p1.x) / 6)},${rn(p2.y - (p3.y - p1.y) / 6)} ${rn(p2.x)},${rn(p2.y)}`);
        }
        return d.join(" ");
    };

    const onSvgUp = () => setDragIdx(null);

    const onSvgMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
        if (dragIdx === null || !svgRef.current) return;
        e.stopPropagation();
        const rect = svgRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const nx = Math.max(5, Math.min(263, ((clientX - rect.left) / rect.width) * 268));
        const ny = Math.max(-32, Math.min(100, -35 + ((clientY - rect.top) / rect.height) * 140));
        setPts(prev => prev.map((p, i) => i === dragIdx ? { x: rn(nx), y: rn(ny) } : p));
    };

    const path = catmullPath(pts);

    return (
        <SwipeCard cardId="intro-b" stackPos={stackPos} totalCards={totalCards} onSwiped={onSwiped} glowA="#3B6AE8" glowB="#11B8EA" disableDrag={dragIdx !== null}>
            <div className="flex flex-col h-full p-6 gap-3">
                <p className="text-[9px] font-black tracking-[0.4em] uppercase text-[#11B8EA]">the structure</p>
                <h2 className="font-serif text-5xl text-white leading-tight">
                    <span style={{ color: "#11B8EA" }}>Phase</span><br />
                    <em>architect.</em>
                </h2>
                <p className="text-sm text-white/50 leading-relaxed">from the moment you were elected —<br />a system activated. what you're looking at is exactly how we get to the finish line.</p>

                <div className="flex-1 flex flex-col gap-2">
                    <svg
                        ref={svgRef}
                        viewBox="0 -35 268 148"
                        className="w-full h-full"
                        style={{ overflow: "visible", touchAction: "none" }}
                        onMouseMove={onSvgMove}
                        onMouseUp={onSvgUp}
                        onMouseLeave={onSvgUp}
                        onTouchMove={onSvgMove}
                        onTouchEnd={onSvgUp}
                    >
                        <defs>
                            <linearGradient id="climbGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#3B6AE8" stopOpacity="0.5"/>
                                <stop offset="100%" stopColor="#11B8EA" stopOpacity="1"/>
                            </linearGradient>
                        </defs>
                        <g transform="translate(10, 28)">
                        <path d={path} fill="none" stroke="#11B8EA" strokeWidth="5" strokeLinecap="round" opacity="0.07"/>
                        <path d={path} fill="none" stroke="url(#climbGrad2)" strokeWidth="1.5" strokeLinecap="round"/>
                        {/* Dots */}
                        {pts.map((p, i) => {
                            const isFirst = i === 0; const isLast = i === 6;
                            return (
                                <g key={i}>
                                    {isFirst && <circle cx={p.x} cy={p.y} r={8} fill="#11B8EA" opacity={0.12}/>}
                                    <circle cx={p.x} cy={p.y} r={isFirst || isLast ? 5 : 4}
                                        fill={isFirst || isLast ? "#11B8EA" : "#3B6AE8"}
                                        stroke="rgba(255,255,255,0.25)" strokeWidth="1"
                                        opacity={isFirst || isLast ? 1 : 0.7}/>
                                </g>
                            );
                        })}
                        {/* Static labels — locked positions */}
                        {LABEL_PTS.map((lp, i) => {
                            const isFirst = i === 0; const isLast = i === 6;
                            return (
                                <text key={`lbl-${i}`} x={lp.x} y={lp.y} textAnchor="middle" style={{
                                    fontSize: "8.5px",
                                    fill: isFirst ? "rgba(17,184,234,0.95)" : isLast ? "rgba(17,184,234,0.8)" : "rgba(255,255,255,0.35)",
                                    fontFamily: "Inter,sans-serif", fontWeight: 700,
                                    letterSpacing: "0.04em", pointerEvents: "none",
                                }}>{CLIMB_PHASES[i]}</text>
                            );
                        })}
                        </g>
                    </svg>
                </div>
            </div>
        </SwipeCard>
    );
}

// ─── ProcessTab ───────────────────────────────────────────────────────────────

function ProcessTab({ deal, onQuestionnaireUnlock }: { deal: Deal; onQuestionnaireUnlock: () => void }) {
    const currentPhaseIdx = deal.phase || 0;

    // 13 cards: 4 intro + 7 phases + 2 outro
    // Array is bottom→top, last element = top card (seen first)
    const ALL_CARDS = [
        "outro-b", "outro-a",
        "phase-6", "phase-5", "phase-4", "phase-3", "phase-2", "phase-1", "phase-0",
        "intro-b", "intro-a", "intro-hype", "intro-0",
    ];
    const [cards, setCards] = useState<string[]>(ALL_CARDS);
    const remaining = cards.length;

    const handleSwiped = (id: string) => {
        setTimeout(() => setCards(prev => prev.filter(c => c !== id)), 280);
    };

    return (
        <div className="flex flex-col items-center" style={{ minHeight: "660px" }}>

            {/* Big heading */}
            <div className="w-full text-center mb-6">
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "3.5rem", letterSpacing: "0.15em", lineHeight: 1 }}>
                    <span className="text-white/90">JUST TRUST THE </span>
                    <span className="bg-gradient-to-r from-[#11B8EA] to-[#3B6AE8] bg-clip-text text-transparent" style={{ fontStyle: "italic" }}>PROCESS</span>
                </h1>
            </div>

            <div className="relative w-full max-w-[380px]" style={{ height: "520px" }}>
                <AnimatePresence>
                    {cards.map((cardId, stackPos) => {
                        if (cardId === "intro-0") {
                            return (
                                <SwipeCard key={cardId} cardId={cardId} stackPos={stackPos} totalCards={cards.length} onSwiped={handleSwiped} glowA="#11B8EA" glowB="#10b981">
                                    <div className="flex flex-col justify-between h-full p-8">
                                        <div>
                                            <h2 className="font-serif text-5xl text-white leading-tight mb-1">Hi,</h2>
                                            <h2 className="font-serif text-4xl text-white leading-tight mb-8"><em>New to here?</em></h2>
                                            <div className="flex flex-col gap-4">
                                                {[
                                                    { emoji: "👋", line: "don't worry," },
                                                    { emoji: "🤝", line: "i am gonna grab your hands" },
                                                    { emoji: "🗺️", line: "and walk you throughout the project" },
                                                    { emoji: "⚡", line: "with a new genz approach" },
                                                    { emoji: "🎯", line: "to deal tasks in a fun loving way." },
                                                ].map((item, i) => (
                                                    <div key={i} className="flex items-center gap-3">
                                                        <span className="text-lg">{item.emoji}</span>
                                                        <p className="text-sm text-white/60">{item.line}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] text-white/25 uppercase tracking-widest">Swipe to explore →</p>
                                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
                                                <ArrowRight size={14} className="text-white/30" />
                                            </div>
                                        </div>
                                    </div>
                                </SwipeCard>
                            );
                        }
                        if (cardId === "intro-hype") {
                            return (
                                <SwipeCard key={cardId} cardId={cardId} stackPos={stackPos} totalCards={cards.length} onSwiped={handleSwiped} glowA="#11B8EA" glowB="#f59e0b">
                                    <div className="flex flex-col justify-between h-full p-8">
                                        <div>
                                            {/* Headline */}
                                            <div className="mb-8">
                                                <p className="text-[9px] font-black tracking-[0.4em] uppercase text-[#f59e0b] mb-3">— a note</p>
                                                <h2 className="font-serif leading-[1.1] text-white" style={{ fontSize: "2.8rem" }}>
                                                    something<br />to say <em className="text-white">before</em><br /><em>we move.</em>
                                                </h2>
                                            </div>

                                            {/* Quote */}
                                            <div className="border-l-2 border-[#11B8EA]/40 pl-4 mb-6">
                                                <p className="text-sm text-white/50 leading-relaxed italic">
                                                    "most clients and business owners say they've never seen a project run like this."
                                                </p>
                                            </div>

                                            {/* Response */}
                                            <p className="text-sm font-semibold leading-relaxed" style={{ color: "#f59e0b" }}>
                                                good. you're not just a client.<br />you're an early adopter.
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] text-white/25 uppercase tracking-widest">Swipe to explore →</p>
                                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
                                                <ArrowRight size={14} className="text-white/30" />
                                            </div>
                                        </div>
                                    </div>
                                </SwipeCard>
                            );
                        }
                        if (cardId === "intro-a") {
                            return (
                                <SwipeCard key={cardId} cardId={cardId} stackPos={stackPos} totalCards={cards.length} onSwiped={handleSwiped} glowA="#11B8EA" glowB="#3B6AE8">
                                    <div className="flex flex-col justify-between h-full p-6">
                                        <div>
                                            <h2 className="font-serif text-3xl text-white leading-tight mb-5">
                                                why most projects <em>break.</em>
                                            </h2>
                                            <p className="text-sm text-white/50 leading-relaxed mb-1">
                                                most projects fail not because of bad execution (maybe) — but because nobody had a clear structure going in.
                                            </p>
                                            <p className="text-sm text-white/50 leading-relaxed mb-5">
                                                we do things differently here.
                                            </p>

                                            {/* Comparison — two-panel battle */}
                                            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                                                {/* Header row */}
                                                <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                                    <div className="flex-1 px-3 py-2.5" style={{ background: "rgba(34,197,94,0.04)", borderRight: "1px solid rgba(17,184,234,0.15)" }}>
                                                        <p className="text-[9px] font-black tracking-[0.25em] uppercase text-white/30 text-center">Traditional</p>
                                                    </div>
                                                    <div className="flex-1 px-3 py-2.5" style={{ background: "rgba(17,184,234,0.05)" }}>
                                                        <p className="text-[9px] font-black tracking-[0.25em] uppercase text-[#11B8EA]/70 text-center">GenZ (SYNAPSIS)</p>
                                                    </div>
                                                </div>
                                                {/* Data rows — single map keeps left+right aligned */}
                                                {[
                                                    ["Miscommunication & Backlash", "Full Transparency + Data Trail"],
                                                    ["Clumsy, Unorganised Process", "Extreme Structure & Efficiency"],
                                                    ["Client Left in the Dark", "Live Phase Tracking System"],
                                                    ["Endless Free Revisions", "Structured Change Orders"],
                                                ].map(([left, right], i) => (
                                                    <div key={i} className="flex items-stretch" style={{ borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                                        <div className="flex-1 flex items-start gap-2 px-3 py-2.5" style={{ background: "rgba(34,197,94,0.04)", borderRight: "1px solid rgba(17,184,234,0.15)" }}>
                                                            <span className="text-[9px] text-red-400/40 shrink-0 mt-0.5">✕</span>
                                                            <span className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.38)" }}>{left}</span>
                                                        </div>
                                                        <div className="flex-1 flex items-start gap-2 px-3 py-2.5" style={{ background: "rgba(17,184,234,0.05)" }}>
                                                            <span className="text-[9px] text-[#11B8EA]/60 shrink-0 mt-0.5">✓</span>
                                                            <span className="text-[10px] text-white/80 leading-snug font-medium">{right}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[9px] text-white/15 tracking-[0.15em] mt-3 text-center">this system prevents everything</p>
                                        </div>
                                    </div>
                                </SwipeCard>
                            );
                        }
                        if (cardId === "intro-b") {
                            return <IntroBCard key={cardId} stackPos={stackPos} totalCards={cards.length} onSwiped={handleSwiped} />;
                        }
                        if (cardId === "outro-a") {
                            return (
                                <SwipeCard key={cardId} cardId={cardId} stackPos={stackPos} totalCards={cards.length} onSwiped={handleSwiped} glowA="#10b981" glowB="#11B8EA">
                                    <div className="flex flex-col justify-between h-full p-8">
                                        <div>
                                            <div className="w-10 h-10 rounded-full bg-[#10b981]/15 border border-[#10b981]/20 flex items-center justify-center mb-6">
                                                <CheckCircle size={18} className="text-[#10b981]" />
                                            </div>
                                            <h2 className="font-serif text-4xl text-white leading-tight mb-5">
                                                That&apos;s the full<br /><em>system map.</em>
                                            </h2>
                                            <p className="text-sm text-white/50 leading-relaxed max-w-xs">
                                                You now have the complete picture. Fill the questionnaire to kick off Phase 1.
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-white/25 uppercase tracking-widest">One more card →</p>
                                    </div>
                                </SwipeCard>
                            );
                        }
                        if (cardId === "outro-b") {
                            return (
                                <SwipeCard key={cardId} cardId={cardId} stackPos={stackPos} totalCards={cards.length} onSwiped={handleSwiped} glowA="#f59e0b" glowB="#3B6AE8">
                                    <div className="flex flex-col justify-between h-full p-8">
                                        <div>
                                            <p className="text-[9px] font-black tracking-[0.4em] uppercase text-[#f59e0b] mb-6">checkpoint</p>
                                            <h2 className="font-serif text-4xl text-white leading-tight mb-4">
                                                you&apos;ve seen<br /><em>the full map.</em>
                                            </h2>
                                            <p className="text-sm text-white/45 leading-relaxed max-w-xs">
                                                now it&apos;s time to fill the questionnaire — the faster you do it, the faster we start building.
                                            </p>
                                        </div>
                                        <button
                                            onClick={onQuestionnaireUnlock}
                                            className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl text-sm font-semibold text-white hover:opacity-85 transition-opacity"
                                            style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}
                                        >
                                            <span>unlock questionnaire</span>
                                            <ArrowRight size={15} />
                                        </button>
                                    </div>
                                </SwipeCard>
                            );
                        }
                        // Phase cards
                        const phaseIdx = parseInt(cardId.replace("phase-", ""));
                        const phase = PHASES[phaseIdx];
                        const isCurrentPhase = phaseIdx === currentPhaseIdx;
                        const isDone = phaseIdx < currentPhaseIdx;

                        // Phase 1 special orientation card
                        if (phaseIdx === 0) {
                            return (
                                <SwipeCard key={cardId} cardId={cardId} stackPos={stackPos} totalCards={cards.length} onSwiped={handleSwiped} glowA={phase.glowA} glowB={phase.glowB}>
                                    <div className="flex flex-col h-full p-8 gap-5">
                                        <div className="flex items-start justify-between">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black text-white"
                                                style={{ background: phase.glowA, border: `1px solid ${phase.glowA}50` }}>
                                                {`0${phaseIdx + 1}`}
                                            </div>
                                            <div className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase"
                                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                                                {deal.projectDays ? calcPhaseDurations(deal.projectDays)[0] : phase.duration}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] tracking-[0.4em] uppercase font-bold mb-2" style={{ color: phase.glowA + "99" }}>{phase.tag}</p>
                                            <h2 className="font-serif leading-tight text-white" style={{ fontSize: "2.4rem" }}>
                                                You are here!!
                                            </h2>
                                        </div>
                                        <div className="flex flex-col gap-5 flex-1">
                                            {[
                                                { emoji: "🤝", line: <>this is <span style={{ color: "#11B8EA" }}>phase 1</span> — we&apos;re getting to know each other.</> },
                                                { emoji: "🗺️", line: "currently we're getting a short peek of the phase architecture." },
                                                { emoji: "💬", line: "next up: a few key questions we'll work through together." },
                                                { emoji: "✨", line: "after that, a live chat opens — we'd love to hear from you." },
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-center gap-3">
                                                    <span className="text-xl shrink-0">{item.emoji}</span>
                                                    <p className="text-sm text-white/60">{item.line}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-white/20 uppercase tracking-widest">Swipe to continue →</p>
                                    </div>
                                </SwipeCard>
                            );
                        }

                        return (
                            <SwipeCard key={cardId} cardId={cardId} stackPos={stackPos} totalCards={cards.length} onSwiped={handleSwiped} glowA={phase.glowA} glowB={phase.glowB}>
                                <div className="flex flex-col h-full p-8 gap-5">
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black ${isCurrentPhase ? "text-white" : isDone ? "text-[#3B6AE8]" : "text-white/30"}`}
                                            style={{ background: isCurrentPhase ? phase.glowA : isDone ? "rgba(59,106,232,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${isCurrentPhase ? phase.glowA + "50" : "rgba(255,255,255,0.08)"}` }}>
                                            {isDone ? <CheckCircle size={14} /> : `0${phaseIdx + 1}`}
                                        </div>
                                        <div className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase"
                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                                            {deal.projectDays ? calcPhaseDurations(deal.projectDays)[phaseIdx] : phase.duration}
                                        </div>
                                    </div>
                                    {/* Phase tag + name */}
                                    <div>
                                        <p className="text-[9px] tracking-[0.4em] uppercase font-bold mb-2" style={{ color: phase.glowA + "99" }}>{phase.tag}</p>
                                        <h2 className="font-serif leading-tight" style={{ fontSize: "2.4rem", background: `linear-gradient(135deg, ${phase.glowA}, ${phase.glowB})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                            {phase.name}
                                        </h2>
                                    </div>
                                    {/* Description */}
                                    <p className="text-sm leading-relaxed text-white/45 flex-1">{phase.desc}</p>
                                    {/* You / Vark */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-4 rounded-2xl flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <p className="text-[8px] tracking-[0.35em] uppercase text-white/20 font-bold">You</p>
                                            <p className="text-xs text-white/50 leading-snug">{phase.you}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl flex flex-col gap-2" style={{ background: `${phase.glowA}08`, border: `1px solid ${phase.glowA}15` }}>
                                            <p className="text-[8px] tracking-[0.35em] uppercase font-bold" style={{ color: phase.glowA + "60" }}>Synapsis</p>
                                            <p className="text-xs text-white/50 leading-snug">{phase.us}</p>
                                        </div>
                                    </div>
                                </div>
                            </SwipeCard>
                        );
                    })}
                </AnimatePresence>
            </div>

            {cards.length === 0 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/20 text-xs tracking-widest uppercase mt-8">
                    All phases reviewed
                </motion.p>
            )}
        </div>
    );
}

const MIN_CHARS = 50;

const SECTIONS = [
    { id: "anchor", label: "SECTION A", qIndices: [0, 1, 2, 3] },
    { id: "logistics", label: "SECTION B", qIndices: [4, 5, 6, 7] },
    { id: "assets", label: "SECTION C", qIndices: [8] },
];

function QuestionnaireTab({ deal, onSubmit }: { deal: Deal; onSubmit: (answers: Record<string, string>) => Promise<void> }) {
    const QUES = (deal.customQuestions?.length === 9) ? deal.customQuestions : QUESTIONS;


    const [answers, setAnswers] = useState<Record<string, string>>(() => {
        if (deal.questionnaire) return deal.questionnaire;
        const init: Record<string, string> = {};
        QUES.forEach((_, i) => { init[`q${i}`] = ""; });
        return init;
    });

    const [current, setCurrent] = useState(0);
    const [direction, setDirection] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(!!deal.questionnaire);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const activeSection = SECTIONS.findIndex(s => s.qIndices.includes(current));
    const currentAnswer = answers[`q${current}`] || "";
    const charCount = currentAnswer.trim().length;
    const isLastQ = current === QUES.length - 1;
    
    // Custom advance logic for Budget (index 4) and Checklist (index 8)
    const canAdvance = current === 4 ? !!currentAnswer 
                     : current === 8 ? true // Asset checklist can be empty
                     : charCount >= MIN_CHARS;

    useEffect(() => {
        textareaRef.current?.focus();
    }, [current]);


    const goNext = () => {
        if (!canAdvance) return;
        setDirection(1);
        setCurrent(c => Math.min(QUES.length - 1, c + 1));
    };

    const goPrev = () => {
        if (current === 0) return;
        setDirection(-1);
        setCurrent(c => Math.max(0, c - 1));
    };

    const handleSectionClick = (idx: number) => {
        // Unlock logic: only allow jumping if current Q in current section is done
        // or if moving back
        if (idx < activeSection || (idx === activeSection + 1 && canAdvance) || idx === activeSection) {
            setDirection(idx > activeSection ? 1 : -1);
            setCurrent(SECTIONS[idx].qIndices[0]);
        }
    };

    const handleSubmit = async () => {
        if (!canAdvance || submitting) return;
        setSubmitting(true);
        await onSubmit(answers);
        setSubmitted(true);
        setSubmitting(false);
    };

    if (submitted) {
        return (
            <div className="flex flex-col gap-5">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-3xl bg-white p-12 overflow-hidden shadow-2xl border border-black/5">

                    <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#11B8EA]/10 via-transparent to-transparent pointer-events-none" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-[#0A0F1E] flex items-center justify-center text-[#11B8EA]">
                                <CheckCircle size={24} />
                            </div>
                            <span className="text-[10px] tracking-[0.5em] uppercase text-black/40 font-black">Phase 01 · Complete</span>
                        </div>
                        <h1 className="font-serif text-6xl text-[#0A0F1E] leading-tight mb-4">Strategic data locked.</h1>
                        <p className="text-xl text-black/50 leading-relaxed max-w-md">We&apos;re processing your requirements to generate your system blueprint. Check back in 12h.</p>
                    </div>
                </motion.div>
                <div className="flex flex-col gap-4 mt-2">
                    {QUES.map((q, i) => (
                        <div key={i} className="p-7 rounded-3xl bg-white/5 border border-white/10">
                            <div className="flex gap-5">
                                <span className="text-white/15 font-serif text-3xl leading-none shrink-0">0{i + 1}</span>
                                <div className="flex-1">
                                    <p className="text-white/40 text-xs uppercase tracking-[0.3em] font-bold mb-3">{q}</p>
                                    <p className="text-white/70 text-sm leading-relaxed italic">{answers[`q${i}`]}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0">
            {/* Pill Tab Switcher */}
            <div className="flex justify-center mb-12">
                <div className="flex items-center p-1 bg-white/[0.03] border border-white/5 rounded-2xl relative">
                    {SECTIONS.map((sec, i) => {
                        const isActive = activeSection === i;
                        const isDone = SECTIONS[i].qIndices.every(idx => (answers[`q${idx}`] || "").trim().length >= MIN_CHARS);
                        const isLocked = i > activeSection && !canAdvance;

                        return (
                            <button
                                key={sec.id}
                                onClick={() => handleSectionClick(i)}
                                disabled={isLocked}
                                className={`relative px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-2 ${
                                    isActive ? "text-[#0A0F1E]" : (isLocked ? "text-white/10" : "text-white/40 hover:text-white/70")
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="active-pill"
                                        className="absolute inset-0 bg-[#11B8EA] rounded-xl shadow-[0_0_20px_rgba(17,184,234,0.3)]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10">{sec.label}</span>
                                {isDone && !isActive && <CheckCircle size={10} className="relative z-10 text-[#11B8EA]" />}
                                {isLocked && <Lock size={10} className="relative z-10 opacity-20" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Header bar */}
            <div className="flex items-center justify-between mb-8 opacity-40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#11B8EA]">
                        <FileQuestion size={18} />
                    </div>
                    <span className="text-[10px] tracking-[0.4em] uppercase text-white/30 font-bold">
                        Phase 01 · {SECTIONS[activeSection].label}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {SECTIONS[activeSection].qIndices.map((qIdx) => (
                        <div key={qIdx} className={`h-1 rounded-full transition-all duration-500 ${
                            qIdx < current ? "w-6 bg-[#11B8EA]" :
                            qIdx === current ? "w-8 bg-[#11B8EA]" :
                            "w-3 bg-white/15"
                        }`} />
                    ))}
                </div>
            </div>


            {/* Question card */}
            <div className="relative overflow-hidden" style={{ minHeight: 420 }}>
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={current}
                        custom={direction}
                        initial={{ opacity: 0, x: direction * 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -60 }}
                        transition={{ duration: 0.35, ease: [0.32, 0, 0.67, 0] }}
                        className="flex flex-col gap-8"
                    >
                        {/* Question number + text */}
                        <div className="flex gap-6 items-start">
                            <span className="font-serif text-[5rem] leading-none text-white/[0.06] select-none shrink-0 mt-1">
                                {String(current + 1).padStart(2, "0")}
                            </span>
                            <h2 className="font-serif text-3xl text-white leading-snug pt-3">
                                {QUES[current]}
                            </h2>
                        </div>

                        {/* Special Question Rendering: Budget Selection (Q4) */}
                        {current === 4 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { label: "₹50k - ₹1L", value: "50k-1L" },
                                    { label: "₹1L - ₹3L", value: "1L-3L" },
                                    { label: "₹3L+", value: "3L+" },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setAnswers(prev => ({ ...prev, [`q${current}`]: opt.label }))}
                                        className={`p-6 rounded-2xl border transition-all text-center flex flex-col gap-2 ${
                                            currentAnswer === opt.label 
                                                ? "bg-[#11B8EA]/10 border-[#11B8EA] text-white" 
                                                : "bg-white/[0.03] border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
                                        }`}
                                    >
                                        <span className="text-xl font-bold">{opt.label}</span>
                                        <span className="text-[9px] uppercase tracking-widest opacity-50">Allocation</span>
                                    </button>
                                ))}
                            </div>
                        ) : current === 8 ? (
                            /* Special Question Rendering: Asset Checklist (Q8) */
                            <div className="flex flex-col gap-4">
                                {[
                                    { id: "logos", label: "High-resolution Logos", desc: "Vector, SVG, or high-res PNG (No JPEGs)" },
                                    { id: "guidelines", label: "Brand Guidelines", desc: "Hex color codes & font files" },
                                    { id: "copy", label: "Final Written Text", desc: "Ready for all pages (No Lorem Ipsum)" },
                                ].map((item) => {
                                    const isChecked = currentAnswer.includes(item.id);
                                    const handleCheck = () => {
                                        const parts = currentAnswer ? currentAnswer.split(",") : [];
                                        const next = isChecked ? parts.filter(p => p !== item.id) : [...parts, item.id];
                                        setAnswers(prev => ({ ...prev, [`q${current}`]: next.join(",") }));
                                    };
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={handleCheck}
                                            className={`flex items-center gap-6 p-6 rounded-2xl border transition-all text-left ${
                                                isChecked 
                                                    ? "bg-[#11B8EA]/10 border-[#11B8EA] text-white" 
                                                    : "bg-white/[0.03] border-white/10 text-white/40 hover:border-white/20"
                                            }`}
                                        >
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                isChecked ? "bg-[#11B8EA] border-[#11B8EA]" : "border-white/20"
                                            }`}>
                                                {isChecked && <CheckCircle size={14} className="text-[#0A0F1E]" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold tracking-tight mb-0.5">{item.label}</p>
                                                <p className="text-[10px] opacity-40 uppercase tracking-widest">{item.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Default Textarea Rendering */
                            <textarea
                                ref={textareaRef}
                                rows={6}
                                placeholder="Write your answer here — the more specific, the better."
                                value={currentAnswer}
                                onChange={e => setAnswers(prev => ({ ...prev, [`q${current}`]: e.target.value }))}
                                className="w-full bg-white/[0.03] border border-white/10 p-6 rounded-2xl text-white outline-none focus:border-[#11B8EA]/30 focus:bg-white/[0.05] transition-all text-sm placeholder:text-white/20 resize-none leading-relaxed"
                            />
                        )}

                        {/* Char count + nav */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {current !== 4 && current !== 8 && (
                                    <>
                                        <div className="h-1 w-32 rounded-full bg-white/10 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${Math.min(100, (charCount / MIN_CHARS) * 100)}%`,
                                                    background: canAdvance ? "#11B8EA" : "#3B6AE8",
                                                }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-white/25 font-mono">
                                            {canAdvance ? "ready" : `${MIN_CHARS - charCount} more chars`}
                                        </span>
                                    </>
                                )}
                            </div>


                            <div className="flex items-center gap-3">
                                {current > 0 && (
                                    <button
                                        onClick={goPrev}
                                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/40 border border-white/10 hover:border-white/20 hover:text-white/60 transition-all uppercase tracking-widest"
                                    >
                                        Back
                                    </button>
                                )}
                                {isLastQ ? (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSubmit}
                                        disabled={!canAdvance || submitting}
                                        className="px-8 py-3 rounded-xl bg-[#11B8EA] text-[#0A0F1E] font-black text-xs uppercase tracking-[0.3em] disabled:opacity-20 shadow-[0_12px_28px_rgba(17,184,234,0.25)] transition-all"
                                    >
                                        {submitting ? "Submitting…" : "Submit →"}
                                    </motion.button>
                                ) : (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={goNext}
                                        disabled={!canAdvance}
                                        className="px-8 py-3 rounded-xl bg-[#11B8EA] text-[#0A0F1E] font-black text-xs uppercase tracking-[0.3em] disabled:opacity-20 shadow-[0_12px_28px_rgba(17,184,234,0.25)] transition-all"
                                    >
                                        Next →
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Question counter */}
            <p className="text-center text-[10px] uppercase tracking-[0.4em] text-white/15 mt-10 font-bold">
                {current + 1} of {QUES.length}
            </p>
        </div>
    );
}

function ChatTab({ deal, onSend }: { deal: Deal; onSend: (text: string, imageUrl?: string) => Promise<void> }) {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const messages = deal.messages || [];

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        await onSend(text);
        setText("");
        setSending(false);
    };

    return (
        <div className="flex flex-col h-[750px] gap-6">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="relative rounded-[2.5rem] bg-white p-10 overflow-hidden shadow-2xl border border-black/5">
                <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#11B8EA]/10 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-[#0A0F1E] flex items-center justify-center text-[#11B8EA]">
                            <MessageSquare size={24} />
                        </div>
                        <span className="text-[10px] tracking-[0.5em] uppercase text-black/40 font-black">Encrypted · Direct Line</span>
                    </div>
                    <h1 className="font-serif text-6xl text-[#0A0F1E] leading-tight mb-2">Technical Liaison</h1>
                    <p className="text-xl text-black/50">Direct secure channel to Dhananjay. Feedback cycles & architectural q&apos;s.</p>
                </div>
            </motion.div>

            <div className="flex-1 bg-[#04070F] rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-6 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 text-center gap-4">
                            <MessageSquare size={48} />
                            <p className="text-sm tracking-widest uppercase">No transmission history found</p>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                key={i}
                                className={`flex ${msg.from === "client" ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[75%] p-6 rounded-3xl ${msg.from === "client"
                                    ? "bg-[#11B8EA] text-[#0A0F1E] font-medium shadow-[0_10px_20px_rgba(17,184,234,0.2)]"
                                    : "bg-white/[0.03] border border-white/10 text-white/90"
                                    }`}>
                                    <p className="text-sm leading-relaxed">{msg.text}</p>
                                    <p className={`text-[8px] uppercase tracking-widest mt-3 opacity-40 font-bold ${msg.from === "client" ? "text-right" : "text-left"}`}>
                                        {msg.time}
                                    </p>
                                </div>
                            </motion.div>
                        ))
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="p-8 bg-black/40 border-t border-white/5">
                    <div className="relative bg-white/5 rounded-2xl border border-white/10 focus-within:border-[#11B8EA]/40 transition-all overflow-hidden p-1">
                        <textarea
                            rows={1}
                            placeholder="Message Dhananjay..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                            className="w-full bg-transparent p-4 text-white outline-none resize-none text-sm placeholder:text-white/20"
                        />
                        <div className="flex items-center justify-between px-4 pb-3">
                            <div className="flex items-center gap-2 opacity-30">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#11B8EA]" />
                                <span className="text-[8px] uppercase tracking-widest font-bold text-white">Secure Link Active</span>
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={!text.trim() || sending}
                                className="w-10 h-10 rounded-xl bg-[#11B8EA] text-[#0A0F1E] flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-20"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Workspace ──────────────────────────────────────────────────────────

function ClientPhase1Workspace({ deal, onStatusUpdate }: { deal: Deal, onStatusUpdate: (d: Deal) => void }) {
    const phase = deal.phase ?? 1;
    const blueprintAvailable = phase >= 2 && !!deal.phaseData?.phase2?.blueprint;
    const ignitionAvailable = phase >= 3;
    const buildAvailable = phase >= 4;
    const deliverAvailable = phase >= 5;
    const handoverAvailable = phase >= 6;
    const orbitAvailable = phase >= 7;
    const [activeTab, setActiveTab] = useState<"overview" | "process" | "questionnaire" | "chat" | "blueprint" | "ignition" | "build" | "deliver" | "handover" | "orbit">(
        orbitAvailable ? "orbit" : handoverAvailable ? "handover" : deliverAvailable ? "deliver" : buildAvailable ? "build" : ignitionAvailable ? "ignition" : blueprintAvailable ? "blueprint" : "overview"
    );
    const { token } = useParams();

    // Auto-jump on phase advancement (first arrival into 2/3/4/5/6/7)
    const lastPhaseRef = useRef(phase);
    useEffect(() => {
        if (lastPhaseRef.current < 7 && phase >= 7) {
            setActiveTab("orbit");
        } else if (lastPhaseRef.current < 6 && phase >= 6) {
            setActiveTab("handover");
        } else if (lastPhaseRef.current < 5 && phase >= 5) {
            setActiveTab("deliver");
        } else if (lastPhaseRef.current < 4 && phase >= 4) {
            setActiveTab("build");
        } else if (lastPhaseRef.current < 3 && phase >= 3) {
            setActiveTab("ignition");
        } else if (lastPhaseRef.current < 2 && phase >= 2 && blueprintAvailable) {
            setActiveTab("blueprint");
        }
        lastPhaseRef.current = phase;
    }, [phase, blueprintAvailable]);

    const TAB_ORDER = ["overview", "process", "questionnaire", "chat", "blueprint", "ignition", "build", "deliver", "handover", "orbit"];
    const canAccessTab = (tabId: string) => {
        if (tabId === "blueprint") return blueprintAvailable;
        if (tabId === "ignition") return ignitionAvailable;
        if (tabId === "build") return buildAvailable;
        if (tabId === "deliver") return deliverAvailable;
        if (tabId === "handover") return handoverAvailable;
        if (tabId === "orbit") return orbitAvailable;
        return TAB_ORDER.indexOf(tabId) <= TAB_ORDER.indexOf(activeTab);
    };

    const handleUnlock = () => {
        setActiveTab("process");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const handleQuestionnaireUnlock = () => {
        setActiveTab("questionnaire");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Data Polling
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/deals?token=${token}`);
                if (res.ok) {
                    const data = await res.json();
                    onStatusUpdate(data);
                }
            } catch (e) { console.error("Poll failed", e); }
        }, 10000);
        return () => clearInterval(interval);
    }, [token, onStatusUpdate]);

    const handleQuestionnaireSubmit = async (answers: Record<string, string>) => {
        try {
            const res = await fetch(`/api/deals/${token}/questionnaire`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers })
            });
            if (res.ok) {
                const updated = await res.json();
                onStatusUpdate(updated);
                setActiveTab("chat");
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        } catch (e) { console.error("Submit failed", e); }
    };

    const handleSendMessage = async (text: string) => {
        try {
            const res = await fetch(`/api/deals/${token}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });
            if (res.ok) {
                const updated = await res.json();
                onStatusUpdate(updated);
            }
        } catch (e) { console.error("Send failed", e); }
    };

    const tabs = [
        { id: "overview", label: "Overview", icon: <LayoutDashboard size={14} /> },
        { id: "process", label: "Process", icon: <Map size={14} /> },
        { id: "questionnaire", label: "Questionnaire", icon: <FileQuestion size={14} /> },
        { id: "chat", label: "Chat", icon: <MessageSquare size={14} /> },
        ...(blueprintAvailable ? [{ id: "blueprint", label: "Blueprint", icon: <Layers size={14} /> }] : []),
        ...(ignitionAvailable ? [{ id: "ignition", label: "Ignition", icon: <Rocket size={14} /> }] : []),
        ...(buildAvailable ? [{ id: "build", label: "Build", icon: <Hammer size={14} /> }] : []),
        ...(deliverAvailable ? [{ id: "deliver", label: "Deliver", icon: <Sparkles size={14} /> }] : []),
        ...(handoverAvailable ? [{ id: "handover", label: "Handover", icon: <Package size={14} /> }] : []),
        ...(orbitAvailable ? [{ id: "orbit", label: "Orbit", icon: <Sparkles size={14} /> }] : []),
    ];

    const questionnaireNotDone = !deal.questionnaire;
    const chatCount = (deal.messages || []).filter(m => m.from === "vark").length;
    const initials = (deal.name || "?").charAt(0).toUpperCase();

    return (
        <div className="min-h-screen bg-[#0A0F1E] text-white selection:bg-[#11B8EA]/30">

            {/* ── Sidebar ────────────────────────────────────────────────── */}
            <aside className="w-[260px] fixed left-0 top-0 h-screen z-50 flex flex-col bg-[#050A12] border-r border-white/[0.05]">

                {/* Brand */}
                <div className="px-7 pt-7 pb-5">
                    <p className="font-serif text-2xl text-white tracking-tight leading-none mb-0.5">Synapsis</p>
                    <p className="text-[9px] font-bold tracking-[0.35em] uppercase text-white/25">Client Portal</p>
                </div>

                {/* User Card */}
                <div className="px-4 mb-4">
                    <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#11B8EA] to-[#3B6AE8] flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-[#11B8EA]/20">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-white truncate">{deal.name}</p>
                            <p className="text-[10px] text-white/35 truncate">{deal.company || deal.need}</p>
                        </div>
                    </div>
                </div>

                {/* Phase Badge */}
                <div className="px-4 mb-2">
                    <div className="flex items-center gap-2 px-3 py-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#11B8EA] shrink-0" />
                        <p className="text-[9px] font-black tracking-[0.3em] uppercase text-[#11B8EA]">
                            Phase {phase} · {(PHASE_NAMES[phase] || "DISCOVER").toLowerCase()}
                        </p>
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-4 mb-3 h-px bg-white/[0.05]" />

                {/* Nav */}
                <nav className="flex-1 px-3 flex flex-col gap-0.5">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        const isLocked = !canAccessTab(tab.id);
                        const badge = tab.id === "questionnaire" && questionnaireNotDone ? "!" : tab.id === "chat" && chatCount > 0 ? String(chatCount) : null;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => !isLocked && setActiveTab(tab.id as any)}
                                disabled={isLocked}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150 relative ${
                                    isLocked
                                        ? "text-white/15 cursor-not-allowed"
                                        : isActive
                                            ? "bg-white/[0.08] text-white"
                                            : "text-white/35 hover:text-white/65 hover:bg-white/[0.03]"
                                }`}
                            >
                                {isActive && !isLocked && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#11B8EA]" />
                                )}
                                <span className={`shrink-0 ${isActive && !isLocked ? "text-[#11B8EA]" : ""}`}>{tab.icon}</span>
                                <span className="text-[11px] font-semibold flex-1">{tab.label}</span>
                                {isLocked
                                    ? <Lock size={10} className="text-white/15 shrink-0" />
                                    : badge && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${badge === "!" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-[#11B8EA]/20 text-[#11B8EA] border border-[#11B8EA]/30"}`}>
                                            {badge}
                                        </span>
                                    )
                                }
                            </button>
                        );
                    })}
                </nav>

                {/* Bottom */}
                <div className="px-7 py-5 border-t border-white/[0.05]">
                    <p className="text-[10px] text-white/25 leading-relaxed mb-4">Questions? Use the Chat tab or reach out directly.</p>
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                    >
                        <LogOut size={12} />
                        <span className="font-semibold">Switch Account</span>
                    </button>
                </div>
            </aside>

            {/* ── Main Content (natural page scroll) ──────────────────────── */}
            <div
                className="ml-[260px] min-h-screen"
                style={activeTab === "questionnaire" ? {
                    backgroundImage: "url('/quest-bg.jpg')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundAttachment: "fixed",
                } : {}}
            >
                <div className="max-w-4xl mx-auto px-10 py-10">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.22 }}
                        >
                            {activeTab === "overview" && <OverviewTab deal={deal} onQuestionnaireClick={() => setActiveTab("questionnaire")} onProcessClick={() => setActiveTab("process")} onUnlock={handleUnlock} unlocked={false} />}
                            {activeTab === "process" && <ProcessTab deal={deal} onQuestionnaireUnlock={handleQuestionnaireUnlock} />}
                            {activeTab === "questionnaire" && <QuestionnaireTab deal={deal} onSubmit={handleQuestionnaireSubmit} />}
                            {activeTab === "chat" && <ChatTab deal={deal} onSend={handleSendMessage} />}
                            {activeTab === "blueprint" && (
                                <BlueprintViewer
                                    deal={deal as any}
                                    onUpdated={(updated: any) => onStatusUpdate({ ...deal, ...updated })}
                                />
                            )}
                            {activeTab === "ignition" && (
                                <IgnitionView
                                    deal={deal as any}
                                    onUpdated={(updated: any) => onStatusUpdate({ ...deal, ...updated })}
                                />
                            )}
                            {activeTab === "build" && (
                                <BuildView
                                    deal={deal as any}
                                    onUpdated={(updated: any) => onStatusUpdate({ ...deal, ...updated })}
                                />
                            )}
                            {activeTab === "deliver" && (
                                <DeliverView
                                    deal={deal as any}
                                    onUpdated={(updated: any) => onStatusUpdate({ ...deal, ...updated })}
                                />
                            )}
                            {activeTab === "handover" && (
                                <HandoverView
                                    deal={deal as any}
                                    onUpdated={(updated: any) => onStatusUpdate({ ...deal, ...updated })}
                                />
                            )}
                            {activeTab === "orbit" && (
                                <OrbitView
                                    deal={deal as any}
                                    onUpdated={(updated: any) => onStatusUpdate({ ...deal, ...updated })}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Background Blobs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-0 left-[260px] w-[40%] h-[50%] bg-[#11B8EA]/3 blur-[120px] rounded-full" style={{ willChange: "transform" }} />
                <div className="absolute bottom-0 right-0 w-[35%] h-[40%] bg-[#3B6AE8]/4 blur-[100px] rounded-full" style={{ willChange: "transform" }} />
            </div>
        </div>
    );
}

// ─── Rejected Client View ────────────────────────────────────────────────────

const SHOWCASE_SERVICES = [
    { title: "AI & Automation", desc: "Agentic workflows, AI integrations, and automated systems that work while you sleep.", items: ["Custom AI agents", "Workflow automation", "LLM-powered tools", "Data pipelines"], color: "#11B8EA" },
    { title: "Full Stack Dev", desc: "Web apps, complex backends, payment integrations, and APIs — built fast, built to last.", items: ["Next.js / React apps", "Backend APIs", "Payment integrations", "Auth systems"], color: "#3B6AE8" },
    { title: "Digital Ecosystem", desc: "End-to-end system design, deployment, and infrastructure for businesses that want to scale.", items: ["System architecture", "Cloud deployment", "CI/CD pipelines", "Full documentation"], color: "#ffffff" },
];

const SHOWCASE_PROJECTS = [
    { name: "Kinora", status: "LIVE", desc: "Creative image-to-video generation platform. Built solo, multiple generation models, shipped to production." },
    { name: "JARVIS", status: "BUILDING", desc: "AI life coach that studies you for 15 days, then builds a personalized optimization engine." },
    { name: "Radhika", status: "ARCHIVED", desc: "8-agent AI workspace with simultaneous orchestration. Built. Lost. Lessons weren't." },
    { name: "LifeLens", status: "BUILDING", desc: "Android AI app tracking screen time, steps, pickups — synthesized into daily health intelligence." },
    { name: "Outreach Automator", status: "BUILDING", desc: "LinkedIn lead scraper + AI-personalized automated outreach sequencer." },
];

function RejectedClientView({ deal }: { deal: Deal }) {
    const [tab, setTab] = useState<"overview" | "projects" | "services" | "reapply">("overview");
    const { token } = useParams();
    const [form, setForm] = useState({ name: deal.name || "", company: deal.company || "", need: "", budget: "", message: "" });
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleReapply = async () => {
        if (!form.name || !form.need || !form.message) return;
        setSubmitting(true);
        try {
            await fetch("/api/submissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, date: new Date().toISOString().slice(0, 10), status: "new", id: Date.now() }),
            });
            setSubmitted(true);
        } catch { /* non-blocking */ }
        setSubmitting(false);
    };

    const tabs = [
        { id: "overview", label: "Overview", icon: <LayoutDashboard size={14} /> },
        { id: "projects", label: "Projects", icon: <Map size={14} /> },
        { id: "services", label: "Services", icon: <Layers size={14} /> },
        { id: "reapply", label: "New Inquiry", icon: <Send size={14} /> },
    ];

    return (
        <div className="min-h-screen bg-[#0A0F1E] text-white selection:bg-[#11B8EA]/30">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0F1E]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#11B8EA] to-[#3B6AE8] flex items-center justify-center shadow-lg shadow-[#11B8EA]/20">
                                <Zap className="text-white" size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black tracking-[0.3em] text-[#11B8EA] uppercase mb-0.5">Synapsis Industries</p>
                                <p className="text-xs font-medium text-white/40 uppercase tracking-widest">Client Portal</p>
                            </div>
                        </div>
                        <nav className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/5">
                            {tabs.map(t => (
                                <button key={t.id} onClick={() => setTab(t.id as any)}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${tab === t.id ? "bg-white text-[#0A0F1E] shadow-xl" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
                                    {t.icon}{t.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <button onClick={() => signOut()} className="group flex items-center gap-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                        <span className="text-[10px] font-black tracking-widest uppercase">Exit</span>
                        <LogOut size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </header>

            <main className="pt-28 pb-20 max-w-7xl mx-auto px-8">
                {/* Rejection notice banner */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 shrink-0">
                        <XCircle size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/30 mb-1">Application Status</p>
                        <p className="text-sm text-white/60">This proposal wasn&apos;t selected for this round. You can explore our work below or submit a new inquiry — with a different scope or budget.</p>
                    </div>
                    <button onClick={() => setTab("reapply")}
                        className="px-5 py-2.5 rounded-xl bg-[#11B8EA]/10 border border-[#11B8EA]/20 text-[#11B8EA] text-[10px] font-black tracking-widest uppercase hover:bg-[#11B8EA]/20 transition-all shrink-0">
                        New Inquiry →
                    </button>
                </motion.div>

                <AnimatePresence mode="wait">
                    <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

                        {/* OVERVIEW TAB */}
                        {tab === "overview" && (
                            <div className="flex flex-col gap-6">
                                <div className="relative rounded-[2rem] p-10 overflow-hidden min-h-[340px] flex flex-col justify-between" style={{ background: "linear-gradient(135deg, #0D1526, #152035)" }}>
                                    <div className="absolute -top-20 -left-20 w-[50%] h-[140%] bg-[#11B8EA]/15 blur-[80px] rounded-full pointer-events-none" style={{ animation: "blobPulse 8s ease-in-out infinite", willChange: "transform" }} />
                                    <div className="relative z-10">
                                        <p className="text-[10px] font-black tracking-[0.5em] text-[#11B8EA] uppercase mb-6">Synapsis Industries</p>
                                        <h1 className="font-serif text-6xl text-white leading-tight mb-6">Systems that<br /><em>scale.</em></h1>
                                        <p className="text-white/50 text-lg max-w-xl leading-relaxed">One engineer. Full-stack expertise. AI-native tooling. I architect and deploy end-to-end digital ecosystems — faster than agencies, sharper than generalists.</p>
                                    </div>
                                    <div className="relative z-10 flex gap-6 mt-10">
                                        {[["5+", "Systems Built"], ["20", "Age"], ["100%", "Solo Delivery"]].map(([v, l]) => (
                                            <div key={l}><p className="font-serif text-3xl text-white">{v}</p><p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">{l}</p></div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {SHOWCASE_SERVICES.map(s => (
                                        <div key={s.title} className="p-7 rounded-2xl border border-white/[0.06]" style={{ background: "#04070F" }}>
                                            <div className="w-2 h-2 rounded-full mb-4" style={{ background: s.color }} />
                                            <h3 className="font-serif text-xl text-white mb-2">{s.title}</h3>
                                            <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* PROJECTS TAB */}
                        {tab === "projects" && (
                            <div className="flex flex-col gap-4">
                                {SHOWCASE_PROJECTS.map((p, i) => (
                                    <motion.div key={p.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                                        className="p-8 rounded-2xl border border-white/[0.06] flex items-center gap-8" style={{ background: "#04070F" }}>
                                        <div className="shrink-0">
                                            <span className={`text-[9px] font-black tracking-[0.3em] uppercase px-3 py-1 rounded-full ${p.status === "LIVE" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : p.status === "ARCHIVED" ? "bg-white/5 text-white/30 border border-white/10" : "bg-[#11B8EA]/10 text-[#11B8EA] border border-[#11B8EA]/20"}`}>{p.status}</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-serif text-2xl text-white mb-1">{p.name}</h3>
                                            <p className="text-white/40 text-sm leading-relaxed">{p.desc}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* SERVICES TAB */}
                        {tab === "services" && (
                            <div className="flex flex-col gap-6">
                                {SHOWCASE_SERVICES.map((s, i) => (
                                    <motion.div key={s.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                                        className="p-10 rounded-[2rem] border border-white/[0.06]" style={{ background: "#04070F" }}>
                                        <div className="flex items-start gap-8">
                                            <div className="w-3 h-3 rounded-full mt-2 shrink-0" style={{ background: s.color, boxShadow: `0 0 20px ${s.color}40` }} />
                                            <div className="flex-1">
                                                <h2 className="font-serif text-3xl text-white mb-3">{s.title}</h2>
                                                <p className="text-white/50 text-base leading-relaxed mb-6">{s.desc}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {s.items.map(item => (
                                                        <span key={item} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50">{item}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[9px] tracking-widest uppercase text-white/20 font-bold mb-1">Pricing</p>
                                                <p className="text-sm font-medium text-white/50">Value-based</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                <div className="p-8 rounded-2xl border border-[#11B8EA]/20 bg-[#11B8EA]/5 text-center">
                                    <p className="text-white/60 text-sm mb-4">No fixed rates. Scoped to your business and what you gain from it.</p>
                                    <button onClick={() => setTab("reapply")} className="px-8 py-3 rounded-xl bg-[#11B8EA] text-[#0A0F1E] text-[10px] font-black tracking-[0.3em] uppercase hover:opacity-90 transition-all">
                                        Submit New Inquiry →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* REAPPLY TAB */}
                        {tab === "reapply" && (
                            <div className="max-w-2xl mx-auto">
                                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                                    className="relative rounded-[2.5rem] bg-white p-12 overflow-hidden shadow-2xl border border-black/5 mb-6">
                                    <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#11B8EA]/10 via-transparent to-transparent pointer-events-none" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-12 h-12 rounded-2xl bg-[#0A0F1E] flex items-center justify-center text-[#11B8EA]"><Send size={22} /></div>
                                            <span className="text-[10px] tracking-[0.5em] uppercase text-black/40 font-black">New Inquiry</span>
                                        </div>
                                        {submitted ? (
                                            <div>
                                                <h1 className="font-serif text-5xl text-[#0A0F1E] leading-tight mb-4">Received.</h1>
                                                <p className="text-lg text-black/50 leading-relaxed">New inquiry submitted. I&apos;ll review it and respond within 48 hours.</p>
                                            </div>
                                        ) : (
                                            <h1 className="font-serif text-5xl text-[#0A0F1E] leading-tight mb-2">Start Fresh.</h1>
                                        )}
                                    </div>
                                </motion.div>

                                {!submitted && (
                                    <div className="flex flex-col gap-4">
                                        {[
                                            { label: "Your Name", key: "name", placeholder: "Full name", type: "text" },
                                            { label: "Company / Brand", key: "company", placeholder: "Company or brand name (optional)", type: "text" },
                                        ].map(f => (
                                            <div key={f.key} className="p-6 rounded-2xl border border-white/[0.06]" style={{ background: "#04070F" }}>
                                                <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-black mb-3">{f.label}</p>
                                                <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                                    className="w-full bg-transparent text-white text-sm outline-none placeholder:text-white/20 border-b border-white/10 pb-2 focus:border-[#11B8EA]/50 transition-colors" />
                                            </div>
                                        ))}
                                        <div className="p-6 rounded-2xl border border-white/[0.06]" style={{ background: "#04070F" }}>
                                            <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-black mb-3">What do you need?</p>
                                            <select value={form.need} onChange={e => setForm(p => ({ ...p, need: e.target.value }))}
                                                className="w-full bg-transparent text-white text-sm outline-none border-b border-white/10 pb-2 focus:border-[#11B8EA]/50 transition-colors [&>option]:bg-[#0A0F1E]">
                                                <option value="">Select a service...</option>
                                                {["AI & Automation", "Full Stack Development", "Digital Ecosystem Architecture", "Other"].map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </div>
                                        <div className="p-6 rounded-2xl border border-white/[0.06]" style={{ background: "#04070F" }}>
                                            <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-black mb-3">Budget Range (optional)</p>
                                            <select value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))}
                                                className="w-full bg-transparent text-white text-sm outline-none border-b border-white/10 pb-2 focus:border-[#11B8EA]/50 transition-colors [&>option]:bg-[#0A0F1E]">
                                                <option value="">Prefer not to say</option>
                                                {["Under ₹50,000", "₹50,000 – ₹1,50,000", "₹1,50,000 – ₹5,00,000", "₹5,00,000+"].map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </div>
                                        <div className="p-6 rounded-2xl border border-white/[0.06]" style={{ background: "#04070F" }}>
                                            <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-black mb-3">Tell me about your project</p>
                                            <textarea rows={4} placeholder="What are you building? What's the problem you need solved?" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                                                className="w-full bg-transparent text-white text-sm outline-none placeholder:text-white/20 resize-none border-b border-white/10 pb-2 focus:border-[#11B8EA]/50 transition-colors" />
                                        </div>
                                        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleReapply} disabled={!form.name || !form.need || !form.message || submitting}
                                            className="w-full py-5 rounded-2xl bg-[#11B8EA] text-[#0A0F1E] font-black text-xs uppercase tracking-[0.4em] disabled:opacity-20 shadow-[0_20px_40px_rgba(17,184,234,0.3)]">
                                            {submitting ? "Submitting..." : "Submit New Inquiry"}
                                        </motion.button>
                                    </div>
                                )}
                            </div>
                        )}

                    </motion.div>
                </AnimatePresence>
            </main>

            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#11B8EA]/5 blur-[120px] rounded-full" style={{ willChange: "transform" }} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#3B6AE8]/5 blur-[120px] rounded-full" style={{ willChange: "transform" }} />
            </div>
        </div>
    );
}


// ─── Main Entrance ────────────────────────────────────────────────────────────

export default function ClientPortal() {
    const { token } = useParams();
    const [deal, setDeal] = useState<Deal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showExpiredOptions, setShowExpiredOptions] = useState(false);

    const fetchDeal = useCallback(async () => {
        try {
            const res = await fetch(`/api/deals?token=${token}`);
            if (res.ok) {
                const data = await res.json();
                setDeal(data);
                setError(false);
            } else {
                setError(true);
            }
        } catch (e) {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchDeal();
    }, [fetchDeal]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center gap-6">
                <div className="w-16 h-16 relative">
                    <div className="absolute inset-0 rounded-2xl bg-[#11B8EA]/20 animate-ping" />
                    <div className="relative w-full h-full rounded-2xl bg-gradient-to-tr from-[#11B8EA] to-[#3B6AE8] flex items-center justify-center">
                        <Zap className="text-white animate-pulse" size={32} />
                    </div>
                </div>
                <p className="text-[10px] font-black tracking-[0.4em] text-[#11B8EA] uppercase animate-pulse">Establishing Secure Link</p>
            </div>
        );
    }

    if (error || !deal) {
        return (
            <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-8">
                <div className="w-20 h-20 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-8">
                    <AlertCircle size={40} />
                </div>
                <h1 className="font-serif text-4xl text-white mb-4">Access Denied.</h1>
                <p className="text-white/40 text-center max-w-sm mb-10 leading-relaxed uppercase tracking-widest text-[10px] font-bold">
                    This link is invalid or has been revoked by Vark operational security.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={() => {
                            localStorage.removeItem("synapsis_client_token");
                            window.location.href = "/";
                        }}
                        className="px-8 py-3 rounded-xl bg-[#11B8EA] text-[#0A0F1E] text-[10px] font-black tracking-[0.3em] uppercase hover:opacity-90 transition-all"
                    >
                        Return to Home
                    </button>
                    <button onClick={() => window.location.reload()} className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black tracking-[0.3em] uppercase hover:bg-white/10 transition-all">
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    // Workflow Routing
    if (deal.status === "elected" || deal.status === "proceeding" || deal.status === "active") {
        return <ClientPhase1Workspace deal={deal} onStatusUpdate={setDeal} />;
    }

    if (deal.status === "rejected") {
        return <RejectedClientView deal={deal} />;
    }

    if (deal.status === "expired") {
        return (
            <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-8 overflow-hidden">
                {!showExpiredOptions ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl w-full text-center relative z-10">
                        <div className="w-24 h-24 rounded-[2.5rem] bg-[#11B8EA]/10 border border-[#11B8EA]/20 flex items-center justify-center text-[#11B8EA] mx-auto mb-12 relative">
                            <Clock size={48} />
                            <div className="absolute inset-0 rounded-[2.5rem] bg-[#11B8EA]/20 animate-ping" style={{ animationDuration: "3s" }} />
                        </div>
                        <h1 className="font-serif text-6xl text-white mb-6">Link Expired.</h1>
                        <p className="text-xl text-white/40 leading-relaxed mb-12">
                            The secure window for this proposal has closed. Vark slots are high-velocity; we cannot hold architectural capacity indefinitely.
                        </p>
                        <div className="flex flex-col gap-4">
                            <button onClick={() => setShowExpiredOptions(true)} className="w-full py-5 rounded-2xl bg-[#11B8EA] text-[#0A0F1E] font-black text-xs uppercase tracking-[0.4em] hover:shadow-[0_20px_40px_rgba(17,184,234,0.3)] transition-all">
                                Request Re-activation
                            </button>
                            <button onClick={() => signOut()} className="w-full py-5 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black text-xs uppercase tracking-[0.4em] hover:bg-white/10 transition-all">
                                Exit Secure Session
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full p-10 rounded-[2.5rem] bg-white text-[#0A0F1E] shadow-2xl relative z-10">
                        <h2 className="font-serif text-4xl mb-4">Waitlist Mode.</h2>
                        <p className="text-black/50 mb-8 leading-relaxed">
                            To re-open this window, we need to re-verify capacity. Your project will be moved to the priority queue.
                        </p>
                        <button onClick={() => window.location.href = "mailto:dhananjay@vark.industries"} className="w-full py-4 rounded-xl bg-[#0A0F1E] text-white font-bold text-xs uppercase tracking-[0.2em] mb-4">
                            Email Operations
                        </button>
                        <button onClick={() => setShowExpiredOptions(false)} className="w-full text-[10px] font-bold text-black/30 uppercase tracking-[0.2em]">Go Back</button>
                    </motion.div>
                )}
                {/* Background effects for expired */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#11B8EA]/10 blur-[150px] rounded-full" />
                </div>
            </div>
        );
    }

    // Default: Status "pending" (Phase 0)
    return (
        <div className="min-h-screen bg-[#0A0F1E] flex flex-col selection:bg-[#11B8EA]/20">
            {/* Simple Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-12 h-24 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#11B8EA] to-[#3B6AE8] flex items-center justify-center shadow-lg">
                        <Zap className="text-white" size={20} />
                    </div>
                    <span className="text-[10px] font-black tracking-[0.5em] text-white uppercase">Vark</span>
                </div>
                {deal.expiryTime && (
                    <div className="pointer-events-auto">
                        <Countdown expiryTime={deal.expiryTime} />
                    </div>
                )}
            </nav>

            {/* Split Layout */}
            <div className="flex-1 flex pt-24">
                {/* Left: Design Philosophy */}
                <div className="hidden lg:flex flex-1 flex-col justify-center p-24 border-r border-white/5 relative overflow-hidden">
                    <div className="relative z-10">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                            <p className="text-[10px] font-black tracking-[0.5em] text-[#11B8EA] uppercase mb-8">System Intelligence</p>
                            <h1 className="font-serif text-7xl text-white leading-[1.1] mb-12">
                                Scale through <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/30">pure technical</span> <br />
                                architecture.
                            </h1>
                            <div className="flex flex-col gap-8 max-w-sm">
                                <p className="text-white/40 leading-relaxed font-medium">
                                    Synapsis provides deep-tier technical orchestration for high-growth operations. We don&apos;t just build websites; we design digital leverage.
                                </p>
                                <div className="h-px w-20 bg-gradient-to-r from-[#11B8EA] to-transparent" />
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#11B8EA]">
                                        <Zap size={20} />
                                    </div>
                                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/60">Real-time collaboration</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                    {/* Background Grid */}
                    <div className="absolute inset-0 opacity-[0.03]">
                        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                    </div>
                </div>

                {/* Right: Proposal Intake */}
                <div className="flex-1 flex flex-col items-center justify-center p-12 bg-black/20">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full">
                        <div className="p-10 rounded-[3rem] bg-white shadow-2xl flex flex-col gap-10">
                            <div>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 rounded-xl bg-[#0A0F1E] flex items-center justify-center text-[#11B8EA]">
                                        <Users size={20} />
                                    </div>
                                    <span className="text-[10px] font-black tracking-[0.4em] uppercase text-black/30">Client Invitation</span>
                                </div>
                                <h2 className="font-serif text-5xl text-[#0A0F1E] leading-tight mb-4">Hello, {deal.name}.</h2>
                                <p className="text-lg text-black/50 leading-relaxed">
                                    You have been selected to proceed with <span className="text-[#0A0F1E] font-bold">{deal.company || deal.need}</span>. Review the terms below to initiate Phase 01.
                                </p>
                            </div>

                            <div className="p-8 rounded-2xl bg-black/[0.03] border border-black/[0.05] flex flex-col gap-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] tracking-[0.3em] uppercase text-black/30 font-black mb-1">Proposal Sum</p>
                                        <p className="font-serif text-3xl text-[#0A0F1E]">{deal.budget}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] tracking-[0.3em] uppercase text-black/30 font-black mb-1">Operational Tier</p>
                                        <p className="text-xs font-bold text-[#11B8EA]">Bespoke Enterprise</p>
                                    </div>
                                </div>
                                <div className="h-px w-full bg-black/[0.05]" />
                                <div>
                                    <p className="text-[9px] tracking-[0.3em] uppercase text-black/30 font-black mb-2">Core Requirement</p>
                                    <p className="text-sm font-medium text-black/70 leading-relaxed">{deal.need}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={async () => {
                                        const res = await fetch(`/api/deals/${token}/status`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ status: "elected" })
                                        });
                                        if (res.ok) fetchDeal();
                                    }}
                                    className="w-full py-5 rounded-2xl bg-[#0A0F1E] text-white font-black text-xs uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                                >
                                    Proceed to Workspace
                                </button>
                                <button
                                    onClick={async () => {
                                        if (confirm("Reject this proposal?")) {
                                            const res = await fetch(`/api/deals/${token}/status`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ status: "rejected" })
                                            });
                                            if (res.ok) fetchDeal();
                                        }
                                    }}
                                    className="w-full py-5 rounded-2xl bg-black/[0.03] border border-black/[0.05] text-black/40 font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-black/5"
                                >
                                    Decline Terms
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}


