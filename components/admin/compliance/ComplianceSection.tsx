// ─── COMPLIANCE SECTION ────────────────────────────────────────────────────
// The shell: a secondary sidebar that slides in (connected to the primary
// dashboard sidebar) + a white premium content panel. Admin-only — mounted
// from app/dashboard/page.tsx behind the isAdmin guard.

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard, Calculator, CalendarClock, Receipt,
    PiggyBank, FileSpreadsheet, Globe2, Building2, FolderLock,
    ShieldCheck,
} from "lucide-react";
import { COMPLIANCE } from "./ui";
import { cn } from "@/lib/utils";

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

export default function ComplianceSection() {
    const [active, setActive] = useState<ViewId>("overview");

    const groups: NavItem["group"][] = ["core", "records", "identity"];

    return (
        <div className="flex h-full w-full overflow-hidden" style={{ background: COMPLIANCE.panel }}>

            {/* ─── Secondary sidebar — slides in, connected to primary ─── */}
            <motion.aside
                initial={{ x: -236, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                className="shrink-0 w-[236px] h-full flex flex-col border-r"
                style={{ background: COMPLIANCE.sidebar, borderColor: "rgba(255,255,255,0.06)" }}
            >
                {/* Header */}
                <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
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

                {/* Footer */}
                <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <p className="text-[10px] leading-relaxed text-white/30">
                        System guides — you execute. Every government action has a playbook.
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
        </div>
    );
}
