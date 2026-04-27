"use client";

import { useSession, signOut } from "next-auth/react";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    LayoutDashboard, FolderOpen, Layers, Rocket,
    LogOut, ExternalLink, X, ArrowRight,
    Zap, Code2, Globe, ChevronRight, MessageSquare,
    Inbox, Settings2, Plus, Trash2, Check, Clock, Mail, Play, Send,
    Activity, Columns3,
} from "lucide-react";
import CommandView from "@/components/admin/CommandView";
import PipelineView from "@/components/admin/PipelineView";
import NotificationCenter from "@/components/admin/NotificationCenter";
import BlueprintBuilder from "@/components/phases/BlueprintBuilder";
import IgnitionAdminView from "@/components/phases/IgnitionAdminView";
import BuildAdminView from "@/components/phases/BuildAdminView";
import DeliverAdminView from "@/components/phases/DeliverAdminView";
import HandoverAdminView from "@/components/phases/HandoverAdminView";
import OrbitAdminView from "@/components/phases/OrbitAdminView";
import BlueprintViewer from "@/components/phases/BlueprintViewer";
import { PHASE_NAMES } from "@/lib/phases/constants";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const PROJECTS = [
    {
        id: 1, name: "Kinora", status: "LIVE", category: ["web"],
        tagline: "Creative image-to-video generation platform.",
        summary: "Kinora is a full-stack AI platform that lets creators transform static images into cinematic video content in seconds. Built solo, integrated with multiple generation models, shipped to production.",
        problem: "Creators needed a fast, intelligent way to transform static images into cinematic video content without complex software.",
        solution: "Built a full-stack AI platform integrating multiple video generation models with a clean creative interface and real-time preview.",
        stack: ["Next.js", "Python", "Replicate API", "Vercel", "TailwindCSS"],
        link: "https://kinora.vercel.app",
        image: "/projects/kinora.jpg",
        images: [] as string[],
        video: null as string | null,
        colors: [] as string[],
    },
    {
        id: 2, name: "JARVIS", status: "BUILDING", category: ["web"],
        tagline: "AI life coach. Studies you for 15 days, then optimizes your life.",
        summary: "JARVIS is a behavioral AI system that silently studies how you live — your goals, routines, patterns — then builds a personalized optimization engine that evolves with you every day.",
        problem: "Generic productivity apps don't understand the individual. People need a system that learns their patterns and adapts.",
        solution: "Building an AI behavioral tracking engine — goal projection, adaptive planning, and daily recommendations that evolve with you.",
        stack: ["Next.js", "Claude API", "Supabase", "Python", "Framer Motion"],
        link: null,
        image: "/projects/jarvis.jpg",
        images: [] as string[],
        video: null as string | null,
        colors: [] as string[],
    },
    {
        id: 3, name: "Radhika", status: "ARCHIVED", category: ["web"],
        tagline: "Multi-agent AI workspace. 8 agents. One interface.",
        summary: "Radhika was a multi-agent orchestration system — 8 AI agents running simultaneously, each with a dedicated role, coordinated through a single interface. The code is gone. The architecture lives on.",
        problem: "Complex projects require multiple AI systems working in parallel — orchestration was always the missing layer.",
        solution: "Built a full multi-agent orchestration system with simultaneous agent execution. Code lost. Lessons weren't.",
        stack: ["React", "Node.js", "OpenAI", "Langchain", "WebSockets"],
        link: null,
        image: "/projects/radhika.jpg",
        images: [] as string[],
        video: null as string | null,
        colors: [] as string[],
    },
    {
        id: 4, name: "LifeLens", status: "BUILDING", category: ["app"],
        tagline: "Android AI app — your daily life under intelligent analysis.",
        summary: "LifeLens is a native Android app that tracks what no one else tracks — screen time, phone pickups, steps, energy patterns — and synthesizes it into AI-powered daily health intelligence.",
        problem: "People have no real visibility into how they spend their time, energy, and attention each day.",
        solution: "Building a native Android app tracking screen time, steps, phone pickups, and synthesizing AI-powered health insights.",
        stack: ["Kotlin", "Android", "Gemini API", "Room DB", "Firebase"],
        link: null,
        image: "/projects/lifelens.jpg",
        images: [] as string[],
        video: null as string | null,
        colors: [] as string[],
    },
    {
        id: 5, name: "Outreach Automator", status: "BUILDING", category: ["workflow"],
        tagline: "LinkedIn lead scraper + automated outreach sequencer.",
        summary: "A full outreach automation pipeline — scrape qualified leads from LinkedIn, enrich them with AI, generate hyper-personalized messages, and run multi-step sequences. Zero manual effort.",
        problem: "Manual outreach is slow, inconsistent, unscalable — founders waste hours with no system behind it.",
        solution: "Building a full automation pipeline — scrape leads, enrich data, personalize with AI, execute multi-step sequences.",
        stack: ["Python", "Playwright", "OpenAI", "Airtable", "n8n"],
        link: null,
        image: "/projects/outreach.jpg",
        images: [] as string[],
        video: null as string | null,
        colors: [] as string[],
    },
];

const SERVICES = [
    {
        icon: Zap, title: "AI & Automation",
        desc: "Agentic workflows, AI integrations, and automated systems that run without you.",
        deliverables: ["Custom AI agents", "Workflow automation", "API integrations", "LLM-powered tools", "Data pipelines"],
        timeline: "2–4 weeks", color: "#11B8EA",
    },
    {
        icon: Code2, title: "Full Stack Dev",
        desc: "Web apps, complex backends, payment integrations, and APIs — built fast, built to last.",
        deliverables: ["Next.js / React apps", "Backend APIs", "Payment integrations", "Database architecture", "Auth systems"],
        timeline: "3–6 weeks", color: "#3B6AE8",
    },
    {
        icon: Globe, title: "Digital Ecosystem",
        desc: "End-to-end system design, deployment, and infrastructure for businesses that want to scale.",
        deliverables: ["System architecture", "Cloud deployment", "CI/CD pipelines", "Monitoring + alerts", "Full documentation"],
        timeline: "4–8 weeks", color: "#ffffff",
    },
];

// ─── DEAL TYPE ────────────────────────────────────────────────────────────────

interface DealMessage {
    from: "client" | "admin";
    text: string;
    timestamp: number;
    imageUrl?: string;
}

interface Deal {
    token: string;
    submissionId: number;
    name: string;
    company: string;
    need: string;
    budget: string;
    message: string;
    createdAt: number;
    status: "pending" | "interested" | "elected" | "rejected" | "proceeding" | "active" | "expired";
    phase: number;
    electedAt?: number;
    rejectedAt?: number;
    rejectionNote?: string;
    extendedUntil?: number;
    clientNote?: string;
    questionnaire?: Record<string, string>;
    questionnaireSubmittedAt?: number;
    messages?: DealMessage[];
    totalPrice?: number;
    payments?: { phase: number; percentage: number; amount: number; status: "pending" | "paid"; paidAt?: number }[];
    projectDays?: number;
    customQuestions?: string[];
    interestChatHistory?: { role: "user" | "assistant"; content: string }[];
    phaseData?: any;
}

// ─── MOCK INBOX DATA (replace with Supabase later) ────────────────────────────

const MOCK_SUBMISSIONS = [
    {
        id: 1, name: "Arjun Mehta", company: "Nexus Labs",
        need: "AI & Automation", budget: "₹1,50,000 – ₹5,00,000",
        message: "We need an automated lead generation and nurturing system for our B2B SaaS product. Currently doing everything manually — it's costing us deals. Looking for someone who actually understands AI orchestration, not just chatbots.",
        date: "2026-03-14", status: "new",
    },
    {
        id: 2, name: "Priya Sharma", company: "BrandX Agency",
        need: "Full Stack Development", budget: "₹50,000 – ₹1,50,000",
        message: "We run a digital agency and need a client portal where clients can track project progress, approve deliverables, and raise requests. Currently using Google Sheets — want something proper.",
        date: "2026-03-12", status: "read",
    },
    {
        id: 3, name: "Rohan Kapoor", company: "FinEdge",
        need: "Payment Integration", budget: "₹5,00,000+",
        message: "Building a marketplace platform and need complete payment infrastructure — split payments, escrow, refunds, payouts to vendors. Razorpay or Stripe, whatever works. Need someone who has done this before.",
        date: "2026-03-10", status: "replied",
    },
    {
        id: 4, name: "Sneha Iyer", company: "Freelance",
        need: "Agentic Workflow", budget: "Under ₹50,000",
        message: "I run a content agency and want to automate my client onboarding — intake form → contract → invoice → project setup. Tired of doing this manually for every new client.",
        date: "2026-03-08", status: "read",
    },
];

// ─── 3D MARQUEE ───────────────────────────────────────────────────────────────

const MARQUEE_IMAGES = [
    // AI / data / analytics
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80",
    "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=80",
    "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80",
    "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=400&q=80",
    // code / terminal / IDE
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80",
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=80",
    // systems / infra / automation
    "https://images.unsplash.com/photo-1537432376769-00f5c2f4c8d2?w=400&q=80",
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80",
    "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&q=80",
    "https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?w=400&q=80",
    "https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?w=400&q=80",
];

function ThreeDMarquee({ images = MARQUEE_IMAGES }: { images?: string[] }) {
    const third = Math.ceil(images.length / 3);
    const cols = [images.slice(0, third), images.slice(third, third * 2), images.slice(third * 2)];

    return (
        <div className="relative w-full h-full overflow-hidden" style={{ perspective: "900px", minHeight: "260px" }}>
            <div
                className="absolute inset-[-20%] flex items-center justify-center gap-4 origin-center"
                style={{ transform: "rotateX(45deg) rotateY(0deg) rotateZ(45deg) scale(0.9)", transformOrigin: "center center" }}
            >
                {cols.map((col, ci) => (
                    <motion.div
                        key={ci}
                        className="flex flex-col gap-4 shrink-0"
                        animate={{ y: ci % 2 === 0 ? [-120, 120] : [120, -120] }}
                        transition={{ duration: ci === 1 ? 16 : 12, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
                    >
                        {[...col, ...col, ...col].map((src, idx) => (
                            <div key={idx} className="w-32 h-24 rounded-xl overflow-hidden border border-black/8 shrink-0">
                                <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
                            </div>
                        ))}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ─── SHADER BENCHMARK CARD ────────────────────────────────────────────────────

const BENCHMARK_DATA = [
    {
        stat: "451%",
        label: "more qualified leads",
        context: "with automated lead nurturing vs manual outreach",
        blobs: ["#11B8EA", "#3B6AE8", "#0D3A8A"],
    },
    {
        stat: "80%",
        label: "faster response time",
        context: "businesses using AI customer service vs manual teams",
        blobs: ["#3B6AE8", "#11B8EA", "#1A0D6B"],
    },
    {
        stat: "6 hrs",
        label: "saved per employee / week",
        context: "after automating reporting and data entry workflows",
        blobs: ["#0A5A8A", "#11B8EA", "#3B6AE8"],
    },
];

function BenchmarkCard({ stat, label, context, blobs, delay = 0 }: {
    stat: string; label: string; context: string; blobs: string[]; delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
            className="relative rounded-3xl overflow-hidden border border-white/10"
            style={{ height: "260px" }}
        >
            {/* Dark base */}
            <div className="absolute inset-0 bg-[#04070F]" />

            {/* Animated colour blobs — mimics the Warp shader */}
            {blobs.map((color, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full blur-[80px]"
                    style={{
                        background: color,
                        width: 200, height: 200,
                        left: i === 0 ? -40 : i === 1 ? "55%" : "20%",
                        top: i === 0 ? -40 : i === 1 ? "40%" : "10%",
                        opacity: 0.75,
                    }}
                    animate={{
                        x: i === 0 ? [0, 50, -25, 0] : i === 1 ? [0, -35, 55, 0] : [0, 25, -45, 0],
                        y: i === 0 ? [0, -35, 45, 0] : i === 1 ? [0, 45, -25, 0] : [0, -55, 30, 0],
                        scale: [1, 1.2, 0.88, 1],
                    }}
                    transition={{ duration: 8 + i * 3, repeat: Infinity, ease: "easeInOut" }}
                />
            ))}

            {/* Dark glass overlay for readability */}
            <div className="absolute inset-0 bg-black/72 backdrop-blur-[1px]" />

            {/* Content */}
            <div className="relative z-10 p-8 h-full flex flex-col justify-between">
                <div>
                    <p className="font-serif text-5xl text-white leading-none mb-3">{stat}</p>
                    <p className="text-white text-sm font-semibold mb-2">{label}</p>
                    <p className="text-white/65 text-xs leading-relaxed">{context}</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <span className="text-[10px] uppercase tracking-widest text-white/40">2026 benchmark</span>
                </div>
            </div>
        </motion.div>
    );
}

// ─── COUNTER ──────────────────────────────────────────────────────────────────

function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let n = 0;
        const step = Math.ceil(target / 40);
        const t = setInterval(() => { n += step; if (n >= target) { setCount(target); clearInterval(t); } else setCount(n); }, 25);
        return () => clearInterval(t);
    }, [target]);
    return <>{count}{suffix}</>;
}

// ─── PROJECT CARD EXPANDED ────────────────────────────────────────────────────

// (inline inside WorkView via LayoutGroup)

// ─── ROI CALCULATOR ───────────────────────────────────────────────────────────

function ROICalculator({ onStartProject }: { onStartProject: () => void }) {
    const [team, setTeam] = useState(5);
    const [hours, setHours] = useState(10);
    const [rate, setRate] = useState(500);
    const monthly = team * hours * 4 * rate;
    const yearly = monthly * 12;
    const payback = Math.ceil(150000 / monthly);

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="w-full rounded-3xl bg-white p-8 mb-5 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-72 h-full bg-gradient-to-l from-[#11B8EA]/6 via-transparent to-transparent pointer-events-none" />

            <p className="text-[10px] tracking-[0.4em] uppercase text-black/55 font-semibold mb-1">ROI Calculator</p>
            <h2 className="font-serif text-3xl text-[#0A0F1E] mb-1">What is manual work costing you?</h2>
            <p className="text-black/60 text-sm mb-7">Adjust the sliders to see the real cost of not automating.</p>

            <div className="grid grid-cols-3 gap-6 mb-8">
                {[
                    { label: "Team Size", val: team, set: setTeam, min: 1, max: 50, suffix: " people" },
                    { label: "Manual hrs / week", val: hours, set: setHours, min: 1, max: 40, suffix: " hrs" },
                    { label: "Avg. hourly rate (₹)", val: rate, set: setRate, min: 100, max: 5000, suffix: "" },
                ].map(s => (
                    <div key={s.label}>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] tracking-[0.25em] uppercase text-black/60">{s.label}</label>
                            <span className="text-sm font-semibold text-[#0A0F1E]">{s.val}{s.suffix}</span>
                        </div>
                        <input type="range" min={s.min} max={s.max} value={s.val}
                            onChange={e => s.set(Number(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{ background: `linear-gradient(to right, #11B8EA ${((s.val - s.min) / (s.max - s.min)) * 100}%, #e5e7eb ${((s.val - s.min) / (s.max - s.min)) * 100}%)` }}
                        />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-7">
                <div className="rounded-2xl bg-[#0A0F1E] p-5">
                    <p className="text-[10px] tracking-widest uppercase text-white/60 mb-2">Monthly Loss</p>
                    <p className="font-serif text-2xl text-white">₹{monthly.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-2xl bg-[#0A0F1E] p-5">
                    <p className="text-[10px] tracking-widest uppercase text-white/60 mb-2">Yearly Loss</p>
                    <p className="font-serif text-2xl" style={{ color: "#11B8EA" }}>₹{yearly.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-2xl border border-black/10 p-5">
                    <p className="text-[10px] tracking-widest uppercase text-black/55 mb-2">Build Pays Off In</p>
                    <p className="font-serif text-2xl text-[#0A0F1E]">{payback} mo.</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-black/60 text-sm max-w-xs">A one-time system build eliminates this loss permanently.</p>
                <button onClick={onStartProject}
                    className="px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
                    style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}>
                    Let's Fix This →
                </button>
            </div>
        </motion.div>
    );
}

// ─── HOME VIEW ────────────────────────────────────────────────────────────────

function HomeView({ onStartProject, onExploreWork }: { onStartProject: () => void; onExploreWork: () => void }) {
    return (
        <div className="p-8 max-w-5xl mx-auto">

            {/* 1 — White Hero */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="relative w-full rounded-3xl bg-white mb-5 overflow-hidden">
                {/* Left: text content */}
                <div className="relative z-10 flex flex-row">
                    <div className="flex flex-col justify-center p-10 flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] tracking-[0.4em] uppercase text-black/55 font-semibold">Available for Projects — March 2026</span>
                        </div>
                        <h1 className="font-serif text-5xl md:text-6xl text-[#0A0F1E] leading-[0.95] mb-4">
                            I don't build websites.<br /><em>I build systems.</em>
                        </h1>
                        <p className="text-black/60 text-sm max-w-sm leading-relaxed mb-6">One engineer. AI-native. Zero agency overhead. Maximum leverage for your business — built in weeks, not months.</p>
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-black/45 text-[10px] uppercase tracking-widest mb-0.5">Response Time</p>
                                <p className="font-serif text-3xl text-[#0A0F1E]">{"<"}<span style={{ color: "#11B8EA" }}>48h</span></p>
                            </div>
                            <div className="w-px h-10 bg-black/15" />
                            <div>
                                <p className="text-black/45 text-[10px] uppercase tracking-widest mb-0.5">Systems Built</p>
                                <p className="font-serif text-3xl text-[#0A0F1E]"><span style={{ color: "#3B6AE8" }}>{PROJECTS.length}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Right: 3D Marquee */}
                    <div className="hidden lg:flex w-[45%] shrink-0 relative overflow-hidden rounded-r-3xl self-stretch">
                        <div className="absolute inset-0 bg-[#F8F9FF]" />
                        <ThreeDMarquee />
                        {/* seamless left fade */}
                        <div className="absolute top-0 left-0 h-full w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                        {/* top + bottom fades */}
                        <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
                    </div>
                </div>
            </motion.div>

            {/* 2 — Industry Benchmarks */}
            <div className="mb-5">
                <p className="text-[10px] tracking-[0.4em] uppercase text-white/25 mb-3">Industry Benchmarks — 2026</p>
                <div className="grid grid-cols-3 gap-4">
                    {BENCHMARK_DATA.map((b, i) => (
                        <BenchmarkCard key={b.stat} {...b} delay={0.1 + i * 0.07} />
                    ))}
                </div>
            </div>

            {/* 3 — ROI Calculator */}
            <ROICalculator onStartProject={onStartProject} />

            {/* 4 — Profile (editorial) */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="relative w-full rounded-3xl overflow-hidden mb-5 border border-white/8"
                style={{ minHeight: "300px" }}>

                {/* Dark base + subtle gradient */}
                <div className="absolute inset-0 bg-[#070B16]" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#11B8EA]/6 via-transparent to-[#3B6AE8]/6 pointer-events-none" />

                <div className="relative z-10 flex items-stretch">

                    {/* Portrait photo */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="relative w-80 shrink-0 overflow-hidden"
                        style={{ minHeight: "300px" }}
                    >
                        {/* fade into dark bg on the right */}
                        <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-transparent to-[#070B16]" />
                        <div className="absolute bottom-0 left-0 right-0 z-10 h-20 bg-gradient-to-t from-[#070B16] to-transparent" />
                        <img
                            src="/my-image.jpg"
                            alt="Dhananjay Chitmilla"
                            className="h-full w-full object-cover object-top"
                        />
                    </motion.div>

                    {/* Info block — overlaps portrait via negative margin */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="flex-1 -ml-8 relative z-20 flex flex-col justify-center px-10 py-10"
                    >
                        {/* Label */}
                        <p className="text-[10px] tracking-[0.35em] uppercase text-[#11B8EA] mb-4">
                            Full Stack System Engineer · AI Solutions Architect
                        </p>

                        {/* Name — large editorial */}
                        <div className="mb-5">
                            <p className="font-serif leading-[1.05]" style={{ fontSize: "clamp(2.2rem, 4vw, 3.5rem)" }}>
                                <span className="text-white font-extralight">Dhananjay</span><br />
                                <span className="text-white font-normal">Chitmilla</span>
                            </p>
                        </div>

                        {/* Bio */}
                        <p className="text-white/60 text-sm leading-relaxed max-w-md mb-6">
                            I architect and deploy end-to-end digital ecosystems — AI agents, automated workflows, and full-stack systems. Built fast. Built to last. One person, zero overhead, maximum leverage.
                        </p>

                        {/* Skills */}
                        <div className="flex flex-wrap gap-2">
                            {["AI & Automation", "Full Stack Dev", "Agentic Workflows", "Payment Systems", "API Integrations"].map(t => (
                                <span key={t} className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 text-white/50 bg-white/[0.03]">{t}</span>
                            ))}
                        </div>
                    </motion.div>


                </div>
            </motion.div>

            {/* 5 — Dual CTA */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
                className="grid grid-cols-2 gap-4">

                {/* Book a Project — cyan-blue gradient with grid */}
                <button onClick={onStartProject}
                    className="relative rounded-2xl p-8 text-left overflow-hidden group hover:scale-[1.01] transition-transform duration-300"
                    style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}>
                    {/* Grid pattern */}
                    <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full fill-white/5 stroke-white/20 [mask-image:linear-gradient(white,transparent)]"
                    >
                        <defs>
                            <pattern id="grid-book" width="32" height="32" patternUnits="userSpaceOnUse">
                                <path d="M0 32V.5H32" fill="none" strokeDasharray="0" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" strokeWidth="0" fill="url(#grid-book)" />
                    </svg>
                    {/* Glow orb */}
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
                    {/* Content */}
                    <div className="relative z-10">
                        <p className="text-[10px] tracking-[0.3em] uppercase text-white/70 mb-3">Ready to build?</p>
                        <h3 className="font-serif text-3xl text-white mb-2">Book a Project</h3>
                        <p className="text-white/70 text-sm mb-5">Tell me what you need. I'll scope it and respond within 48 hours.</p>
                        <span className="text-white text-sm font-semibold group-hover:translate-x-1 inline-block transition-transform">Start now →</span>
                    </div>
                </button>

                {/* Explore Work — brand royal blue with grid */}
                <button onClick={onExploreWork}
                    className="relative rounded-2xl p-8 text-left overflow-hidden group hover:scale-[1.01] transition-transform duration-300 border border-[#3B6AE8]/40"
                    style={{ background: "#0D1830" }}>
                    {/* Grid pattern */}
                    <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full fill-[#3B6AE8]/5 stroke-[#3B6AE8]/20 [mask-image:linear-gradient(white,transparent)]"
                    >
                        <defs>
                            <pattern id="grid-explore" width="32" height="32" patternUnits="userSpaceOnUse">
                                <path d="M0 32V.5H32" fill="none" strokeDasharray="0" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" strokeWidth="0" fill="url(#grid-explore)" />
                    </svg>
                    {/* Glow orb */}
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30 blur-2xl pointer-events-none" style={{ background: "#3B6AE8" }} />
                    {/* Content */}
                    <div className="relative z-10">
                        <p className="text-[10px] tracking-[0.3em] uppercase text-[#3B6AE8]/80 mb-3">See the proof</p>
                        <h3 className="font-serif text-3xl text-white mb-2">Explore Work</h3>
                        <p className="text-white/50 text-sm mb-5">{PROJECTS.length} systems built. Case studies, tech stacks, and the stories behind each build.</p>
                        <span className="text-[#3B6AE8] text-sm font-semibold group-hover:text-[#11B8EA] group-hover:translate-x-1 inline-block transition-all">View projects →</span>
                    </div>
                </button>

            </motion.div>

        </div>
    );
}

// ─── WORK VIEW ────────────────────────────────────────────────────────────────

const FILTERS = [
    { id: "web", label: "Web" },
    { id: "app", label: "App" },
    { id: "workflow", label: "Workflow" },
] as const;

type Project = typeof PROJECTS[0];

function ProjectCard({ p, baseDelay, i, activeId, setActive }: { p: Project, baseDelay: number, i: number, activeId?: number, setActive: (p: Project) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 1.5;
        }
    }, [p.video]);

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (videoRef.current) {
            videoRef.current.play().catch(() => {});
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (videoRef.current) {
            videoRef.current.pause();
        }
    };

    if (activeId === p.id) return null;

    const statusColor = (s: string) => s === "LIVE" ? "#11B8EA" : s === "BUILDING" ? "#3B6AE8" : undefined;
    const statusCls = (s: string) =>
        s === "LIVE" ? "bg-[#11B8EA]/10 text-[#11B8EA] border-[#11B8EA]/30"
        : s === "BUILDING" ? "bg-[#3B6AE8]/10 text-[#3B6AE8] border-[#3B6AE8]/30"
        : "bg-white/5 text-white/25 border-white/10";

    return (
        <motion.article
            layoutId={`card-${p.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: p.status === "ARCHIVED" ? 0.45 : 1, y: 0 }}
            transition={{ delay: baseDelay + i * 0.07 }}
            onClick={() => setActive(p)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="group cursor-pointer rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300 shrink-0 w-72"
            whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
        >
            <motion.div layoutId={`card-image-${p.id}`} className="relative h-44 overflow-hidden bg-[#0D1526]">
                <img
                    src={(p.images && p.images[0]) || p.image}
                    alt={p.name}
                    className={`w-full h-full object-cover transition-all duration-700 ease-out ${isHovered && p.video ? "opacity-0 scale-105" : "opacity-100 scale-100"}`}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {p.video && (
                    <video
                        ref={videoRef}
                        src={p.video}
                        loop
                        muted
                        playsInline
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isHovered ? "opacity-100" : "opacity-0"}`}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 pointer-events-none">
                    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.25em] uppercase px-2.5 py-1 rounded-full border ${statusCls(p.status)}`}>
                        {p.status !== "ARCHIVED" && (
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor(p.status) }} />
                        )}
                        {p.status}
                    </span>
                </div>
            </motion.div>
            <motion.div layoutId={`card-content-${p.id}`} className="p-5">
                <motion.h3 layoutId={`card-title-${p.id}`} className="font-serif text-2xl text-white mb-1 group-hover:text-[#11B8EA] transition-colors">
                    {p.name}
                </motion.h3>
                <p className="text-white/40 text-sm leading-relaxed line-clamp-2">{p.tagline}</p>
            </motion.div>
        </motion.article>
    );
}

function WorkView({ projects }: { projects: Project[] }) {
    const [active, setActive] = useState<Project | null>(null);
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

    const statusColor = (s: string) => s === "LIVE" ? "#11B8EA" : s === "BUILDING" ? "#3B6AE8" : undefined;
    const statusCls = (s: string) =>
        s === "LIVE" ? "bg-[#11B8EA]/10 text-[#11B8EA] border-[#11B8EA]/30"
        : s === "BUILDING" ? "bg-[#3B6AE8]/10 text-[#3B6AE8] border-[#3B6AE8]/30"
        : "bg-white/5 text-white/25 border-white/10";

    const toggleFilter = (id: string) =>
        setSelectedFilters(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );

    const visibleProjects = selectedFilters.length === 0
        ? projects
        : projects.filter(p => p.category.some(c => selectedFilters.includes(c)));

    const completed = visibleProjects.filter(p => p.status === "LIVE");
    const inProgress = visibleProjects.filter(p => p.status === "BUILDING");
    const archived = visibleProjects.filter(p => p.status === "ARCHIVED");

    const renderCards = (projects: typeof PROJECTS, baseDelay = 0) =>
        projects.map((p, i) => (
            <ProjectCard key={p.id} p={p} baseDelay={baseDelay} i={i} activeId={active?.id} setActive={setActive} />
        ));

    return (
        <div className="p-8">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-end justify-between">
                <div>
                    <p className="text-[10px] tracking-[0.4em] uppercase text-[#11B8EA] mb-1">Portfolio</p>
                    <h1 className="font-serif text-5xl text-white">Systems Built</h1>
                </div>
                <div className="flex items-center gap-2 p-1">
                    {FILTERS.map(f => {
                        const on = selectedFilters.includes(f.id);
                        return (
                            <button key={f.id} onClick={() => toggleFilter(f.id)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all duration-200 ${on ? "bg-[#11B8EA]/10 border-[#11B8EA]/40 text-[#11B8EA]" : "border-white/10 text-white/30 hover:border-white/25 hover:text-white/55"}`}>
                                {f.label}
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            <LayoutGroup>
                {/* In Progress */}
                {inProgress.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="mb-10">
                        <div className="flex items-center gap-3 mb-5">
                            <span className="w-2 h-2 rounded-full bg-[#3B6AE8] animate-pulse" />
                            <p className="text-[10px] tracking-[0.35em] uppercase text-white/35 font-semibold">In Progress</p>
                            <span className="text-[10px] text-white/20">— {inProgress.length} active</span>
                        </div>
                        <div className="flex gap-4 overflow-x-auto py-4 -my-4 scrollbar-hide">
                            {renderCards(inProgress, 0.1)}
                        </div>
                    </motion.div>
                )}

                {/* Completed */}
                {completed.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-10">
                        <div className="flex items-center gap-3 mb-5">
                            <span className="w-2 h-2 rounded-full bg-[#11B8EA]" />
                            <p className="text-[10px] tracking-[0.35em] uppercase text-white/35 font-semibold">Completed</p>
                            <span className="text-[10px] text-white/20">— {completed.length} shipped</span>
                        </div>
                        <div className="flex gap-4 overflow-x-auto py-4 -my-4 scrollbar-hide">
                            {renderCards(completed, 0.2)}
                        </div>
                    </motion.div>
                )}

                {/* Archived */}
                {archived.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mb-10">
                        <div className="flex items-center gap-3 mb-5">
                            <span className="w-2 h-2 rounded-full bg-white/20" />
                            <p className="text-[10px] tracking-[0.35em] uppercase text-white/20 font-semibold">Archived</p>
                        </div>
                        <div className="flex gap-4 overflow-x-auto py-4 -my-4 scrollbar-hide">
                            {renderCards(archived, 0.3)}
                        </div>
                    </motion.div>
                )}

                <div className="h-px" />

                {/* Expanded card modal */}
                <AnimatePresence>
                    {active && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40"
                                onClick={() => setActive(null)}
                            />
                            <motion.div
                                layoutId={`card-${active.id}`}
                                className="fixed inset-4 md:inset-8 lg:inset-12 bg-[#070B16] border border-white/10 rounded-2xl overflow-hidden z-50 flex flex-col"
                            >
                                {/* Close */}
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                                    className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 border border-white/10 flex items-center justify-center transition-colors"
                                    onClick={() => setActive(null)}
                                >
                                    <X size={14} className="text-white/70" />
                                </motion.button>

                                <div className="h-full overflow-y-auto scrollbar-hide">

                                    {/* ── SECTION 1: Images ── */}
                                    {/* Image 1 — natural aspect ratio, no cropping */}
                                    <motion.div layoutId={`card-image-${active.id}`} className="relative w-full bg-[#0D1526]">
                                        <img
                                            src={(active.images && active.images[0]) || active.image}
                                            alt={active.name}
                                            className="w-full h-auto block"
                                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#070B16]" />
                                        {/* Title below image */}
                                        <motion.div layoutId={`card-content-${active.id}`} className="px-8 pt-6 pb-2">
                                            <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold tracking-[0.25em] uppercase px-2.5 py-1 rounded-full border mb-4 ${statusCls(active.status)}`}>
                                                {active.status !== "ARCHIVED" && (
                                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor(active.status) }} />
                                                )}
                                                {active.status}
                                            </span>
                                            <motion.h2 layoutId={`card-title-${active.id}`} className="font-serif text-5xl md:text-6xl text-white leading-tight">
                                                {active.name}
                                            </motion.h2>
                                            <p className="text-white/45 text-base mt-2">{active.tagline}</p>
                                        </motion.div>
                                    </motion.div>

                                    {/* Image 2 — natural aspect ratio */}
                                    {active.images && active.images[1] ? (
                                        <motion.div
                                            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.3 }}
                                            className="relative w-full bg-[#0A0F1E]"
                                        >
                                            <img src={active.images[1]} alt="" className="w-full h-auto block opacity-90" />
                                            <div className="absolute inset-0 bg-gradient-to-b from-[#070B16]/30 via-transparent to-[#070B16]" />
                                        </motion.div>
                                    ) : (
                                        <div className="w-full flex items-center justify-center bg-[#070B16] py-10">
                                            <p className="text-white/10 text-xs tracking-[0.3em] uppercase">Second image — upload when ready</p>
                                        </div>
                                    )}

                                    {/* ── SECTION 2: Video | Summary ── */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                                        transition={{ duration: 0.5 }}
                                        className="grid grid-cols-2 border-t border-white/6"
                                        style={{ minHeight: "42vh" }}
                                    >
                                        {/* Left: Video */}
                                        <div className="flex items-center justify-center p-8 border-r border-dashed border-white/10">
                                            {active.video ? (
                                                <video src={active.video} controls className="w-full rounded-xl border border-white/10" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-4 text-center">
                                                    <div className="w-16 h-16 rounded-full border border-dashed border-white/15 flex items-center justify-center">
                                                        <Play size={18} className="text-white/20 ml-0.5" />
                                                    </div>
                                                    <p className="text-white/15 text-xs tracking-[0.25em] uppercase">Video — coming soon</p>
                                                </div>
                                            )}
                                        </div>
                                        {/* Right: Summary */}
                                        <div className="flex flex-col justify-center p-8 md:p-10">
                                            <p className="text-[10px] tracking-[0.4em] uppercase text-white/20 mb-5">Overview</p>
                                            <p className="text-white/60 text-sm leading-[1.9]">{(active as typeof PROJECTS[0]).summary || active.tagline}</p>
                                            {active.link && (
                                                <a href={active.link} target="_blank" rel="noopener noreferrer"
                                                    className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#11B8EA] hover:text-white transition-colors">
                                                    View Live <ExternalLink size={11} />
                                                </a>
                                            )}
                                        </div>
                                    </motion.div>

                                    {/* ── SECTION 3: Brief Info ── */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                                        transition={{ duration: 0.5 }}
                                        className="px-10 py-14 border-t border-white/6"
                                    >
                                        <p className="text-[10px] tracking-[0.5em] uppercase text-white/15 mb-10">Project Brief</p>
                                        <div className="grid grid-cols-2 gap-10">
                                            <div>
                                                <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-4">The Problem</p>
                                                <p className="text-white/55 text-sm leading-[1.85]">{active.problem}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-4">The Build</p>
                                                <p className="text-white/55 text-sm leading-[1.85]">{active.solution}</p>
                                            </div>
                                        </div>
                                        {active.status === "ARCHIVED" && (
                                            <div className="mt-10 p-6 rounded-2xl border border-dashed border-white/8 italic">
                                                <p className="text-white/25 text-sm leading-relaxed">"Built. Lost. The code is gone — the architecture lives in everything I build now."</p>
                                            </div>
                                        )}
                                    </motion.div>

                                    {/* ── SECTION 4: Assets / Stack ── */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                                        transition={{ duration: 0.5 }}
                                        className="px-10 py-14 border-t border-white/6"
                                    >
                                        <p className="text-[10px] tracking-[0.5em] uppercase text-white/15 mb-10">Built With</p>
                                        <div className="flex flex-wrap gap-3">
                                            {active.stack.map((t, i) => (
                                                <motion.div
                                                    key={t}
                                                    initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                                                    viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                                                    className="group flex items-center gap-2.5 px-5 py-3 rounded-2xl border border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05] transition-all cursor-default"
                                                >
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#3B6AE8]/60" />
                                                    <span className="text-white/55 text-sm font-medium group-hover:text-white/80 transition-colors">{t}</span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>

                                    {/* ── SECTION 5: Color Palette ── */}
                                    {active.colors && active.colors.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
                                            transition={{ duration: 0.5 }}
                                            className="px-10 py-14 border-t border-white/6"
                                        >
                                            <p className="text-[10px] tracking-[0.5em] uppercase text-white/15 mb-10">Color System</p>
                                            <div className="flex items-end gap-5 flex-wrap">
                                                {active.colors.map((color, i) => (
                                                    <motion.div
                                                        key={color}
                                                        initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                                                        viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                                                        className="flex flex-col items-center gap-3"
                                                    >
                                                        {/* Large swatch */}
                                                        <div
                                                            className="rounded-2xl border border-white/10 shadow-lg"
                                                            style={{
                                                                background: color,
                                                                width: `${80 + i * 12}px`,
                                                                height: `${80 + i * 12}px`,
                                                                boxShadow: `0 8px 32px ${color}40`
                                                            }}
                                                        />
                                                        <p className="text-white/30 text-[10px] font-mono tracking-wider">{color}</p>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Bottom padding */}
                                    <div className="h-16" />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </LayoutGroup>
        </div>
    );
}

// ─── SERVICES VIEW ────────────────────────────────────────────────────────────

function ServicesView({ onStartProject }: { onStartProject: () => void }) {
    return (
        <div className="p-8">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="text-[10px] tracking-[0.4em] uppercase text-[#11B8EA] mb-1">Offerings</p>
                <h1 className="font-serif text-5xl text-white">What I Build</h1>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                {SERVICES.map((s, i) => (
                    <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className={`relative rounded-2xl p-8 flex flex-col gap-5 overflow-hidden group transition-all duration-300 ${i === 0 ? "bg-white text-[#0A0F1E]" : "border border-white/8 bg-white/[0.03] hover:border-white/20"}`}>

                        {i === 0 && <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#11B8EA]/10 blur-2xl pointer-events-none" />}
                        {i === 1 && <div className="absolute inset-0 bg-gradient-to-br from-[#3B6AE8]/8 to-transparent pointer-events-none rounded-2xl" />}

                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${i === 0 ? "bg-[#0A0F1E]" : "border border-white/10"}`} style={i !== 0 ? { background: `${s.color}15` } : {}}>
                            <s.icon size={18} style={{ color: i === 0 ? "#11B8EA" : s.color }} />
                        </div>

                        <div>
                            <h3 className={`font-serif text-2xl mb-2 ${i === 0 ? "text-[#0A0F1E]" : "text-white"}`}>{s.title}</h3>
                            <p className={`text-sm leading-relaxed ${i === 0 ? "text-black/50" : "text-white/45"}`}>{s.desc}</p>
                        </div>

                        <ul className="flex flex-col gap-2">
                            {s.deliverables.map(d => (
                                <li key={d} className={`flex items-center gap-2 text-sm ${i === 0 ? "text-black/60" : "text-white/50"}`}>
                                    <span className={`w-1 h-1 rounded-full ${i === 0 ? "bg-black/30" : "bg-white/25"}`} />
                                    {d}
                                </li>
                            ))}
                        </ul>

                        <div className="mt-auto flex items-center justify-between pt-4 border-t" style={{ borderColor: i === 0 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)" }}>
                            <div>
                                <p className={`text-[10px] uppercase tracking-widest mb-1 ${i === 0 ? "text-black/30" : "text-white/25"}`}>Timeline</p>
                                <p className={`text-sm font-medium ${i === 0 ? "text-black/70" : "text-white"}`}>{s.timeline}</p>
                            </div>
                            <button onClick={onStartProject}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-all ${i === 0 ? "bg-[#0A0F1E] text-white hover:bg-[#0A0F1E]/80" : "border border-white/15 text-white hover:border-white/35"}`}>
                                Enquire <ArrowRight size={11} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="rounded-2xl border border-white/6 bg-white/[0.02] p-6 text-center">
                <p className="text-white/35 text-sm">No pricing page. Every project is scoped to your business.</p>
                <p className="text-white/20 text-xs mt-1">Value-based — we charge based on what your business gains, not hours logged.</p>
            </motion.div>
        </div>
    );
}

// ─── START PROJECT VIEW ───────────────────────────────────────────────────────

interface Submission {
    id: number;
    name: string;
    company: string;
    need: string;
    budget: string;
    message: string;
    date: string;
    status: string;
}

function StartProjectView({ onSubmit }: { onSubmit: (s: Submission) => void }) {
    const [done, setDone] = useState(false);
    const [portalToken, setPortalToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [form, setForm] = useState({ name: "", company: "", need: "", budget: "", message: "", problem: "" });
    const [hasWhatsapp, setHasWhatsapp] = useState<null | boolean>(null);
    const [contact, setContact] = useState({ whatsapp: "", gmail: "", instagram: "", linkedin: "" });
    const u = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

    const inputCls = "w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm text-white outline-none focus:border-[#11B8EA]/50 transition-colors placeholder:text-white/20";
    const labelCls = "text-[10px] tracking-[0.3em] uppercase text-white/30 block mb-1.5";

    const portalUrl = portalToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/client/${portalToken}` : "";

    const copyPortalLink = () => {
        if (!portalUrl) return;
        navigator.clipboard.writeText(portalUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-8 max-w-xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <p className="font-mono text-[11px] text-[#11B8EA]/60 mb-2">{"> synapsis --new-project"}</p>
                <h1 className="font-serif text-5xl text-white">Start a Project</h1>
            </motion.div>

            {done ? (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl bg-[#0D1526] border border-white/8 p-10 flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg,#11B8EA,#3B6AE8)" }}>
                            <Check size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-serif text-3xl text-white mb-1">Request Received.</h2>
                            <p className="text-white/35 text-sm">We'll review and respond within 48 hours.</p>
                        </div>
                    </div>
                    {/* Portal link */}
                    {portalToken && (
                        <div className="flex flex-col gap-3 p-5 rounded-2xl border border-[#11B8EA]/20 bg-[#11B8EA]/5">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#11B8EA]" />
                                <p className="text-[#11B8EA] text-xs font-bold tracking-wider uppercase">Your Project Portal</p>
                            </div>
                            <p className="text-white/50 text-xs leading-relaxed">
                                Bookmark this link. It's your private portal to track your project status, complete the questionnaire, and communicate with us.
                            </p>
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/8">
                                <span className="flex-1 font-mono text-[11px] text-white/50 truncate">/client/{portalToken}</span>
                                <button onClick={copyPortalLink}
                                    className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                                    style={{ background: copied ? "rgba(16,185,129,0.15)" : "rgba(17,184,234,0.15)", color: copied ? "#10b981" : "#11B8EA" }}>
                                    {copied ? "Copied ✓" : "Copy Link"}
                                </button>
                            </div>
                            <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[#0A0F1E] transition-all hover:opacity-90"
                                style={{ background: "linear-gradient(135deg,#11B8EA,#3B6AE8)" }}>
                                Open My Portal <ExternalLink size={14} />
                            </a>
                        </div>
                    )}
                </motion.div>
            ) : (
                <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    onSubmit={async e => {
                        e.preventDefault();
                        const today = new Date().toISOString().slice(0, 10);
                        const contactStr = hasWhatsapp
                            ? `WhatsApp: ${contact.whatsapp}`
                            : [contact.gmail && `Gmail: ${contact.gmail}`, contact.instagram && `Instagram: ${contact.instagram}`, contact.linkedin && `LinkedIn: ${contact.linkedin}`].filter(Boolean).join(" · ") || "No contact provided";
                        const fullMessage = [form.message, form.problem && `— Business Problem:\n${form.problem}`].filter(Boolean).join("\n\n") + `\n\n— Contact: ${contactStr}`;
                        const submission = { id: Date.now(), name: form.name, company: form.company, need: form.need, budget: form.budget, message: fullMessage, date: today, status: "new" };
                        onSubmit(submission);
                        fetch("/api/notify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(submission),
                        }).catch(() => {});
                        // Create deal immediately so client has a token
                        try {
                            const res = await fetch("/api/deals", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ submissionId: submission.id, name: submission.name, company: submission.company, need: submission.need, budget: submission.budget, message: submission.message }),
                            });
                            const data = await res.json();
                            if (data.token) {
                                localStorage.setItem("synapsis_client_token", data.token);
                                setPortalToken(data.token);
                            }
                        } catch { /* non-blocking */ }
                        setDone(true);
                    }}
                    className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelCls}>Name</label><input required placeholder="Your name" value={form.name} onChange={e => u("name")(e.target.value)} className={inputCls} /></div>
                        <div><label className={labelCls}>Company</label><input placeholder="Your company" value={form.company} onChange={e => u("company")(e.target.value)} className={inputCls} /></div>
                    </div>
                    <div>
                        <label className={labelCls}>What do you need?</label>
                        <select required value={form.need} onChange={e => u("need")(e.target.value)} className={inputCls + " appearance-none"}>
                            <option value="" className="bg-[#0A0F1E]">Select a service</option>
                            <option value="ai" className="bg-[#0A0F1E]">AI & Automation</option>
                            <option value="fullstack" className="bg-[#0A0F1E]">Full Stack Development</option>
                            <option value="ecosystem" className="bg-[#0A0F1E]">Digital Ecosystem Architecture</option>
                            <option value="payment" className="bg-[#0A0F1E]">Payment Integration</option>
                            <option value="api" className="bg-[#0A0F1E]">API Integration</option>
                            <option value="other" className="bg-[#0A0F1E]">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Budget (optional)</label>
                        <select value={form.budget} onChange={e => u("budget")(e.target.value)} className={inputCls + " appearance-none"}>
                            <option value="" className="bg-[#0A0F1E]">Prefer not to say</option>
                            <option value="<50k" className="bg-[#0A0F1E]">Under ₹50,000</option>
                            <option value="50-150k" className="bg-[#0A0F1E]">₹50,000 – ₹1,50,000</option>
                            <option value="150-500k" className="bg-[#0A0F1E]">₹1,50,000 – ₹5,00,000</option>
                            <option value="500k+" className="bg-[#0A0F1E]">₹5,00,000+</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Message</label>
                        <textarea required rows={4} placeholder="Tell me about your project, the problem you're solving, and what success looks like." value={form.message} onChange={e => u("message")(e.target.value)} className={inputCls + " resize-none"} />
                    </div>
                    <div>
                        <label className={labelCls}>Core Business Problem</label>
                        <textarea rows={3} placeholder="What is the core business problem you're dealing with, and what exactly are you expecting from us?" value={form.problem} onChange={e => u("problem")(e.target.value)} className={inputCls + " resize-none"} />
                    </div>

                    {/* Contact preference */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                        <label className={labelCls + " mb-3"}>How should I reach you back?</label>
                        <p className="text-white/30 text-xs leading-relaxed mb-4">
                            I typically respond via WhatsApp — it's the fastest way to connect and discuss your project directly.
                            Do you have WhatsApp?
                        </p>
                        <div className="flex gap-3 mb-4">
                            <button type="button" onClick={() => setHasWhatsapp(true)}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${hasWhatsapp === true ? "bg-[#11B8EA]/10 border-[#11B8EA]/40 text-[#11B8EA]" : "border-white/10 text-white/35 hover:border-white/25"}`}>
                                Yes, I'm on WhatsApp
                            </button>
                            <button type="button" onClick={() => setHasWhatsapp(false)}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${hasWhatsapp === false ? "bg-white/8 border-white/25 text-white" : "border-white/10 text-white/35 hover:border-white/25"}`}>
                                No, I don't
                            </button>
                        </div>

                        <AnimatePresence>
                            {hasWhatsapp === true && (
                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                                    <label className={labelCls}>Your WhatsApp number</label>
                                    <input required placeholder="+91 98765 43210" value={contact.whatsapp}
                                        onChange={e => setContact(c => ({ ...c, whatsapp: e.target.value }))}
                                        className={inputCls} />
                                </motion.div>
                            )}
                            {hasWhatsapp === false && (
                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-col gap-3">
                                    <p className="text-white/25 text-xs">No problem — share whichever you're comfortable with and I'll reach out from there.</p>
                                    <input placeholder="Gmail address" value={contact.gmail}
                                        onChange={e => setContact(c => ({ ...c, gmail: e.target.value }))}
                                        className={inputCls} />
                                    <input placeholder="Instagram handle (optional)" value={contact.instagram}
                                        onChange={e => setContact(c => ({ ...c, instagram: e.target.value }))}
                                        className={inputCls} />
                                    <input placeholder="LinkedIn profile URL (optional)" value={contact.linkedin}
                                        onChange={e => setContact(c => ({ ...c, linkedin: e.target.value }))}
                                        className={inputCls} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button type="submit"
                        className="w-full py-4 rounded-xl text-sm font-semibold text-[#0A0F1E] hover:opacity-90 transition-all mt-1"
                        style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}>
                        Send Message →
                    </button>
                    <p className="text-center text-[11px] text-white/18 mt-1">Response within 48 hours. No agency overhead.</p>
                </motion.form>
            )}
        </div>
    );
}

// ─── INTERESTED CHAT MODAL ───────────────────────────────────────────────────

interface ChatMsg { role: "user" | "assistant"; content: string; }

function InterestedChatModal({ sub, deal, onClose, onElect, onUpdateDeal }: {
    sub: { name: string; company: string; need: string; budget: string; message: string };
    deal: Deal;
    onClose: () => void;
    onElect: (projectDays: number) => Promise<void>;
    onUpdateDeal: (token: string, updates: Partial<Deal>) => void;
}) {
    const [messages, setMessages] = useState<ChatMsg[]>(() => deal.interestChatHistory || []);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [questions, setQuestions] = useState<string[]>(() => deal.customQuestions || Array(6).fill(""));
    const [projectDays, setProjectDays] = useState(String(deal.projectDays || "90"));
    const [electing, setElecting] = useState(false);
    const [saved, setSaved] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    const clientContext = { name: sub.name, company: sub.company, need: sub.need, budget: sub.budget, message: sub.message };

    // Auto-scroll chat
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // First message on open if no history
    useEffect(() => {
        if (messages.length === 0) {
            const init: ChatMsg = {
                role: "user",
                content: `New client just came in. Here's a quick summary:\n\nName: ${sub.name}\nCompany: ${sub.company}\nWhat they need: ${sub.need}\nBudget: ${sub.budget || "not specified"}\nMessage: ${sub.message}\n\nHelp me build the right 6 questions for this specific client.`,
            };
            sendToGroq([init], init);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sendToGroq = async (history: ChatMsg[], userMsg: ChatMsg) => {
        setSending(true);
        const updated = [...history];
        if (!updated.find(m => m === userMsg)) updated.push(userMsg);
        setMessages(updated);

        try {
            const res = await fetch("/api/groq-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: updated, clientContext }),
            });
            const data = await res.json();
            const aiMsg: ChatMsg = { role: "assistant", content: data.content || "Error getting response." };
            const final = [...updated, aiMsg];
            setMessages(final);
            // Persist chat history to deal
            await fetch("/api/deals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: deal.token, interestChatHistory: final }),
            });
            onUpdateDeal(deal.token, { interestChatHistory: final });
        } catch {
            setMessages(h => [...h, { role: "assistant", content: "Failed to reach Kimi K2. Check your GROQ_API_KEY." }]);
        } finally {
            setSending(false);
        }
    };

    const handleSend = () => {
        if (!input.trim() || sending) return;
        const msg: ChatMsg = { role: "user", content: input.trim() };
        setInput("");
        sendToGroq(messages, msg);
    };

    const handleSuggestAll = () => {
        const msg: ChatMsg = {
            role: "user",
            content: "Based on everything we know about this client, give me all 6 final questions right now — clean, numbered, ready to send.",
        };
        setInput("");
        sendToGroq(messages, msg);
    };

    const saveQuestions = async () => {
        const qs = questions.filter(q => q.trim());
        await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deal.token, customQuestions: qs }),
        });
        onUpdateDeal(deal.token, { customQuestions: qs });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleFinalizeElect = async () => {
        const qs = questions.filter(q => q.trim());
        const days = Math.max(1, parseInt(projectDays) || 90);
        if (qs.length < 6) { alert("Fill all 6 questions before electing."); return; }
        setElecting(true);
        // Save questions + elect
        await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deal.token, customQuestions: qs }),
        });
        onUpdateDeal(deal.token, { customQuestions: qs });
        await onElect(days);
        setElecting(false);
    };

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/85 backdrop-blur-md z-50"
                onClick={onClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 20 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-3 md:inset-6 bg-[#060A14] border border-white/10 rounded-2xl z-50 flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[10px] tracking-[0.4em] uppercase font-bold text-amber-400/70">Question Builder</span>
                        <span className="text-white/20 text-xs">·</span>
                        <span className="text-white/50 text-sm font-medium">{sub.name} · {sub.company}</span>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 hover:bg-white/8 flex items-center justify-center transition-colors">
                        <X size={13} className="text-white/50" />
                    </button>
                </div>

                {/* Body — split layout */}
                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT — Questions panel */}
                    <div className="w-[340px] shrink-0 border-r border-white/8 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-5">
                            <p className="text-[9px] tracking-[0.35em] uppercase text-white/25 font-bold mb-4">6 Questions Draft</p>
                            <div className="flex flex-col gap-3">
                                {questions.map((q, i) => (
                                    <div key={i}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: q.trim() ? "#11B8EA" : "rgba(255,255,255,0.2)" }}>
                                                Q{i + 1}
                                            </span>
                                            {q.trim() && <span className="text-[8px] text-emerald-400/60">✓</span>}
                                        </div>
                                        <textarea
                                            rows={3}
                                            placeholder={`Question ${i + 1}...`}
                                            value={q}
                                            onChange={e => setQuestions(qs => qs.map((x, j) => j === i ? e.target.value : x))}
                                            className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-white/70 text-[11px] outline-none focus:border-[#11B8EA]/30 transition-colors resize-none placeholder:text-white/15 leading-relaxed"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Save questions */}
                        <div className="p-4 border-t border-white/8 flex flex-col gap-3 shrink-0">
                            <button
                                onClick={saveQuestions}
                                className="w-full py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all"
                                style={{ background: saved ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${saved ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`, color: saved ? "#10b981" : "rgba(255,255,255,0.4)" }}
                            >
                                {saved ? "Saved ✓" : "Save Draft"}
                            </button>

                            <div>
                                <p className="text-[9px] tracking-[0.25em] uppercase text-white/20 mb-1.5">Project Duration (days)</p>
                                <input
                                    type="number" min="1"
                                    value={projectDays}
                                    onChange={e => setProjectDays(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 outline-none focus:border-[#11B8EA]/40 transition-colors mb-2"
                                />
                            </div>

                            <button
                                onClick={handleFinalizeElect}
                                disabled={electing || questions.filter(q => q.trim()).length < 6}
                                className="w-full py-3 rounded-xl text-[11px] font-black tracking-[0.3em] uppercase transition-all disabled:opacity-30"
                                style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)", color: "#0A0F1E" }}
                            >
                                {electing ? "Electing…" : "Finalize & Elect →"}
                            </button>
                        </div>
                    </div>

                    {/* RIGHT — Kimi K2 Chat */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Chat messages */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                            {messages.length === 0 && (
                                <div className="flex-1 flex items-center justify-center opacity-20">
                                    <p className="text-xs tracking-widest uppercase">Connecting to Kimi K2…</p>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {msg.role === "assistant" && (
                                        <div className="w-6 h-6 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 mr-2 mt-1">
                                            <span className="text-[8px] font-black text-amber-400">K</span>
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user"
                                            ? "bg-[#11B8EA]/15 border border-[#11B8EA]/20 text-white/80"
                                            : "bg-white/[0.04] border border-white/8 text-white/75"
                                        }`}
                                    >
                                        {msg.content}
                                    </div>
                                </motion.div>
                            ))}
                            {sending && (
                                <div className="flex justify-start items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                                        <span className="text-[8px] font-black text-amber-400">K</span>
                                    </div>
                                    <div className="flex gap-1 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/8">
                                        {[0,1,2].map(i => (
                                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div ref={chatBottomRef} />
                        </div>

                        {/* Input bar */}
                        <div className="p-4 border-t border-white/8 shrink-0">
                            <div className="flex gap-2 mb-2">
                                <button
                                    onClick={handleSuggestAll}
                                    disabled={sending}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-40"
                                    style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "rgba(245,158,11,0.8)" }}
                                >
                                    Suggest All 6 →
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Chat with Kimi K2..."
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                                    disabled={sending}
                                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#11B8EA]/30 transition-colors placeholder:text-white/20 disabled:opacity-50"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || sending}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                                    style={{ background: "rgba(17,184,234,0.15)", border: "1px solid rgba(17,184,234,0.25)" }}
                                >
                                    <Send size={14} className="text-[#11B8EA]" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

// ─── INBOX VIEW ───────────────────────────────────────────────────────────────

function InboxView({ submissions, onDelete, deals, onElect, onReject, onOpenWorkspace, onUpdateDeal, onInterested }: {
    submissions: Submission[];
    onDelete: (id: number) => void;
    deals: Deal[];
    onElect: (sub: Submission, projectDays: number) => Promise<void>;
    onReject: (sub: Submission, note?: string) => Promise<void>;
    onOpenWorkspace: (token: string) => Promise<void>;
    onUpdateDeal: (token: string, updates: Partial<Deal>) => void;
    onInterested: (sub: Submission) => Promise<Deal>;
}) {
    const [active, setActive] = useState<Submission | null>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [actioning, setActioning] = useState<"elect" | "reject" | "interested" | null>(null);
    const [copied, setCopied] = useState(false);
    const [electDays, setElectDays] = useState<string>("90");
    const [inboxDaysInput, setInboxDaysInput] = useState<string>("");
    const [inboxDaysSaved, setInboxDaysSaved] = useState(false);
    const [chatModalSub, setChatModalSub] = useState<Submission | null>(null);

    // Sync input when opening a different deal
    React.useEffect(() => {
        const deal = active ? getDeal(active.id) : null;
        setInboxDaysInput(deal?.projectDays ? String(deal.projectDays) : "");
        setInboxDaysSaved(false);
    }, [active?.id]);

    const PHASE_WEIGHTS = [
        { name: "DISCOVER",  w: 0.08 },
        { name: "BLUEPRINT", w: 0.10 },
        { name: "DESIGN",    w: 0.14 },
        { name: "BUILD",     w: 0.48 },
        { name: "POLISH",    w: 0.12 },
        { name: "IGNITION",  w: 0.05 },
        { name: "ORBIT",     w: 0.03 },
    ];

    const calcSplit = (total: number) => {
        const working = Math.floor(total * 0.75);
        return PHASE_WEIGHTS.map(p => ({ name: p.name, days: Math.max(1, Math.round(working * p.w)) }));
    };

    const saveInboxDays = async (token: string, currentDealDays?: number) => {
        const effectiveInput = inboxDaysInput || (currentDealDays ? String(currentDealDays) : "");
        const val = parseInt(effectiveInput);
        if (!val || val < 1) return;
        const res = await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, projectDays: val }),
        });
        if (res.ok) {
            onUpdateDeal(token, { projectDays: val });
            setInboxDaysSaved(true);
            setTimeout(() => setInboxDaysSaved(false), 2000);
        }
    };
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const scroll = (dir: "left" | "right") => {
        scrollRef.current?.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
    };

    const statusCls = (s: string) =>
        s === "new" ? "bg-[#11B8EA]/10 text-[#11B8EA] border-[#11B8EA]/30"
        : s === "replied" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
        : "bg-white/5 text-white/25 border-white/10";

    const newCount = submissions.filter(s => s.status === "new").length;
    const getDeal = (subId: number) => deals.find(d => d.submissionId === subId);

    const handleElect = async (sub: Submission, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setActioning("elect");
        try { await onElect(sub, Math.max(1, parseInt(electDays) || 90)); } finally { setActioning(null); }
    };
    const handleReject = async (sub: Submission, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setActioning("reject");
        try { await onReject(sub, rejectNote); setRejectNote(""); } finally { setActioning(null); }
    };
    const handleInterested = async (sub: Submission, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setActioning("interested");
        try {
            await onInterested(sub);
            setChatModalSub(sub);
            setActive(null);
        } finally { setActioning(null); }
    };

    const copyPortalLink = (token: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(`${window.location.origin}/client/${token}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const PHASE_NAMES = ["Signal","Discover","Blueprint","Ignition","Build","Deliver","Handover","Orbit"];

    const dealBadge = (deal: Deal) => {
        if (deal.status === "proceeding" || deal.status === "active") {
            const phaseName = PHASE_NAMES[deal.phase] || `Phase ${deal.phase}`;
            return { label: `Phase ${deal.phase} · ${phaseName}`, color: "#3B6AE8" };
        }
        const map: Record<string, { label: string; color: string }> = {
            pending: { label: "Signal Active", color: "#11B8EA" },
            interested: { label: "In Review ✦", color: "#f59e0b" },
            elected: { label: "Elected ✓", color: "#10b981" },
            rejected: { label: "Rejected", color: "#ef4444" },
            expired: { label: "Expired", color: "#6b7280" },
        };
        return map[deal.status] || { label: deal.status, color: "#6b7280" };
    };

    const isActiveWorkspace = (deal: Deal) => deal.status === "proceeding" || deal.status === "active";

    return (
        <div className="p-8">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-end justify-between">
                <div>
                    <p className="text-[10px] tracking-[0.4em] uppercase text-[#11B8EA] mb-1">Admin</p>
                    <h1 className="font-serif text-5xl text-white">Inbox</h1>
                </div>
                <div className="flex items-center gap-3">
                    {newCount > 0 && (
                        <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-[#11B8EA]/10 text-[#11B8EA] border border-[#11B8EA]/25">
                            {newCount} new
                        </span>
                    )}
                    <button onClick={() => scroll("left")}
                        className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 flex items-center justify-center transition-all">
                        <ChevronRight size={14} className="text-white/50 rotate-180" />
                    </button>
                    <button onClick={() => scroll("right")}
                        className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 flex items-center justify-center transition-all">
                        <ChevronRight size={14} className="text-white/50" />
                    </button>
                </div>
            </motion.div>

            <LayoutGroup>
                <div className="relative">
                <div ref={scrollRef} className="flex gap-4 overflow-x-auto py-4 -my-4 scrollbar-hide">
                    {submissions.map((sub, i) => {
                        if (active?.id === sub.id) return null;
                        const deal = getDeal(sub.id);
                        const badge = deal ? dealBadge(deal) : null;
                        return (
                            <motion.article
                                key={sub.id}
                                layoutId={`inbox-${sub.id}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                onClick={() => setActive(sub)}
                                className="group cursor-pointer rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300 shrink-0 w-72"
                                whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                            >
                                <motion.div layoutId={`inbox-body-${sub.id}`} className="p-5">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-sm font-semibold text-white/60 shrink-0">
                                                {sub.name[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <motion.h3 layoutId={`inbox-name-${sub.id}`} className="font-serif text-lg text-white leading-tight group-hover:text-[#11B8EA] transition-colors">
                                                    {sub.name}
                                                </motion.h3>
                                                <p className="text-white/30 text-[11px]">{sub.company}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border ${statusCls(sub.status)}`}>
                                                {sub.status === "new" && <span className="w-1.5 h-1.5 rounded-full bg-[#11B8EA] animate-pulse" />}
                                                {sub.status}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(sub.id); }}
                                                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/50 flex items-center justify-center transition-all"
                                            >
                                                <X size={10} className="text-red-400" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Need + Budget tags */}
                                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#3B6AE8]/10 text-[#3B6AE8] border border-[#3B6AE8]/20">
                                            {sub.need}
                                        </span>
                                        {sub.budget && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-white/35 border border-white/8">
                                                {sub.budget}
                                            </span>
                                        )}
                                    </div>

                                    {/* Message preview */}
                                    <p className="text-white/40 text-xs line-clamp-2 leading-relaxed">
                                        {sub.message.split("\n\n—")[0]}
                                    </p>

                                    <p className="text-white/20 text-[10px] mt-3">{sub.date}</p>

                                    {/* Deal status OR elect/reject buttons */}
                                    <div className="mt-3 pt-3 border-t border-white/6">
                                        {deal ? (
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-bold tracking-widest uppercase truncate" style={{ color: badge!.color }}>
                                                    {badge!.label}
                                                </span>
                                                {isActiveWorkspace(deal) ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onOpenWorkspace(deal.token); }}
                                                        className="shrink-0 flex items-center gap-1 text-[9px] px-2.5 py-1 rounded-md font-bold tracking-widest uppercase transition-all"
                                                        style={{ background: "rgba(59,106,232,0.15)", color: "#3B6AE8", border: "1px solid rgba(59,106,232,0.3)" }}
                                                    >
                                                        Open →
                                                    </button>
                                                ) : deal.status === "interested" ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setChatModalSub(sub); }}
                                                        className="shrink-0 flex items-center gap-1 text-[9px] px-2.5 py-1 rounded-md font-bold tracking-widest uppercase transition-all"
                                                        style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
                                                    >
                                                        Build Qs →
                                                    </button>
                                                ) : (deal.status === "pending" || deal.status === "elected") && (
                                                    <button
                                                        onClick={(e) => copyPortalLink(deal.token, e)}
                                                        className="shrink-0 text-[9px] px-2 py-0.5 rounded-md border border-white/10 text-white/30 hover:border-white/25 hover:text-white/55 transition-all"
                                                    >
                                                        Copy Link
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={(e) => handleInterested(sub, e)}
                                                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
                                                    style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b" }}
                                                >
                                                    Interested
                                                </button>
                                                <button
                                                    onClick={(e) => handleReject(sub, e)}
                                                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase border border-red-500/20 text-red-400/60 hover:border-red-500/40 hover:text-red-400 transition-all"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </motion.article>
                        );
                    })}
                </div>
                </div>

                {/* Expanded modal */}
                <AnimatePresence>
                    {active && (() => {
                        const deal = getDeal(active.id);
                        const badge = deal ? dealBadge(deal) : null;
                        return (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40"
                                onClick={() => setActive(null)}
                            />
                            <motion.div
                                layoutId={`inbox-${active.id}`}
                                className="fixed inset-4 md:inset-8 lg:inset-16 bg-[#070B16] border border-white/10 rounded-2xl overflow-hidden z-50 flex flex-col"
                            >
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors"
                                    onClick={() => setActive(null)}
                                >
                                    <X size={14} className="text-white/70" />
                                </motion.button>

                                <div className="flex flex-col h-full overflow-y-auto">
                                    {/* Top strip — colour reflects deal status */}
                                    <div
                                        className="h-1.5 w-full shrink-0"
                                        style={{
                                            background: deal?.status === "elected" ? "linear-gradient(90deg,#10b981,#059669)"
                                                : deal?.status === "rejected" ? "linear-gradient(90deg,#ef4444,#b91c1c)"
                                                : deal?.status === "interested" ? "linear-gradient(90deg,#f59e0b,#d97706)"
                                                : deal?.status === "pending" ? "linear-gradient(90deg,#11B8EA,#3B6AE8)"
                                                : active.status === "new" ? "linear-gradient(90deg,#11B8EA,#3B6AE8)"
                                                : active.status === "replied" ? "linear-gradient(90deg,#10b981,#059669)"
                                                : "rgba(255,255,255,0.06)"
                                        }}
                                    />

                                    <motion.div layoutId={`inbox-body-${active.id}`} className="p-8 flex-1">
                                        <div className="flex items-start gap-5 mb-8">
                                            <div className="w-14 h-14 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-xl font-semibold text-white/60 shrink-0">
                                                {active.name[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <motion.h2 layoutId={`inbox-name-${active.id}`} className="font-serif text-4xl text-white mb-1">
                                                    {active.name}
                                                </motion.h2>
                                                <p className="text-white/40 text-sm">{active.company} · {active.need}</p>
                                                <p className="text-white/25 text-xs mt-0.5">Budget: {active.budget || "Not specified"} · {active.date}</p>
                                            </div>
                                            {/* Deal status badge in modal header */}
                                            {deal && (
                                                <div className="shrink-0 flex flex-col items-end gap-1.5">
                                                    <span className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border"
                                                        style={{ color: badge!.color, borderColor: `${badge!.color}30`, background: `${badge!.color}10` }}>
                                                        {badge!.label}
                                                    </span>
                                                    {(deal.status === "pending" || deal.status === "elected") && (
                                                        <button
                                                            onClick={(e) => copyPortalLink(deal.token, e)}
                                                            className="text-[9px] px-2 py-1 rounded-lg border border-white/10 text-white/35 hover:border-white/25 hover:text-white/60 transition-all font-mono"
                                                        >
                                                            {copied ? "Copied ✓" : `/client/${deal.token}`}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="h-px bg-white/8 mb-8" />

                                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                            {/* Tags row */}
                                            <div className="flex gap-2 flex-wrap mb-6">
                                                <span className="text-[11px] px-3 py-1 rounded-lg bg-[#3B6AE8]/10 text-[#3B6AE8] border border-[#3B6AE8]/20">{active.need}</span>
                                                {active.budget && <span className="text-[11px] px-3 py-1 rounded-lg bg-white/5 text-white/40 border border-white/10">{active.budget}</span>}
                                            </div>

                                            <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-3">Message</p>
                                            <p className="text-white/65 text-sm leading-relaxed whitespace-pre-line mb-8">
                                                {active.message.split("\n\n—")[0]}
                                            </p>

                                            {/* Business Problem */}
                                            {active.message.includes("— Business Problem:") && (
                                                <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(59,106,232,0.04)", border: "1px solid rgba(59,106,232,0.15)" }}>
                                                    <p className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: "rgba(59,106,232,0.7)" }}>Core Business Problem</p>
                                                    <p className="text-white/60 text-sm leading-relaxed">
                                                        {active.message.split("— Business Problem:\n")[1]?.split("\n\n—")[0]?.trim()}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Contact info */}
                                            {active.message.includes("— Contact:") && (
                                                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 mb-8">
                                                    <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-2">Contact</p>
                                                    <p className="text-white/55 text-sm">
                                                        {active.message.split("— Contact:")[1]?.trim()}
                                                    </p>
                                                </div>
                                            )}
                                        </motion.div>

                                        {/* ── ELECT / REJECT ACTION BLOCK ── */}
                                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                                            {!deal ? (
                                                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 mb-6">
                                                    <p className="text-[10px] tracking-[0.4em] uppercase text-white/20 mb-4">Decision</p>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="flex-1">
                                                            <p className="text-[9px] tracking-[0.25em] uppercase text-white/20 mb-1.5">Project Duration (days)</p>
                                                            <input
                                                                type="number" min="1"
                                                                value={electDays}
                                                                onChange={e => setElectDays(e.target.value)}
                                                                className="w-full bg-white/5 border border-[#11B8EA]/20 rounded-xl px-4 py-2.5 text-sm text-white/80 outline-none focus:border-[#11B8EA]/50 transition-colors"
                                                                placeholder="e.g. 90"
                                                            />
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-[9px] text-white/20 mb-0.5">working budget</p>
                                                            <p className="text-sm font-bold" style={{ color: "#11B8EA" }}>{Math.floor((parseInt(electDays) || 0) * 0.75)}d</p>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        placeholder="Rejection note (optional) — shown to client if you reject"
                                                        value={rejectNote}
                                                        onChange={e => setRejectNote(e.target.value)}
                                                        rows={2}
                                                        className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-white/70 placeholder:text-white/15 outline-none focus:border-white/20 resize-none mb-4 transition-colors"
                                                    />
                                                    <div className="flex gap-3">
                                                        <button
                                                            disabled={actioning !== null}
                                                            onClick={() => handleInterested(active)}
                                                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase disabled:opacity-50 transition-all"
                                                            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}
                                                        >
                                                            {actioning === "interested" ? <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" /> : <Zap size={14} />}
                                                            Interested
                                                        </button>
                                                        <button
                                                            disabled={actioning !== null}
                                                            onClick={() => handleElect(active)}
                                                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase text-[#0A0F1E] hover:opacity-90 disabled:opacity-50 transition-all"
                                                            style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}
                                                        >
                                                            {actioning === "elect" ? <div className="w-4 h-4 rounded-full border-2 border-[#0A0F1E] border-t-transparent animate-spin" /> : <Check size={14} />}
                                                            Elect
                                                        </button>
                                                        <button
                                                            disabled={actioning !== null}
                                                            onClick={() => handleReject(active)}
                                                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold tracking-widest uppercase border border-red-500/25 text-red-400/70 hover:border-red-500/50 hover:text-red-400 disabled:opacity-50 transition-all"
                                                        >
                                                            {actioning === "reject" ? <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" /> : <X size={14} />}
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : deal.status === "elected" ? (
                                                <div className="mb-6 flex flex-col gap-4">
                                                    {/* Timeline editor */}
                                                    <div className="rounded-2xl border border-[#11B8EA]/15 bg-[#11B8EA]/[0.02] p-5">
                                                        <p className="text-[9px] tracking-[0.35em] uppercase text-white/20 mb-3">Project Timeline</p>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <input
                                                                type="number" min="1"
                                                                value={inboxDaysInput}
                                                                onChange={e => setInboxDaysInput(e.target.value)}
                                                                onKeyDown={e => e.key === "Enter" && saveInboxDays(deal.token, deal.projectDays)}
                                                                placeholder="Enter total project days"
                                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/80 outline-none focus:border-[#11B8EA]/40 transition-colors"
                                                            />
                                                            <button onClick={() => saveInboxDays(deal.token, deal.projectDays)}
                                                                className="px-4 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all shrink-0"
                                                                style={{ background: inboxDaysSaved ? "rgba(16,185,129,0.15)" : "rgba(17,184,234,0.12)", border: `1px solid ${inboxDaysSaved ? "rgba(16,185,129,0.3)" : "rgba(17,184,234,0.25)"}`, color: inboxDaysSaved ? "#10b981" : "#11B8EA" }}>
                                                                {inboxDaysSaved ? "Saved ✓" : "Save"}
                                                            </button>
                                                        </div>
                                                        {/* Phase split preview */}
                                                        {(() => {
                                                            const raw = inboxDaysInput;
                                                            const total = parseInt(raw);
                                                            if (!total || total < 1) return null;
                                                            const split = calcSplit(total);
                                                            return (
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <p className="text-[9px] text-white/20">working budget: <span style={{ color: "#11B8EA" }}>{Math.floor(total * 0.75)}d</span></p>
                                                                        <p className="text-[9px] text-white/20">buffer: <span className="text-white/35">{Math.ceil(total * 0.25)}d</span></p>
                                                                    </div>
                                                                    {split.map(p => (
                                                                        <div key={p.name} className="flex items-center gap-2">
                                                                            <span className="text-[9px] font-black tracking-wider w-20 shrink-0" style={{ color: "rgba(17,184,234,0.5)" }}>{p.name}</span>
                                                                            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                                                                                <div className="h-full rounded-full" style={{ width: `${(p.days / Math.floor(total * 0.75)) * 100}%`, background: "linear-gradient(90deg,#3B6AE8,#11B8EA)" }} />
                                                                            </div>
                                                                            <span className="text-[9px] text-white/35 w-8 text-right shrink-0">{p.days}d</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={() => { setActive(null); onOpenWorkspace(deal.token); }}
                                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                                                            style={{ background: "linear-gradient(135deg,#3B6AE8,#11B8EA)", color: "#fff" }}
                                                        >
                                                            Enter Workspace <ArrowRight size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : isActiveWorkspace(deal) ? (
                                                <div className="rounded-2xl p-5 mb-6 flex items-center justify-between gap-4" style={{ background: "rgba(59,106,232,0.05)", border: "1px solid rgba(59,106,232,0.2)" }}>
                                                    <div>
                                                        <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: "rgba(59,106,232,0.7)" }}>Active Engagement</p>
                                                        <p className="text-white/50 text-sm">{PHASE_NAMES[deal.phase] || `Phase ${deal.phase}`} · Phase {deal.phase}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => { setActive(null); onOpenWorkspace(deal.token); }}
                                                        className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                                                        style={{ background: "linear-gradient(135deg,#3B6AE8,#11B8EA)", color: "#fff" }}
                                                    >
                                                        Enter Workspace <ArrowRight size={14} />
                                                    </button>
                                                </div>
                                            ) : deal.status === "interested" ? (
                                                <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                                    <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: "rgba(245,158,11,0.7)" }}>In Review — Timer Paused</p>
                                                    <p className="text-white/30 text-xs mb-4">You&apos;re building custom questions with Kimi K2 for this client.</p>
                                                    <button
                                                        onClick={() => { setActive(null); setChatModalSub(active); }}
                                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold tracking-widest uppercase transition-all"
                                                        style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}
                                                    >
                                                        Open Question Builder →
                                                    </button>
                                                </div>
                                            ) : deal.status === "rejected" ? (
                                                <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                                                    <p className="text-[10px] tracking-widest uppercase text-red-400/60 mb-1">Rejected</p>
                                                    {deal.rejectionNote && <p className="text-white/35 text-sm italic">"{deal.rejectionNote}"</p>}
                                                </div>
                                            ) : deal.status === "pending" ? (
                                                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 mb-6">
                                                    <p className="text-[10px] tracking-[0.4em] uppercase text-white/20 mb-1">Signal Active — Timer Running</p>
                                                    <p className="text-white/30 text-xs mb-4">Client portal is live. Elect or reject before time expires.</p>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="flex-1">
                                                            <p className="text-[9px] tracking-[0.25em] uppercase text-white/20 mb-1.5">Project Duration (days)</p>
                                                            <input
                                                                type="number" min="1"
                                                                value={electDays}
                                                                onChange={e => setElectDays(e.target.value)}
                                                                className="w-full bg-white/5 border border-[#11B8EA]/20 rounded-xl px-4 py-2.5 text-sm text-white/80 outline-none focus:border-[#11B8EA]/50 transition-colors"
                                                                placeholder="e.g. 90"
                                                            />
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-[9px] text-white/20 mb-0.5">working budget</p>
                                                            <p className="text-sm font-bold" style={{ color: "#11B8EA" }}>{Math.floor((parseInt(electDays) || 0) * 0.75)}d</p>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        placeholder="Rejection note (optional)"
                                                        value={rejectNote}
                                                        onChange={e => setRejectNote(e.target.value)}
                                                        rows={2}
                                                        className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-white/70 placeholder:text-white/15 outline-none focus:border-white/20 resize-none mb-4 transition-colors"
                                                    />
                                                    <div className="flex gap-3">
                                                        <button
                                                            disabled={actioning !== null}
                                                            onClick={() => handleElect(active)}
                                                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold tracking-widest uppercase text-[#0A0F1E] hover:opacity-90 disabled:opacity-50 transition-all"
                                                            style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}
                                                        >
                                                            {actioning === "elect" ? <div className="w-4 h-4 rounded-full border-2 border-[#0A0F1E] border-t-transparent animate-spin" /> : <Check size={14} />}
                                                            Elect
                                                        </button>
                                                        <button
                                                            disabled={actioning !== null}
                                                            onClick={() => handleReject(active)}
                                                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold tracking-widest uppercase border border-red-500/25 text-red-400/70 hover:border-red-500/50 hover:text-red-400 disabled:opacity-50 transition-all"
                                                        >
                                                            {actioning === "reject" ? <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" /> : <X size={14} />}
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </motion.div>

                                        {/* Bottom actions */}
                                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex gap-3 flex-wrap">
                                            <a
                                                href={`mailto:?subject=Re: Your project enquiry&body=Hi ${active.name.split(" ")[0]},`}
                                                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#0A0F1E] hover:opacity-90 transition-opacity"
                                                style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}
                                            >
                                                <Mail size={14} /> Reply via Email
                                            </a>
                                            <a
                                                href={`https://wa.me/?text=Hi ${active.name.split(" ")[0]}, thanks for reaching out!`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white border border-white/15 hover:border-white/30 transition-colors"
                                            >
                                                <MessageSquare size={14} /> WhatsApp
                                            </a>
                                            <button
                                                onClick={() => { setActive(null); onDelete(active.id); }}
                                                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-red-400/60 border border-red-500/10 hover:border-red-500/25 hover:text-red-400 transition-colors ml-auto"
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </motion.div>
                                    </motion.div>
                                </div>
                            </motion.div>
                        </>
                        );
                    })()}
                </AnimatePresence>
            </LayoutGroup>

            {/* Interested Chat Modal */}
            <AnimatePresence>
                {chatModalSub && (() => {
                    const deal = getDeal(chatModalSub.id);
                    if (!deal) return null;
                    return (
                        <InterestedChatModal
                            key={deal.token}
                            sub={chatModalSub}
                            deal={deal}
                            onClose={() => setChatModalSub(null)}
                            onElect={async (days) => {
                                await onElect(chatModalSub, days);
                                setChatModalSub(null);
                            }}
                            onUpdateDeal={onUpdateDeal}
                        />
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}

// ─── MANAGE PROJECTS VIEW ─────────────────────────────────────────────────────

// ─── DROP ZONE ────────────────────────────────────────────────────────────────

function DropZone({ label, accept, value, onChange }: {
    label: string;
    accept: string;
    value: string;
    onChange: (url: string) => void;
}) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const upload = async (file: File) => {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (data.url) onChange(data.url);
        } finally {
            setUploading(false);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) upload(file);
    };

    const onPaste = (e: React.ClipboardEvent) => {
        const file = e.clipboardData.files[0];
        if (file) upload(file);
    };

    const isVideo = accept.includes("video");

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/25">{label}</span>
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onPaste={onPaste}
                onClick={() => !value && inputRef.current?.click()}
                className={`relative rounded-xl border border-dashed transition-all cursor-pointer overflow-hidden
                    ${dragging ? "border-[#11B8EA]/60 bg-[#11B8EA]/5" : value ? "border-white/15 cursor-default" : "border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04]"}`}
                style={{ height: isVideo ? "80px" : "100px" }}
            >
                {value ? (
                    <>
                        {isVideo ? (
                            <video src={value} className="w-full h-full object-contain opacity-70" />
                        ) : (
                            <img src={value} alt="" className="w-full h-full object-contain" />
                        )}
                        {/* Remove button */}
                        <button
                            onClick={e => { e.stopPropagation(); onChange(""); }}
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 border border-white/20 flex items-center justify-center hover:bg-red-500/60 transition-colors"
                        >
                            <X size={9} className="text-white" />
                        </button>
                    </>
                ) : uploading ? (
                    <div className="flex items-center justify-center h-full gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-[#11B8EA] border-t-transparent animate-spin" />
                        <span className="text-white/30 text-xs">Uploading…</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-1 pointer-events-none">
                        <p className="text-white/20 text-xs">Drop, paste or <span className="text-[#11B8EA]/60">click to browse</span></p>
                    </div>
                )}
                <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </div>
        </div>
    );
}

// ─── MANAGE PROJECTS VIEW ─────────────────────────────────────────────────────

function ManageProjectsView({ projects, saveProject, deleteProject, updateProject }: { 
    projects: Project[]; 
    saveProject: (p: any) => void; 
    deleteProject: (id: number) => void;
    updateProject: (id: number, updates: any) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState({ name: "", tagline: "", summary: "", status: "BUILDING", stack: "", link: "", category: [] as string[], image1: "", image2: "", video: "", colors: "" });

    const inputCls = "w-full bg-white/5 border border-white/10 px-3 py-2.5 rounded-xl text-sm text-white outline-none focus:border-[#11B8EA]/50 transition-colors placeholder:text-white/20";

    const statusStyle = (s: string) =>
        s === "LIVE" ? "bg-[#11B8EA]/10 text-[#11B8EA] border-[#11B8EA]/25"
        : s === "BUILDING" ? "bg-[#3B6AE8]/10 text-[#3B6AE8] border-[#3B6AE8]/25"
        : "bg-white/5 text-white/25 border-white/10";

    return (
        <div className="p-8">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-end justify-between">
                <div>
                    <p className="text-[10px] tracking-[0.4em] uppercase text-[#11B8EA] mb-1">Admin</p>
                    <h1 className="font-serif text-5xl text-white">Projects</h1>
                </div>
                <button onClick={() => setAdding(v => !v)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0A0F1E] hover:opacity-90 transition-opacity"
                    style={{ background: "linear-gradient(135deg, #11B8EA, #3B6AE8)" }}>
                    <Plus size={14} /> Add Project
                </button>
            </motion.div>

            {/* Add form */}
            <AnimatePresence>
                {adding && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="mb-5 rounded-2xl border border-[#11B8EA]/20 bg-[#11B8EA]/[0.03] p-6">
                        <p className="text-[10px] tracking-[0.3em] uppercase text-[#11B8EA]/60 mb-4">New Project</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <input placeholder="Project name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className={inputCls} />
                            <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} className={inputCls + " appearance-none"}>
                                <option value="BUILDING" className="bg-[#0A0F1E]">BUILDING</option>
                                <option value="LIVE" className="bg-[#0A0F1E]">LIVE</option>
                                <option value="ARCHIVED" className="bg-[#0A0F1E]">ARCHIVED</option>
                            </select>
                        </div>
                        <input placeholder="One-line tagline" value={draft.tagline} onChange={e => setDraft(d => ({ ...d, tagline: e.target.value }))} className={inputCls + " mb-3"} />
                        <textarea placeholder="Summary paragraph (shown in project detail)" rows={2} value={draft.summary} onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))} className={inputCls + " mb-3 resize-none"} />
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <input placeholder="Stack (comma separated)" value={draft.stack} onChange={e => setDraft(d => ({ ...d, stack: e.target.value }))} className={inputCls} />
                            <input placeholder="Live URL (optional)" value={draft.link} onChange={e => setDraft(d => ({ ...d, link: e.target.value }))} className={inputCls} />
                        </div>
                        {/* Media uploads */}
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <DropZone label="Image 1 (thumbnail)" accept="image/*" value={draft.image1} onChange={v => setDraft(d => ({ ...d, image1: v }))} />
                            <DropZone label="Image 2 (optional)" accept="image/*" value={draft.image2} onChange={v => setDraft(d => ({ ...d, image2: v }))} />
                            <DropZone label="Video (optional)" accept="video/*" value={draft.video} onChange={v => setDraft(d => ({ ...d, video: v }))} />
                        </div>
                        <input placeholder="Colors (comma separated hex, e.g. #11B8EA,#3B6AE8)" value={draft.colors} onChange={e => setDraft(d => ({ ...d, colors: e.target.value }))} className={inputCls + " mb-3"} />
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] uppercase tracking-widest text-white/25 mr-1">Category</span>
                            {["web", "app", "workflow"].map(c => {
                                const on = draft.category.includes(c);
                                return (
                                    <button key={c} type="button"
                                        onClick={() => setDraft(d => ({
                                            ...d,
                                            category: on ? d.category.filter(x => x !== c) : [...d.category, c]
                                        }))}
                                        className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all capitalize ${on ? "bg-[#11B8EA]/10 border-[#11B8EA]/40 text-[#11B8EA]" : "border-white/10 text-white/25 hover:border-white/25"}`}>
                                        {c}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    if (!draft.name) return;
                                    const imgs = [draft.image1, draft.image2].filter(Boolean);
                                    saveProject({
                                        id: Date.now(), name: draft.name, status: draft.status,
                                        category: draft.category,
                                        tagline: draft.tagline, summary: draft.summary, problem: "", solution: "",
                                        stack: draft.stack.split(",").map(s => s.trim()).filter(Boolean),
                                        link: draft.link || null,
                                        image: imgs[0] || `/projects/${draft.name.toLowerCase()}.jpg`,
                                        images: imgs,
                                        video: draft.video || null,
                                        colors: draft.colors.split(",").map(c => c.trim()).filter(Boolean),
                                    });
                                    setDraft({ name: "", tagline: "", summary: "", status: "BUILDING", stack: "", link: "", category: [], image1: "", image2: "", video: "", colors: "" });
                                    setAdding(false);
                                }}
                                className="px-5 py-2 rounded-xl text-sm font-semibold text-[#0A0F1E]" style={{ background: "#11B8EA" }}>
                                Save Project
                            </button>
                            <button onClick={() => setAdding(false)} className="px-5 py-2 rounded-xl text-sm text-white/40 border border-white/10 hover:border-white/25 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Project list */}
            <div className="rounded-2xl border border-white/8 overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_160px_140px_64px] px-5 py-3 border-b border-white/6 bg-white/[0.02]">
                    {["Project", "Status", "Stack", "Category", ""].map(h => (
                        <span key={h} className="text-[9px] tracking-[0.3em] uppercase text-white/20 font-semibold">{h}</span>
                    ))}
                </div>
                {projects.map((p, i) => (
                    <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                        className="grid grid-cols-[1fr_100px_160px_140px_64px] px-5 py-4 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors">
                        <div>
                            <p className="text-sm text-white font-medium">{p.name}</p>
                            <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">{p.tagline}</p>
                        </div>
                        <span className={`inline-flex items-center text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded-full border w-fit ${statusStyle(p.status)}`}>
                            {p.status}
                        </span>
                        <div className="flex gap-1 flex-wrap">
                            {p.stack.slice(0, 3).map(t => (
                                <span key={t} className="text-[10px] px-2 py-0.5 rounded-md border border-white/8 text-white/30">{t}</span>
                            ))}
                            {p.stack.length > 3 && <span className="text-[10px] text-white/20">+{p.stack.length - 3}</span>}
                        </div>
                        {/* Category toggles — click to add/remove */}
                        <div className="flex gap-1 flex-wrap">
                            {["web", "app", "workflow"].map(c => {
                                const on = p.category.includes(c);
                                return (
                                    <button key={c}
                                        onClick={() => updateProject(p.id, {
                                            category: on ? p.category.filter(v => v !== c) : [...p.category, c]
                                        })}
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border transition-all capitalize ${on ? "bg-[#11B8EA]/10 border-[#11B8EA]/35 text-[#11B8EA]" : "border-white/8 text-white/15 hover:border-white/20 hover:text-white/30"}`}>
                                        {c}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => deleteProject(p.id)}
                                className="w-7 h-7 rounded-lg border border-white/8 hover:border-red-500/30 hover:bg-red-500/5 flex items-center justify-center transition-colors">
                                <Trash2 size={11} className="text-white/30" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <p className="text-[10px] text-white/15 text-center mt-4">Changes here are local only — connect Supabase to persist across sessions.</p>
        </div>
    );
}

// ─── CLIENT WORKSPACE — PHASE 1: DISCOVER ─────────────────────────────────────

const PHASES_MAP = [
    { n: 0, label: "Signal" },
    { n: 1, label: "Discover" },
    { n: 2, label: "Blueprint" },
    { n: 3, label: "Ignition" },
    { n: 4, label: "Build" },
    { n: 5, label: "Deliver" },
    { n: 6, label: "Handover" },
    { n: 7, label: "Orbit" },
];

const DISCOVER_QUESTIONS = [
    "Describe the exact moment your current system or process fails — what is happening, who is affected, and what does it cost each time?",
    "When this is built and running — what is the one specific outcome that tells you it worked? Give me a number, a before/after, something measurable.",
    "What have you already tried to solve this — tools, agencies, freelancers, or internal builds? For each, what happened and why didn't it stick?",
    "Walk me through everything you currently use — software, platforms, tools. What must we integrate with? What do you already have: domain, hosting, brand assets?",
    "What are the 2–3 things about this project that are completely fixed — features or constraints that cannot change regardless of timeline or cost?",
    "Who else is involved in reviewing and approving work during the build — and how fast can decisions get made when we need a yes or no?",
];

type WorkspaceLeftTab = "questionnaire" | "chat" | "notes";

function ClientWorkspaceView({ deal: initialDeal, onBack, adminEmail }: { deal: Deal; onBack: () => void; adminEmail: string }) {
    const [deal, setDeal] = useState(initialDeal);
    const [notes, setNotes] = useState(initialDeal.clientNote || "");
    const [notesSaved, setNotesSaved] = useState(false);
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const [leftTab, setLeftTab] = useState<WorkspaceLeftTab>("questionnaire");
    const [chatText, setChatText] = useState("");
    const [sendingChat, setSendingChat] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const [daysInput, setDaysInput] = useState<string>(String(initialDeal.projectDays || ""));
    const [daysSaved, setDaysSaved] = useState(false);
    const [callNotes, setCallNotes] = useState<string>(initialDeal.phaseData?.phase1?.callNotes || "");
    const [callSaving, setCallSaving] = useState(false);

    const callDone = !!deal.phaseData?.phase1?.callCompletedAt;

    const markCallDone = async () => {
        if (!callNotes.trim() || callNotes.trim().length < 10) {
            alert("Call notes must be at least 10 characters.");
            return;
        }
        setCallSaving(true);
        try {
            const res = await fetch(`/api/deals/${deal.token}/phase/1`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phaseDataPatch: { callCompletedAt: Date.now(), callNotes: callNotes.trim() },
                    auditAction: "call.completed",
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setDeal(d => ({ ...d, ...data.deal }));
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`Save failed: ${err.error || res.statusText}`);
            }
        } finally {
            setCallSaving(false);
        }
    };

    const saveProjectDays = async () => {
        const val = parseInt(daysInput);
        if (!val || val < 1) return;
        await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deal.token, projectDays: val }),
        });
        setDeal(d => ({ ...d, projectDays: val }));
        setDaysSaved(true);
        setTimeout(() => setDaysSaved(false), 2000);
    };

    // Poll deal every 6s
    useEffect(() => {
        const interval = setInterval(async () => {
            const res = await fetch(`/api/deals?token=${deal.token}`);
            if (res.ok) {
                const data = await res.json();
                setDeal(data);
            }
        }, 6000);
        return () => clearInterval(interval);
    }, [deal.token]);

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [deal.messages]);

    const clientProceeded = deal.phase >= 1 && deal.status === "proceeding";
    const messages = deal.messages || [];
    const unreadFromClient = messages.filter(m => m.from === "client").length;

    const saveNotes = async () => {
        await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deal.token, clientNote: notes }),
        });
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
    };

    const sendAdminMessage = async () => {
        if (!chatText.trim() || sendingChat) return;
        setSendingChat(true);
        const msg = { from: "admin" as const, text: chatText.trim(), timestamp: Date.now() };
        const t = chatText;
        setChatText("");
        await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deal.token, appendMessage: msg }),
        });
        setDeal(d => ({ ...d, messages: [...(d.messages || []), msg] }));
        setSendingChat(false);
    };

    const timeAgo = (ts: number) => {
        const diff = Date.now() - ts;
        if (diff < 60000) return "just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    return (
        <div className="h-full flex flex-col">
            {/* Workspace header */}
            <div className="shrink-0 px-8 py-5 border-b border-white/6 flex items-center gap-6">
                <button onClick={onBack}
                    className="flex items-center gap-2 text-white/30 hover:text-white/60 text-sm transition-colors">
                    <ChevronRight size={14} className="rotate-180" /> Inbox
                </button>
                <div className="w-px h-5 bg-white/8" />
                <div>
                    <p className="font-serif text-xl text-white leading-tight">{deal.name}</p>
                    <p className="text-white/35 text-xs">{deal.company} · {deal.need}</p>
                </div>
                {/* Journey map */}
                <div className="ml-auto flex items-center gap-0">
                    {PHASES_MAP.map((p, i) => {
                        const isCurrent = p.n === deal.phase;
                        const isPast = p.n < deal.phase;
                        return (
                            <React.Fragment key={p.n}>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-2 h-2 rounded-full transition-all"
                                        style={{
                                            background: isCurrent ? "#11B8EA" : isPast ? "#3B6AE8" : "rgba(255,255,255,0.1)",
                                            boxShadow: isCurrent ? "0 0 8px #11B8EA" : "none",
                                        }} />
                                    <span className="text-[8px] tracking-wider uppercase"
                                        style={{ color: isCurrent ? "#11B8EA" : isPast ? "rgba(59,106,232,0.7)" : "rgba(255,255,255,0.15)" }}>
                                        {p.label}
                                    </span>
                                </div>
                                {i < PHASES_MAP.length - 1 && (
                                    <div className="w-6 h-px mb-3 transition-all" style={{ background: isPast ? "rgba(59,106,232,0.4)" : "rgba(255,255,255,0.06)" }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
                <div className="shrink-0 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"
                    style={{ background: "rgba(17,184,234,0.1)", border: "1px solid rgba(17,184,234,0.25)", color: "#11B8EA" }}>
                    {PHASE_NAMES[deal.phase] || "PHASE"} — Phase {deal.phase}
                </div>
            </div>

            {/* Client-proceeded banner */}
            <AnimatePresence>
                {clientProceeded && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="shrink-0 px-8 py-3 flex items-center gap-3 border-b border-emerald-500/15"
                        style={{ background: "rgba(16,185,129,0.05)" }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <p className="text-emerald-400/80 text-xs font-medium">
                            {deal.name.split(" ")[0]} has entered Phase 1 — workspace is now live on their end.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main workspace body */}
            <div className="flex-1 overflow-hidden">
                <div className="grid grid-cols-[1fr_300px] h-full">

                    {/* LEFT — phase-aware panel: P2 = Blueprint, P3 = Ignition, otherwise Phase-1 tabs */}
                    <div className="flex flex-col border-r border-white/6 overflow-hidden">

                    {deal.phase === 2 ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <BlueprintBuilder
                                deal={deal as any}
                                adminEmail={adminEmail}
                                onSaved={(updated: any) => setDeal(d => ({ ...d, ...updated }))}
                            />
                        </div>
                    ) : deal.phase === 3 ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <IgnitionAdminView
                                deal={deal as any}
                                adminEmail={adminEmail}
                                onUpdated={(updated: any) => setDeal(d => ({ ...d, ...updated }))}
                            />
                        </div>
                    ) : deal.phase === 4 ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <BuildAdminView
                                deal={deal as any}
                                adminEmail={adminEmail}
                                onUpdated={(updated: any) => setDeal(d => ({ ...d, ...updated }))}
                            />
                        </div>
                    ) : deal.phase === 5 ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <DeliverAdminView
                                deal={deal as any}
                                adminEmail={adminEmail}
                                onUpdated={(updated: any) => setDeal(d => ({ ...d, ...updated }))}
                            />
                        </div>
                    ) : deal.phase === 6 ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <HandoverAdminView
                                deal={deal as any}
                                adminEmail={adminEmail}
                                onUpdated={(updated: any) => setDeal(d => ({ ...d, ...updated }))}
                            />
                        </div>
                    ) : deal.phase === 7 ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            <OrbitAdminView
                                deal={deal as any}
                                adminEmail={adminEmail}
                                onUpdated={(updated: any) => setDeal(d => ({ ...d, ...updated }))}
                            />
                        </div>
                    ) : (
                    <>
                        {/* Left tab bar */}
                        <div className="shrink-0 flex items-center gap-1 px-6 pt-5 pb-0 border-b border-white/6">
                            {([
                                { id: "questionnaire", label: "Questionnaire", badge: deal.questionnaire ? "✓" : null },
                                { id: "chat", label: "Chat", badge: unreadFromClient > 0 ? String(unreadFromClient) : null },
                                { id: "notes", label: "Notes", badge: null },
                            ] as { id: WorkspaceLeftTab; label: string; badge: string | null }[]).map(t => (
                                <button key={t.id}
                                    onClick={() => setLeftTab(t.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all ${leftTab === t.id ? "border-[#11B8EA] text-[#11B8EA]" : "border-transparent text-white/30 hover:text-white/55"}`}>
                                    {t.label}
                                    {t.badge && (
                                        <span className="w-4 h-4 rounded-full bg-[#11B8EA]/20 text-[#11B8EA] text-[9px] flex items-center justify-center font-bold">
                                            {t.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Left tab content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <AnimatePresence mode="wait">

                                {/* QUESTIONNAIRE TAB */}
                                {leftTab === "questionnaire" && (
                                    <motion.div key="q" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        {deal.questionnaire ? (
                                            <>
                                                <div className="flex items-center gap-2 mb-6">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    <p className="text-emerald-400/80 text-xs font-medium">
                                                        Submitted {deal.questionnaireSubmittedAt ? timeAgo(deal.questionnaireSubmittedAt) : ""}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-5">
                                                    {DISCOVER_QUESTIONS.map((q, i) => (
                                                        <div key={i} className="rounded-2xl border border-white/6 bg-white/[0.02] p-5">
                                                            <div className="flex items-start gap-3 mb-3">
                                                                <span className="shrink-0 w-5 h-5 rounded-full border border-[#11B8EA]/30 flex items-center justify-center text-[9px] text-[#11B8EA]/60 font-mono mt-0.5">{i + 1}</span>
                                                                <p className="text-white/50 text-xs leading-relaxed">{q}</p>
                                                            </div>
                                                            <div className="ml-8 rounded-xl bg-white/[0.03] border border-white/6 px-4 py-3">
                                                                <p className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap">
                                                                    {deal.questionnaire![`q${i}`] || <span className="text-white/20 italic">No answer</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col gap-5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                    <p className="text-amber-400/70 text-xs font-medium">Awaiting client responses</p>
                                                </div>
                                                {DISCOVER_QUESTIONS.map((q, i) => (
                                                    <div key={i} className="rounded-2xl border border-white/6 bg-white/[0.015] p-5">
                                                        <div className="flex items-start gap-3 mb-3">
                                                            <span className="shrink-0 w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-[9px] text-white/25 font-mono mt-0.5">{i + 1}</span>
                                                            <p className="text-white/55 text-xs leading-relaxed">{q}</p>
                                                        </div>
                                                        <div className="ml-8 rounded-xl border border-dashed border-white/6 px-4 py-3 min-h-[44px] flex items-center">
                                                            <p className="text-white/15 text-xs italic">Awaiting client response…</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* CHAT TAB */}
                                {leftTab === "chat" && (
                                    <motion.div key="c" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="flex flex-col h-full" style={{ minHeight: "480px" }}>
                                        {/* Messages */}
                                        <div className="flex-1 flex flex-col gap-4 overflow-y-auto mb-4" style={{ maxHeight: "380px" }}>
                                            {messages.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                                    <MessageSquare size={24} className="text-white/10 mb-2" />
                                                    <p className="text-white/20 text-sm">No messages yet.</p>
                                                </div>
                                            )}
                                            {messages.map((msg, i) => {
                                                const isAdmin = msg.from === "admin";
                                                return (
                                                    <div key={i} className={`flex flex-col gap-1 ${isAdmin ? "items-end" : "items-start"}`}>
                                                        <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${isAdmin ? "bg-[#3B6AE8] text-white rounded-br-sm" : "bg-white/[0.05] text-white/75 rounded-bl-sm border border-white/8"}`}>
                                                            {msg.imageUrl
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                ? <img src={msg.imageUrl} alt="attachment" className="rounded-xl max-w-full" />
                                                                : <span className="whitespace-pre-wrap">{msg.text}</span>
                                                            }
                                                        </div>
                                                        <p className={`text-[10px] text-white/20 px-1 ${isAdmin ? "text-right" : ""}`}>
                                                            {isAdmin ? "You (admin)" : deal.name.split(" ")[0]} · {timeAgo(msg.timestamp)}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                            <div ref={chatBottomRef} />
                                        </div>
                                        {/* Input */}
                                        <div className="shrink-0 border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden focus-within:border-[#11B8EA]/30 transition-colors">
                                            <textarea rows={3}
                                                placeholder="Reply to client... (Enter to send)"
                                                value={chatText}
                                                onChange={e => setChatText(e.target.value)}
                                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminMessage(); } }}
                                                className="w-full bg-transparent px-4 pt-3 text-sm text-white outline-none placeholder:text-white/15 resize-none"
                                            />
                                            <div className="flex justify-end px-4 pb-3">
                                                <button onClick={sendAdminMessage} disabled={!chatText.trim() || sendingChat}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
                                                    style={{ background: chatText.trim() ? "linear-gradient(135deg,#11B8EA,#3B6AE8)" : "rgba(255,255,255,0.05)", color: chatText.trim() ? "#0A0F1E" : "#ffffff40" }}>
                                                    {sendingChat ? "Sending..." : "Send"} <Send size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* NOTES TAB */}
                                {leftTab === "notes" && (
                                    <motion.div key="n" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        <p className="text-[10px] tracking-[0.4em] uppercase text-white/15 mb-4">Private Notes</p>
                                        <p className="text-white/25 text-xs mb-5">Internal — not visible to the client.</p>
                                        <textarea
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="Your observations, concerns, follow-up items..."
                                            rows={12}
                                            className="w-full bg-white/[0.02] border border-white/8 rounded-xl px-4 py-3 text-sm text-white/65 placeholder:text-white/12 outline-none focus:border-white/15 transition-colors resize-none leading-relaxed"
                                        />
                                        <div className="mt-3 flex justify-end">
                                            <button onClick={saveNotes}
                                                className="text-[10px] px-4 py-2 rounded-lg border transition-all"
                                                style={{ borderColor: "rgba(17,184,234,0.3)", color: notesSaved ? "#10b981" : "#11B8EA" }}>
                                                {notesSaved ? "Saved ✓" : "Save Notes"}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>
                    </>
                    )}
                    </div>

                    {/* RIGHT — Admin Actions */}
                    <div className="p-6 flex flex-col gap-3 overflow-y-auto">
                        <p className="text-[10px] tracking-[0.5em] uppercase text-white/15 mb-2">Admin Actions</p>

                        {/* 1. Schedule Call */}
                        <a href={`https://calendar.google.com/calendar/r/eventedit?text=Discovery+Call+—+${encodeURIComponent(deal.name)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="w-full px-5 py-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all text-left group">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center shrink-0">
                                    <Clock size={13} className="text-white/35" />
                                </div>
                                <div>
                                    <p className="text-sm text-white/70 font-medium group-hover:text-white transition-colors">Schedule Call</p>
                                    <p className="text-[10px] text-white/25">45-min discovery</p>
                                </div>
                            </div>
                        </a>

                        {/* 2. Message Client (WhatsApp) */}
                        <a href={`https://wa.me/?text=Hi ${encodeURIComponent(deal.name.split(" ")[0])}, just following up on your project enquiry — do you have time for a quick discovery call?`}
                            target="_blank" rel="noopener noreferrer"
                            className="w-full px-5 py-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all text-left group">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center shrink-0">
                                    <MessageSquare size={13} className="text-white/35" />
                                </div>
                                <div>
                                    <p className="text-sm text-white/70 font-medium group-hover:text-white transition-colors">Message Client</p>
                                    <p className="text-[10px] text-white/25">WhatsApp direct</p>
                                </div>
                            </div>
                        </a>

                        {/* 3. Copy Portal Link */}
                        <button onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/client/${deal.token}`);
                            setActiveAction("copied");
                            setTimeout(() => setActiveAction(null), 2000);
                        }}
                            className="w-full px-5 py-4 rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all text-left group">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center shrink-0">
                                    <ExternalLink size={13} className="text-white/35" />
                                </div>
                                <div>
                                    <p className="text-sm text-white/70 font-medium group-hover:text-white transition-colors">
                                        {activeAction === "copied" ? "Copied ✓" : "Copy Portal Link"}
                                    </p>
                                    <p className="text-[10px] text-white/25 font-mono">/client/{deal.token}</p>
                                </div>
                            </div>
                        </button>

                        <div className="h-px bg-white/6 my-1" />

                        {/* Timeline Editor */}
                        <div className="rounded-xl border border-[#11B8EA]/15 bg-[#11B8EA]/[0.02] p-4">
                            <p className="text-[9px] tracking-[0.35em] uppercase text-white/20 mb-3">Project Timeline</p>
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="number" min="1"
                                    value={daysInput}
                                    onChange={e => setDaysInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && saveProjectDays()}
                                    placeholder="days"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-[#11B8EA]/40 transition-colors"
                                />
                                <button onClick={saveProjectDays}
                                    className="px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
                                    style={{ background: daysSaved ? "rgba(16,185,129,0.15)" : "rgba(17,184,234,0.12)", border: `1px solid ${daysSaved ? "rgba(16,185,129,0.3)" : "rgba(17,184,234,0.25)"}`, color: daysSaved ? "#10b981" : "#11B8EA" }}>
                                    {daysSaved ? "✓" : "Save"}
                                </button>
                            </div>
                            {daysInput && parseInt(daysInput) > 0 && (
                                <p className="text-[9px] text-white/20">
                                    working budget: <span style={{ color: "#11B8EA" }}>{Math.floor(parseInt(daysInput) * 0.75)}d</span>
                                    {" · "}buffer: <span className="text-white/35">{Math.ceil(parseInt(daysInput) * 0.25)}d</span>
                                </p>
                            )}
                        </div>

                        <div className="h-px bg-white/6 my-1" />

                        {/* Discovery Call Log — required before GO */}
                        {deal.phase === 1 && (
                            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] tracking-[0.35em] uppercase text-white/30">Discovery Call</p>
                                    {callDone && (
                                        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400">
                                            <Check size={10} /> Logged
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    value={callNotes}
                                    onChange={e => setCallNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Call notes (min 10 chars) — required to GO"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-[#11B8EA]/40 transition-colors resize-none"
                                />
                                <button
                                    onClick={markCallDone}
                                    disabled={callSaving || callNotes.trim().length < 10}
                                    className="mt-2 w-full px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-40"
                                    style={{
                                        background: callDone ? "rgba(16,185,129,0.12)" : "rgba(17,184,234,0.12)",
                                        border: `1px solid ${callDone ? "rgba(16,185,129,0.3)" : "rgba(17,184,234,0.25)"}`,
                                        color: callDone ? "#10b981" : "#11B8EA",
                                    }}>
                                    {callSaving ? "Saving..." : callDone ? "Update Notes" : "Mark Call Done"}
                                </button>
                            </div>
                        )}

                        {/* 4. GO → Phase 2 (only show when in Phase 1, questionnaire complete) */}
                        {deal.phase === 1 && (
                            <button
                                onClick={async () => {
                                    if (activeAction !== "go") { setActiveAction("go"); return; }
                                    // Confirm + advance via T1 → 2 (goDecision: proceed)
                                    const res = await fetch(`/api/deals/${deal.token}/phase/1`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "goDecision", ctx: { decision: "go", adminEmail } }),
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        setDeal(d => ({ ...d, ...data.deal }));
                                        setActiveAction(null);
                                    } else {
                                        const err = await res.json().catch(() => ({}));
                                        alert(`GO failed: ${err.error || res.statusText}`);
                                    }
                                }}
                                className="w-full px-5 py-4 rounded-xl border transition-all text-left"
                                style={{
                                    borderColor: activeAction === "go" ? "rgba(17,184,234,0.4)" : "rgba(17,184,234,0.15)",
                                    background: activeAction === "go" ? "rgba(17,184,234,0.06)" : "rgba(17,184,234,0.02)",
                                }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: "rgba(17,184,234,0.1)", border: "1px solid rgba(17,184,234,0.2)" }}>
                                        <ArrowRight size={13} style={{ color: "#11B8EA" }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: "#11B8EA" }}>
                                            {activeAction === "go" ? "Confirm — advance now" : "GO → Phase 2"}
                                        </p>
                                        <p className="text-[10px] text-white/25">
                                            {activeAction === "go" ? "Click again to unlock Blueprint" : "Unlock Blueprint"}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        )}
                        {deal.phase === 2 && (
                            <div
                                className="w-full px-5 py-4 rounded-xl border text-left"
                                style={{
                                    borderColor: "rgba(17,184,234,0.25)",
                                    background: "rgba(17,184,234,0.04)",
                                }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: "rgba(17,184,234,0.12)", border: "1px solid rgba(17,184,234,0.25)" }}>
                                        <Check size={13} style={{ color: "#11B8EA" }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: "#11B8EA" }}>Phase 2 active</p>
                                        <p className="text-[10px] text-white/35">Compose the Blueprint on the left</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {deal.phase === 3 && (
                            <div
                                className="w-full px-5 py-4 rounded-xl border text-left"
                                style={{
                                    borderColor: "rgba(17,184,234,0.25)",
                                    background: "rgba(17,184,234,0.04)",
                                }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: "rgba(17,184,234,0.12)", border: "1px solid rgba(17,184,234,0.25)" }}>
                                        <Check size={13} style={{ color: "#11B8EA" }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: "#11B8EA" }}>Phase 3 active</p>
                                        <p className="text-[10px] text-white/35">Review payment + assets, then confirm to advance</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {deal.phase === 4 && (
                            <div
                                className="w-full px-5 py-4 rounded-xl border text-left"
                                style={{
                                    borderColor: "rgba(17,184,234,0.25)",
                                    background: "rgba(17,184,234,0.04)",
                                }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: "rgba(17,184,234,0.12)", border: "1px solid rgba(17,184,234,0.25)" }}>
                                        <Check size={13} style={{ color: "#11B8EA" }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: "#11B8EA" }}>Phase 4 active</p>
                                        <p className="text-[10px] text-white/35">Sprints, change orders, mid-payment, then submit final</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {deal.phase === 5 && (
                            <div
                                className="w-full px-5 py-4 rounded-xl border text-left"
                                style={{
                                    borderColor: "rgba(17,184,234,0.25)",
                                    background: "rgba(17,184,234,0.04)",
                                }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: "rgba(17,184,234,0.12)", border: "1px solid rgba(17,184,234,0.25)" }}>
                                        <Check size={13} style={{ color: "#11B8EA" }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: "#11B8EA" }}>Phase 5 active</p>
                                        <p className="text-[10px] text-white/35">Client reviewing — handle revisions until they approve</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {deal.phase === 6 && (
                            <div
                                className="w-full px-5 py-4 rounded-xl border text-left"
                                style={{
                                    borderColor: "rgba(245,158,11,0.25)",
                                    background: "rgba(245,158,11,0.04)",
                                }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
                                        <Check size={13} style={{ color: "#F59E0B" }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: "#F59E0B" }}>Phase 6 active</p>
                                        <p className="text-[10px] text-white/35">Final payment → deploy → handover package → Orbit</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {deal.phase === 7 && (
                            <div
                                className="w-full px-5 py-4 rounded-xl border text-left"
                                style={{
                                    borderColor: "rgba(17,184,234,0.25)",
                                    background: "rgba(17,184,234,0.04)",
                                }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: "rgba(17,184,234,0.12)", border: "1px solid rgba(17,184,234,0.25)" }}>
                                        <Check size={13} style={{ color: "#11B8EA" }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: "#11B8EA" }}>Phase 7 — Orbit</p>
                                        <p className="text-[10px] text-white/35">Long-term. Check-ins · retainer · referrals.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. NO-GO */}
                        <button onClick={() => setActiveAction(activeAction === "nogo" ? null : "nogo")}
                            className="w-full px-5 py-4 rounded-xl border transition-all text-left"
                            style={{ borderColor: "rgba(239,68,68,0.12)", background: "rgba(239,68,68,0.02)" }}>
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                                    <X size={13} className="text-red-400/60" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-red-400/60">NO-GO</p>
                                    <p className="text-[10px] text-white/20">End engagement</p>
                                </div>
                            </div>
                        </button>

                        {/* Deal meta */}
                        <div className="mt-auto pt-4 border-t border-white/6">
                            <p className="text-[9px] tracking-widest uppercase text-white/15 mb-2">Deal Info</p>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between">
                                    <span className="text-[10px] text-white/20">Token</span>
                                    <span className="text-[10px] font-mono text-white/30">{deal.token}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[10px] text-white/20">Budget</span>
                                    <span className="text-[10px] text-white/35">{deal.budget || "—"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[10px] text-white/20">Elected</span>
                                    <span className="text-[10px] text-white/35">
                                        {deal.electedAt ? new Date(deal.electedAt).toLocaleDateString("en-IN") : "—"}
                                    </span>
                                </div>
                            </div>

                            <ForcePhaseJumpPanel deal={deal} adminEmail={adminEmail} onUpdated={(d) => setDeal(prev => ({ ...prev, ...d }))} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── DEV: FORCE PHASE JUMP (god-mode override, audit-tracked) ──────────────────
function ForcePhaseJumpPanel({ deal, adminEmail, onUpdated }: {
    deal: Deal; adminEmail: string; onUpdated: (d: Deal) => void;
}) {
    const [open, setOpen] = useState(false);
    const [toPhase, setToPhase] = useState<number>(deal.phase);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async () => {
        if (note.trim().length < 10) { setErr("Audit note must be ≥10 chars."); return; }
        if (toPhase === deal.phase) { setErr("Already on this phase."); return; }
        setBusy(true); setErr(null);
        try {
            const res = await fetch(`/api/deals/${deal.token}/phase/${deal.phase}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "forcePhaseJump",
                    ctx: { adminEmail, toPhase, note: note.trim() },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Jump failed");
            onUpdated(data.deal);
            setOpen(false); setNote("");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed");
        } finally { setBusy(false); }
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="mt-3 w-full text-left text-[9px] tracking-[0.25em] uppercase text-white/20 hover:text-amber-400/70 transition-colors">
                ▸ Dev override
            </button>
        );
    }

    return (
        <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.03] p-3 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-[9px] tracking-[0.3em] uppercase text-amber-400/80 font-bold">Force phase jump</p>
                <button onClick={() => { setOpen(false); setErr(null); }} className="text-white/30 hover:text-white/60 text-[10px]">×</button>
            </div>
            <p className="text-[10px] text-white/40 leading-snug">
                God-mode override. Audited. Use only when automated flow is stuck.
            </p>
            <div className="flex gap-1.5 flex-wrap">
                {[0,1,2,3,4,5,6,7].map(p => (
                    <button key={p} onClick={() => setToPhase(p)}
                        className={`w-7 h-7 rounded text-[10px] font-bold border transition-colors ${
                            toPhase === p
                                ? "border-amber-400/60 bg-amber-400/15 text-amber-200"
                                : "border-white/10 bg-white/[0.02] text-white/40 hover:text-white/70"
                        } ${p === deal.phase ? "ring-1 ring-emerald-400/30" : ""}`}>
                        {p}
                    </button>
                ))}
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Audit note (≥10 chars) — why this jump?"
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-amber-500/40 resize-none" />
            {err && <p className="text-red-400 text-[10px]">{err}</p>}
            <button onClick={submit} disabled={busy}
                className="w-full rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] font-semibold py-1.5 disabled:opacity-30">
                {busy ? "Jumping…" : `Jump → Phase ${toPhase}`}
            </button>
        </div>
    );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

const NAV = [
    { id: "home", label: "Overview", icon: LayoutDashboard },
    { id: "work", label: "Work", icon: FolderOpen },
    { id: "services", label: "Services", icon: Layers },
    { id: "start", label: "Start a Project", icon: Rocket },
];

const ADMIN_NAV = [
    { id: "command", label: "Mission Control", icon: Activity },
    { id: "pipeline", label: "Pipeline", icon: Columns3 },
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "manage", label: "Projects", icon: Settings2 },
];

function NavButton({ item, active, setActive, badge }: {
    item: { id: string; label: string; icon: React.ElementType };
    active: string; setActive: (v: string) => void; badge?: string;
}) {
    const isActive = active === item.id;
    return (
        <button onClick={() => setActive(item.id)}
            className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left w-full group overflow-hidden ${isActive ? "text-white" : "text-white/35 hover:text-white/65"}`}>
            {isActive && (
                <div className="absolute inset-0 rounded-xl border border-[#11B8EA]/20"
                    style={{ background: "linear-gradient(135deg, rgba(17,184,234,0.12), rgba(59,106,232,0.08))", filter: "url(#radio-glass)" }} />
            )}
            {!isActive && <div className="absolute inset-0 rounded-xl bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity" />}
            {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#11B8EA] z-10" />}
            <item.icon size={15} className={`relative z-10 ${isActive ? "text-[#11B8EA]" : "group-hover:text-white/50 transition-colors"}`} />
            <span className="relative z-10">{item.label}</span>
            {badge && (
                <span className="ml-auto relative z-10 min-w-[18px] h-[18px] rounded-full bg-[#11B8EA] text-[#0A0F1E] text-[9px] font-bold flex items-center justify-center px-1">
                    {badge}
                </span>
            )}
            {item.id === "start" && !isActive && !badge && (
                <span className="ml-auto relative z-10 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
        </button>
    );
}

function Sidebar({ active, setActive, user, isAdmin, submissions }: {
    active: string; setActive: (v: string) => void;
    user: { name?: string | null; email?: string | null; image?: string | null } | null;
    isAdmin: boolean;
    submissions: Submission[];
}) {
    const newCount = submissions.filter(s => s.status === "new").length;
    return (
        <aside className="flex flex-col w-60 min-h-screen border-r border-white/8 bg-[#070B16] shrink-0">
            {/* Glass SVG filter */}
            <svg className="hidden" aria-hidden="true">
                <defs>
                    <filter id="radio-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                        <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
                        <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
                        <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="30" xChannelSelector="R" yChannelSelector="B" result="displaced" />
                        <feGaussianBlur in="displaced" stdDeviation="2" result="finalBlur" />
                        <feComposite in="finalBlur" in2="finalBlur" operator="over" />
                    </filter>
                </defs>
            </svg>

            <div className="px-6 py-6 border-b border-white/8">
                <Link href="/" className="font-serif text-lg font-bold text-white tracking-tight hover:text-white/80 transition-colors">SYNAPSIS</Link>
                <p className="text-[9px] tracking-[0.35em] uppercase text-white/25 mt-0.5">Industries</p>
            </div>

            <nav className="flex flex-col gap-0.5 p-3 flex-1">
                {NAV.map(item => (
                    <NavButton key={item.id} item={item} active={active} setActive={setActive} />
                ))}

                {/* Admin section */}
                {isAdmin && (
                    <>
                        <div className="mx-1 my-2 h-px bg-white/6" />
                        <p className="px-4 py-1 text-[9px] tracking-[0.4em] uppercase text-white/15 font-semibold">Admin</p>
                        {ADMIN_NAV.map(item => (
                            <NavButton key={item.id} item={item} active={active} setActive={setActive}
                                badge={item.id === "inbox" && newCount > 0 ? String(newCount) : undefined} />
                        ))}
                    </>
                )}
            </nav>

            <div className="p-4 border-t border-white/8">
                {user ? (
                    <>
                        <div className="flex items-center gap-3 px-2 mb-3">
                            {user.image
                                ? <img src={user.image} alt="" className="w-7 h-7 rounded-full border border-white/15" />
                                : <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white text-xs">{user.name?.[0] || "U"}</div>
                            }
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-medium truncate">{user.name}</p>
                                <p className="text-white/25 text-[10px] truncate">{user.email}</p>
                            </div>
                        </div>
                        <button onClick={() => signOut({ callbackUrl: "/" })}
                            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-white/30 hover:text-white/55 hover:bg-white/5 transition-all">
                            <LogOut size={12} /> Sign Out
                        </button>
                    </>
                ) : (
                    <button onClick={() => window.location.href = "/auth/signin"}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-white/20 hover:text-white/45 hover:bg-white/5 transition-all">
                        <LogOut size={12} className="rotate-180" /> Sign In
                    </button>
                )}
            </div>
        </aside>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
    const { data: session, status } = useSession();
    const [view, setView] = useState("home");
    const [projects, setProjects] = useState(PROJECTS);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [activeWorkspace, setActiveWorkspace] = useState<Deal | null>(null);

    const router = useRouter();
    const isAdmin = (session?.user as { role?: string })?.role === "admin";

    // If non-admin has a saved token, verify it then redirect to their portal
    useEffect(() => {
        if (status !== "authenticated") return;
        if (isAdmin) return;
        const savedToken = localStorage.getItem("synapsis_client_token");
        if (!savedToken) return;
        // Verify token is still valid before redirecting
        fetch(`/api/deals?token=${savedToken}`)
            .then(r => {
                if (r.ok) {
                    router.replace(`/client/${savedToken}`);
                } else {
                    // Token is stale/invalid — clear it
                    localStorage.removeItem("synapsis_client_token");
                }
            })
            .catch(() => localStorage.removeItem("synapsis_client_token"));
    }, [status, isAdmin, router]);

    // Fetch submissions + deals on mount (admin only)
    useEffect(() => {
        if (!isAdmin) return;
        Promise.all([
            fetch("/api/submissions").then(r => r.json()).catch(() => []),
            fetch("/api/deals").then(r => r.json()).catch(() => []),
        ]).then(([subs, deals]: [Submission[], Deal[]]) => {
            if (Array.isArray(deals)) setDeals(deals);
            if (Array.isArray(subs)) {
                // Merge: add any deals that have no matching submission (recovery for old data)
                const subIds = new Set(subs.map(s => s.id));
                const orphaned: Submission[] = (Array.isArray(deals) ? deals : [])
                    .filter((d: Deal) => !subIds.has(d.submissionId))
                    .map((d: Deal) => ({
                        id: d.submissionId,
                        name: d.name,
                        company: d.company,
                        need: d.need,
                        budget: d.budget,
                        message: d.message,
                        date: new Date(d.createdAt).toISOString().slice(0, 10),
                        status: "new",
                    }));
                setSubmissions([...orphaned, ...subs]);
            }
        });
    }, [isAdmin]);

    const addSubmission = (s: Submission) => {
        // Save to API (fire-and-forget — deal creation already done in StartProjectView)
        fetch("/api/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(s),
        }).catch(() => {});
        setSubmissions(prev => [s, ...prev]);
    };

    const deleteSubmission = (id: number) => {
        fetch(`/api/submissions?id=${id}`, { method: "DELETE" }).catch(() => {});
        setSubmissions(prev => prev.filter(s => s.id !== id));
    };

    const electDeal = async (sub: Submission, projectDays: number) => {
        let deal = deals.find(d => d.submissionId === sub.id);
        if (!deal) {
            const res = await fetch("/api/deals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: sub.id, name: sub.name, company: sub.company, need: sub.need, budget: sub.budget, message: sub.message }),
            });
            const data = await res.json();
            deal = data.deal as Deal;
            setDeals(prev => [...prev, deal!]);
        }
        const res2 = await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deal!.token, status: "elected", electedAt: Date.now(), projectDays }),
        }); // Note: customQuestions saved separately by InterestedChatModal before calling onElect
        const updated: Deal = await res2.json();
        setDeals(prev => prev.map(d => d.token === updated.token ? updated : d));
        // Open Phase 1 workspace immediately
        setActiveWorkspace(updated);
        setView("workspace");
    };

    const markInterested = async (sub: Submission): Promise<Deal> => {
        let deal = deals.find(d => d.submissionId === sub.id);
        if (!deal) {
            const res = await fetch("/api/deals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: sub.id, name: sub.name, company: sub.company, need: sub.need, budget: sub.budget, message: sub.message }),
            });
            const data = await res.json();
            deal = data.deal as Deal;
            setDeals(prev => [...prev, deal!]);
        }
        const res2 = await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deal!.token, status: "interested" }),
        });
        const updated: Deal = await res2.json();
        setDeals(prev => prev.map(d => d.token === updated.token ? updated : d));
        return updated;
    };

    // Re-enter workspace for any active deal — fetches fresh from API
    const openWorkspace = async (token: string) => {
        const res = await fetch(`/api/deals?token=${token}`);
        if (!res.ok) return;
        const fresh: Deal = await res.json();
        setDeals(prev => prev.map(d => d.token === fresh.token ? fresh : d));
        setActiveWorkspace(fresh);
        setView("workspace");
    };

    const rejectDeal = async (sub: Submission, note?: string) => {
        let deal = deals.find(d => d.submissionId === sub.id);
        if (!deal) {
            const res = await fetch("/api/deals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: sub.id, name: sub.name, company: sub.company, need: sub.need, budget: sub.budget, message: sub.message }),
            });
            const data = await res.json();
            deal = data.deal as Deal;
            setDeals(prev => [...prev, deal!]);
        }
        const res2 = await fetch("/api/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: deal!.token, status: "rejected", rejectedAt: Date.now(), rejectionNote: note || "" }),
        });
        const updated: Deal = await res2.json();
        setDeals(prev => prev.map(d => d.token === updated.token ? updated : d));
    };

    // Project Persistence Helpers
    useEffect(() => {
        fetch("/api/projects")
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setProjects(data);
            })
            .catch(() => {});
    }, []);

    const saveProject = async (p: any) => {
        setProjects(prev => [...prev, p]);
        fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p)
        }).catch(() => {});
    };

    const deleteProject = async (id: number) => {
        setProjects(prev => prev.filter(p => p.id !== id));
        fetch(`/api/projects?id=${id}`, { method: "DELETE" }).catch(() => {});
    };

    const updateProject = async (id: number, updates: any) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
        fetch("/api/projects", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, updates })
        }).catch(() => {});
    };

    // If loading, show spinner
    if (status === "loading") return (
        <div className="h-screen w-full flex items-center justify-center bg-[#0A0F1E]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-[#11B8EA] border-t-transparent animate-spin" />
                <p className="text-[10px] tracking-[0.4em] uppercase text-white/30">Loading...</p>
            </div>
        </div>
    );

    // If someone tries to access admin views without being admin, fall back to home
    const safeView = (["inbox", "manage", "workspace", "command", "pipeline"].includes(view) && !isAdmin) ? "home" : view;

    return (
        <div className="h-screen w-full flex bg-[#0A0F1E] text-white font-outfit overflow-hidden relative">

            {/* Ambient bg */}
            <div className="pointer-events-none absolute inset-0 z-0">
                <div className="absolute top-[-15vh] left-[25vw] w-[45vw] h-[45vh] rounded-full bg-[#11B8EA]/3 blur-[150px]" />
                <div className="absolute bottom-0 right-0 w-[30vw] h-[40vh] rounded-full bg-[#3B6AE8]/4 blur-[120px]" />
            </div>

            <Sidebar active={safeView} setActive={setView} user={session?.user ?? null} isAdmin={isAdmin} submissions={submissions} />

            <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                {/* Topbar */}
                <header className="flex items-center justify-between px-8 py-4 border-b border-white/6 shrink-0 bg-[#0A0F1E]/60 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] tracking-[0.35em] uppercase text-white/25">All Systems Operational</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {isAdmin && <NotificationCenter onOpenDeal={openWorkspace} />}
                        <Link href="/" className="text-[10px] text-white/25 hover:text-white/50 transition-colors tracking-[0.2em] uppercase">← Public Site</Link>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {safeView === "home" && <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><HomeView onStartProject={() => setView("start")} onExploreWork={() => setView("work")} /></motion.div>}
                        {safeView === "work" && <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><WorkView projects={projects} /></motion.div>}
                        {safeView === "services" && <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><ServicesView onStartProject={() => setView("start")} /></motion.div>}
                        {safeView === "start" && <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><StartProjectView onSubmit={addSubmission} /></motion.div>}
                        {safeView === "command" && <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><CommandView deals={deals as any} onJump={(v, token) => { setView(v); if (v === "workspace" && token) openWorkspace(token); }} /></motion.div>}
                        {safeView === "pipeline" && <motion.div key="pl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><PipelineView deals={deals as any} onOpen={openWorkspace} /></motion.div>}
                        {safeView === "inbox" && <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><InboxView submissions={submissions} onDelete={deleteSubmission} deals={deals} onElect={electDeal} onReject={rejectDeal} onOpenWorkspace={openWorkspace} onUpdateDeal={(token, updates) => setDeals(prev => prev.map(d => d.token === token ? { ...d, ...updates } : d))} onInterested={markInterested} /></motion.div>}
                        {safeView === "manage" && <motion.div key="m" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><ManageProjectsView projects={projects} saveProject={saveProject} deleteProject={deleteProject} updateProject={updateProject} /></motion.div>}
                        {safeView === "workspace" && activeWorkspace && <motion.div key="ws" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="h-full"><ClientWorkspaceView deal={activeWorkspace} onBack={() => setView("inbox")} adminEmail={session?.user?.email || ""} /></motion.div>}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
