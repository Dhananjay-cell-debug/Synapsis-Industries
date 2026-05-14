// ─── COMPLIANCE SECTION ────────────────────────────────────────────────────
// The shell: a secondary sidebar that slides in (connected to the primary
// dashboard sidebar) + a white premium content panel. Admin-only — mounted
// from app/dashboard/page.tsx behind the isAdmin guard.
//
// Ships with a guided tour (GuidedTour) — spotlights each route and explains
// it. Auto-runs on first visit; re-launchable from the sidebar footer.

"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard, Calculator, CalendarClock, Receipt,
    PiggyBank, FileSpreadsheet, Globe2, Building2, FolderLock,
    ShieldCheck, Compass,
} from "lucide-react";
import { COMPLIANCE } from "./ui";
import { cn } from "@/lib/utils";
import GuidedTour, { type TourStep } from "./GuidedTour";

import OverviewView from "./views/OverviewView";
import TaxEstimateView from "./views/TaxEstimateView";
import CalendarView from "./views/CalendarView";
import ExpensesView from "./views/ExpensesView";
import DeductionsView from "./views/DeductionsView";
import GstWorkspaceView from "./views/GstWorkspaceView";
import ForexView from "./views/ForexView";
import ProfileView from "./views/ProfileView";
import VaultView from "./views/VaultView";

type ViewId =
    | "overview" | "tax-estimate" | "calendar" | "expenses"
    | "deductions" | "gst" | "forex" | "profile" | "vault";

interface NavItem {
    id: ViewId;
    label: string;
    icon: React.ElementType;
    group: "core" | "records" | "identity";
}

const NAV: NavItem[] = [
    { id: "overview",     label: "Overview",        icon: LayoutDashboard,  group: "core" },
    { id: "tax-estimate", label: "Tax Estimate",    icon: Calculator,       group: "core" },
    { id: "calendar",     label: "Compliance Calendar", icon: CalendarClock, group: "core" },
    { id: "expenses",     label: "Expenses & ITC",  icon: Receipt,          group: "records" },
    { id: "deductions",   label: "Deductions",      icon: PiggyBank,        group: "records" },
    { id: "gst",          label: "GST Workspace",   icon: FileSpreadsheet,  group: "records" },
    { id: "forex",        label: "Forex & FIRC",    icon: Globe2,           group: "records" },
    { id: "profile",      label: "Tax Profile",     icon: Building2,        group: "identity" },
    { id: "vault",        label: "Document Vault",  icon: FolderLock,       group: "identity" },
];

const GROUP_LABEL: Record<NavItem["group"], string> = {
    core: "Operate",
    records: "Records",
    identity: "Identity",
};

// ─── Guided orientation flow ───────────────────────────────────────────────
const ORIENTATION: TourStep[] = [
    {
        target: "compliance-home",
        title: "Yeh tera Compliance OS hai",
        body: "Government ka saara GST + tax kaam yahan se chalega. Chal, ek-ek karke poora section dikhata hu — 1 minute lagega, koi homework nahi.",
    },
    {
        target: "nav-overview", view: "overview",
        title: "Overview",
        body: "Tera health score, agli deadlines, projected tax — sab ek nazar mein. Hafte mein ek baar yahan aana kaafi hai.",
    },
    {
        target: "nav-tax-estimate", view: "tax-estimate",
        title: "Tax Estimate",
        body: "Sliders ghuma ke dekh tera tax kitna banega. Engine live recompute karta hai — old vs new regime, dono compare automatically.",
    },
    {
        target: "nav-calendar", view: "calendar",
        title: "Compliance Calendar",
        body: "Saari deadlines ek jagah. Jab koi return file kar de — yahan aake 'Mark filed' dabana. Reminders apne aap aayenge.",
    },
    {
        target: "nav-expenses", view: "expenses",
        title: "Expenses & ITC",
        body: "Har business kharcha yahan daal — Vercel, laptop, fees. GST wala paisa wapas milta hai (ITC) — system track karega.",
    },
    {
        target: "nav-deductions", view: "deductions",
        title: "Deductions",
        body: "PPF, NPS, health insurance yahan log kar. Har entry tera taxable income kam karti hai — progress bars dikhate hain kitna bacha.",
    },
    {
        target: "nav-gst", view: "gst",
        title: "GST Workspace",
        body: "Kis client pe kitna GST banega — Indian, foreign, sab. Engine khud classify karta hai; tu sirf scenario daal ke verdict dekh.",
    },
    {
        target: "nav-forex", view: "forex",
        title: "Forex & FIRC",
        body: "Foreign client ka paisa aaye toh yahan log kar. FIRC (export ka proof) ka status bhi yahin track hota hai.",
    },
    {
        target: "nav-profile", view: "profile",
        title: "Tax Profile",
        body: "GSTIN aaye toh sabse pehle YAHAN update karna. Yeh poore system ka source of truth hai — GSTIN, LUT, regime, sab yahan se.",
    },
    {
        target: "nav-vault", view: "vault",
        title: "Document Vault",
        body: "Saare certificates, receipts, acknowledgements ek jagah. Yeh abhi ban raha hai — structure ready hai, storage layer baaki.",
    },
    {
        target: "compliance-home", view: "overview",
        title: "Bas! Itna hi.",
        body: "Roz dekhne ki zarurat nahi — alert aaye tab. Mahine ka ~20 min. Confused lage toh neeche 'Guided tour' button se yeh dobara chala lena.",
    },
];

const TOUR_FLAG = "synapsis_compliance_tour_v1";

export default function ComplianceSection() {
    const [active, setActive] = useState<ViewId>("overview");
    const [tourOn, setTourOn] = useState(false);
    const [tourStep, setTourStep] = useState(0);

    // first-visit: auto-start the tour once the panel has settled
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (localStorage.getItem(TOUR_FLAG)) return;
        const t = setTimeout(() => { setTourStep(0); setTourOn(true); }, 750);
        return () => clearTimeout(t);
    }, []);

    // when a tour step carries a view, switch to it so the real screen shows
    useEffect(() => {
        if (!tourOn) return;
        const v = ORIENTATION[tourStep]?.view;
        if (v) setActive(v as ViewId);
    }, [tourOn, tourStep]);

    const endTour = () => {
        setTourOn(false);
        setTourStep(0);
        if (typeof window !== "undefined") localStorage.setItem(TOUR_FLAG, "done");
    };
    const nextStep = () => {
        if (tourStep >= ORIENTATION.length - 1) endTour();
        else setTourStep((s) => s + 1);
    };
    const backStep = () => setTourStep((s) => Math.max(0, s - 1));

    const groups: NavItem["group"][] = ["core", "records", "identity"];

    return (
        <div className="flex h-full w-full overflow-hidden relative" style={{ background: COMPLIANCE.panel }}>

            {/* ─── Secondary sidebar — slides in, connected to primary ─── */}
            <motion.aside
                initial={{ x: -236, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                className="shrink-0 w-[236px] h-full flex flex-col border-r"
                style={{ background: COMPLIANCE.sidebar, borderColor: "rgba(255,255,255,0.06)" }}
            >
                {/* Header */}
                <div
                    data-tour="compliance-home"
                    className="px-5 py-5 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.07)" }}
                >
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: "rgba(12,151,196,0.16)" }}
                        >
                            <ShieldCheck size={16} style={{ color: COMPLIANCE.accent }} />
                        </div>
                        <div>
                            <p className="text-white text-[13px] font-semibold tracking-tight font-outfit">Compliance OS</p>
                            <p className="text-[9px] uppercase tracking-[0.2em] text-white/30">Self-file · 44ADA</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
                    {groups.map((g) => (
                        <div key={g} className="mb-4 last:mb-0">
                            <p className="px-3 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.26em] text-white/20">
                                {GROUP_LABEL[g]}
                            </p>
                            <div className="flex flex-col gap-0.5">
                                {NAV.filter((n) => n.group === g).map((item) => {
                                    const isActive = active === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            data-tour={`nav-${item.id}`}
                                            onClick={() => setActive(item.id)}
                                            className={cn(
                                                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-left w-full transition-all duration-150 group font-outfit",
                                                isActive ? "text-white" : "text-white/45 hover:text-white/80"
                                            )}
                                            style={isActive ? { background: "rgba(12,151,196,0.12)" } : undefined}
                                        >
                                            {isActive && (
                                                <span
                                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                                                    style={{ background: COMPLIANCE.accent }}
                                                />
                                            )}
                                            {!isActive && (
                                                <span className="absolute inset-0 rounded-xl bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                            <item.icon
                                                size={15}
                                                className="relative z-10 shrink-0"
                                                style={{ color: isActive ? COMPLIANCE.accent : undefined }}
                                            />
                                            <span className="relative z-10">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer — guided tour launcher */}
                <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <button
                        onClick={() => { setTourStep(0); setTourOn(true); }}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110"
                        style={{ background: "rgba(12,151,196,0.14)", color: COMPLIANCE.accent }}
                    >
                        <Compass size={13} /> Guided tour
                    </button>
                    <p className="text-[10px] leading-relaxed text-white/30 mt-2.5">
                        System guides — you execute. Har step pe tutorial saath hai.
                    </p>
                </div>
            </motion.aside>

            {/* ─── White content panel ─── */}
            <div className="flex-1 h-full overflow-y-auto">
                <div className="mx-auto max-w-[1120px] px-10 py-9">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={active}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                        >
                            {active === "overview" && <OverviewView onNavigate={(v) => setActive(v as ViewId)} />}
                            {active === "tax-estimate" && <TaxEstimateView />}
                            {active === "calendar" && <CalendarView />}
                            {active === "expenses" && <ExpensesView />}
                            {active === "deductions" && <DeductionsView />}
                            {active === "gst" && <GstWorkspaceView />}
                            {active === "forex" && <ForexView />}
                            {active === "profile" && <ProfileView />}
                            {active === "vault" && <VaultView />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* ─── Guided tour overlay ─── */}
            {tourOn && (
                <GuidedTour
                    steps={ORIENTATION}
                    stepIndex={tourStep}
                    onNext={nextStep}
                    onBack={backStep}
                    onSkip={endTour}
                />
            )}
        </div>
    );
}
