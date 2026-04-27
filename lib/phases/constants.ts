// ─── SYNAPSIS PHASE CONSTANTS ─────────────────────────────────────────────────
// Numeric constants, label maps, and configurable thresholds. Hard-coded here
// so every piece of code references the SAME value. Change once, propagates.

// ─── Phase names (index-aligned to phase numbers 0–7) ────────────────────────

export const PHASE_NAMES = [
    "SIGNAL",     // 0 — invisible to client, admin-only review
    "DISCOVER",   // 1 — questionnaire + call + go/no-go
    "BLUEPRINT",  // 2 — system design document, client approves
    "IGNITION",   // 3 — advance payment gate + asset collection
    "BUILD",      // 4 — weekly sprint cycle, change orders
    "DELIVER",    // 5 — final build, revision rounds, approval
    "HANDOVER",   // 6 — final payment, deploy, package
    "ORBIT",      // 7 — indefinite relationship, check-ins, retainer
] as const;

export type PhaseNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PhaseName = typeof PHASE_NAMES[number];

export const phaseName = (n: number): PhaseName =>
    (PHASE_NAMES[n] as PhaseName) || "SIGNAL";

// ─── Currency lock ──────────────────────────────────────────────────────────

export const CURRENCY = "INR" as const;
export const CURRENCY_SYMBOL = "₹";

// ─── Payment split (advance / milestone / final) ────────────────────────────

export const PAYMENT_SPLIT: Record<number, { phase: number; percentage: number; label: string }> = {
    3: { phase: 3, percentage: 30, label: "Advance Payment" },
    4: { phase: 4, percentage: 30, label: "Milestone Payment" },
    6: { phase: 6, percentage: 40, label: "Final Payment" },
};

// Compute payment amount for a phase given total price
export const paymentAmountFor = (totalPrice: number, phase: number): number => {
    const cfg = PAYMENT_SPLIT[phase];
    if (!cfg) return 0;
    return Math.round((totalPrice * cfg.percentage) / 100);
};

// ─── Time windows & caps ────────────────────────────────────────────────────

export const SIGNAL_EXPIRY_HOURS = 48;              // Phase 0 auto-expire
export const SIGNAL_EXTENSION_HOURS = 3;            // client can request 3hr extension
export const SPRINT_RESPONSE_WINDOW_HOURS = 48;     // "Need from you" items
export const REVIEW_PERIOD_BUSINESS_DAYS = 5;       // Phase 5 review countdown
export const HANDOVER_SUPPORT_DAYS = 30;            // default support window
export const FREE_REVISION_ROUNDS = 2;              // Phase 5 free rounds cap
export const BLUEPRINT_CHANGE_ROUNDS_MAX = 2;       // Phase 2 negotiation cap before paid consulting
export const GHOST_WARNING_DAYS = 3;                // yellow flag
export const GHOST_ALERT_DAYS = 7;                  // red flag
export const DORMANT_MONTHS = 6;                    // Phase 7 dormant threshold

// ─── Large project threshold (drives mid-payment requirement) ───────────────

export const LARGE_PROJECT_THRESHOLD = 200000;      // ₹2,00,000 INR

// ─── Discovery Questionnaire (Phase 1 — per syna_core.md) ───────────────────

export const DISCOVERY_QUESTIONS = [
    "Describe the exact moment your current system/process fails — what is happening, who is frustrated, and what does it cost each time it happens?",
    "When this is built and running — what is the one metric or outcome that tells you it worked?",
    "What have you already tried — tools, agencies, freelancers, or internal builds? For each, what happened and why did it not stick?",
    "Walk me through what you currently use — software, tools, platforms, accounts. What must we integrate with?",
    "What are the 2-3 things about this project that are completely fixed — features, rules, or constraints that cannot change?",
    "Who else is involved in reviewing and approving work during this build — and how quickly can decisions get made?",
] as const;

export const DISCOVERY_QUESTION_MIN_CHARS = 50;

// ─── UI colors per phase (brand-aligned) ────────────────────────────────────

export const PHASE_COLORS: Record<number, string> = {
    0: "#94A3B8",   // muted slate — pre-engagement
    1: "#11B8EA",   // azure — discovery
    2: "#3B6AE8",   // royal — design
    3: "#F59E0B",   // amber — payment gate (alert attention)
    4: "#10B981",   // green — active build
    5: "#8B5CF6",   // purple — review
    6: "#F59E0B",   // amber — final payment gate
    7: "#11B8EA",   // azure — long-term relationship
};

// ─── LEVEL tab labels per phase (content component changes, label context helps) ─

export const PHASE_TAB_LABELS: Record<number, Record<"overview" | "process" | "questionnaire" | "chat", string>> = {
    1: { overview: "Overview", process: "Process", questionnaire: "Discovery Q", chat: "Chat" },
    2: { overview: "Overview", process: "Process", questionnaire: "Blueprint",   chat: "Chat" },
    3: { overview: "Overview", process: "Process", questionnaire: "Pay & Assets",chat: "Chat" },
    4: { overview: "Overview", process: "Process", questionnaire: "Sprint Log",  chat: "Chat" },
    5: { overview: "Overview", process: "Process", questionnaire: "Review",      chat: "Chat" },
    6: { overview: "Overview", process: "Process", questionnaire: "Handover",    chat: "Chat" },
    7: { overview: "Overview", process: "Process", questionnaire: "Orbit",       chat: "Chat" },
};

// ─── Admin 6-action palette per phase (per PHASES.md) ───────────────────────

export const ADMIN_PHASE_ACTIONS: Record<number, string[]> = {
    0: ["Elect", "Reject", "Mark Interested", "Archive", "View Details", "Admin Note"],
    1: ["View Questionnaire", "Schedule Call", "Log Call Notes", "GO Decision", "NO-GO Decision", "Message"],
    2: ["Build Blueprint", "Preview as Client", "Send Blueprint", "Track Negotiation", "Approve/Lock", "Notes"],
    3: ["Generate Invoice", "Manual Mark Paid", "Edit Asset Checklist", "Review Assets", "Confirm Kickoff", "Notes"],
    4: ["Post Sprint Update", "Create Change Order", "Upload Deliverable", "Request Mid-Payment", "Submit Final Build", "Notes"],
    5: ["Submit Final Build", "Review Revision Request", "Create Change Order", "Request Approval", "Message", "Notes"],
    6: ["Generate Final Invoice", "Manual Mark Paid", "Mark Deployed", "Upload Handover Package", "Mark Complete", "Notes"],
    7: ["Log Check-in", "Send Retainer Offer", "Track Referral", "Start New Project", "Notes", "Archive"],
};

// ─── Client 4-action palette per phase (per PHASES.md) ──────────────────────

export const CLIENT_PHASE_ACTIONS: Record<number, string[]> = {
    1: ["Fill Questionnaire", "View Journey Map", "Message Admin", "View Status"],
    2: ["View Blueprint", "Request Changes", "Approve/Decline", "Message Admin"],
    3: ["View Invoice", "Pay Advance", "Upload Assets", "Message Admin"],
    4: ["View Sprint Updates", "Submit Change Request", "View Staging", "Message Admin"],
    5: ["View Final Build", "Submit Revision", "Approve This", "Message Admin"],
    6: ["View Final Invoice", "Pay Final", "Download Handover", "Message Admin"],
    7: ["View Summary", "Request Support", "Refer Someone", "Message Admin"],
};

// ─── Blueprint default payment structure template ──────────────────────────

export const DEFAULT_BLUEPRINT_PAYMENT_STRUCTURE = [
    { phase: 3, label: "Advance Payment",   percentage: 30 },
    { phase: 4, label: "Milestone Payment", percentage: 30 },
    { phase: 6, label: "Final Payment",     percentage: 40 },
];

// ─── Status labels for deal health signal on pipeline ───────────────────────

export type HealthSignal = "green" | "yellow" | "red" | "purple";
// green = on track, yellow = waiting on client >3d, red = waiting on client >7d or overdue payment
// purple = waiting on admin action

export const HEALTH_SIGNAL_LABELS: Record<HealthSignal, string> = {
    green: "On track",
    yellow: "Client reminder due",
    red: "Client alert — overdue",
    purple: "Needs your action",
};
