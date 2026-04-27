// ─── SYNAPSIS PHASE SCHEMA — Single Source of Truth ───────────────────────────
// Every phase's data shape is locked here. If you're touching phase data
// anywhere in the app, the type MUST come from this file.
//
// Design rules:
// - All timestamps = number (Date.now()). No Date objects (JSON-unfriendly).
// - All optional fields use `?` — the deal starts empty and fills up as phases progress.
// - Server is source of truth. Client mutates via `/api/deals/[token]/phase/[n]` only.

// ─── Shared primitives ────────────────────────────────────────────────────────

export type Timestamp = number;
export type Actor = "admin" | "client" | "system";
export type UUID = string;

// ─── Audit (every mutation passes through audit.ts) ──────────────────────────

export interface AuditEntry {
    id: UUID;
    timestamp: Timestamp;
    actor: Actor;
    actorEmail?: string;           // admin email when actor = admin
    action: string;                // "phase.elect", "payment.captured", "blueprint.sent", etc.
    phaseBefore?: number;
    phaseAfter?: number;
    note?: string;                 // mandatory on god-mode overrides
    data?: Record<string, unknown>;
}

// ─── LEVEL system (per LEVEL.md — one-way tab progression within each phase) ─

export type LevelTab = "overview" | "process" | "questionnaire" | "chat";

// ─── PHASE 1 — DISCOVER ──────────────────────────────────────────────────────

export interface Phase1Data {
    startedAt?: Timestamp;
    levelTab?: LevelTab;            // where client currently is in LEVEL system
    // discovery questionnaire lives on deal.questionnaire (existing field)
    callScheduledAt?: Timestamp;
    callMeetingLink?: string;
    callCompletedAt?: Timestamp;
    callNotes?: string;             // admin's internal notes
    decision?: "go" | "no-go";
    decidedAt?: Timestamp;
    decisionReason?: string;
}

// ─── PHASE 2 — BLUEPRINT ─────────────────────────────────────────────────────

export interface BlueprintInvestmentLine {
    label: string;                  // "Design & prototyping"
    amount: number;                 // INR
}

export interface BlueprintTimelineSprint {
    sprintNumber: number;
    goal: string;
    durationWeeks: number;
}

export interface BlueprintTechLine {
    tech: string;                   // "Next.js 14"
    rationale: string;              // why this
}

export interface BlueprintPaymentRow {
    phase: number;                  // 3, 4, or 6
    label: string;                  // "Advance", "Milestone", "Final"
    percentage: number;             // 30, 30, 40 default
}

export type BlueprintStatus =
    | "draft"
    | "sent"
    | "changes_requested"
    | "approved"
    | "declined";

export interface Blueprint {
    version: number;                            // increments on each resend
    problemStatement: string;
    solutionArchitecture: string;
    scopeIn: string[];
    scopeOut: string[];
    techStack: BlueprintTechLine[];
    timeline: BlueprintTimelineSprint[];
    investment: BlueprintInvestmentLine[];
    investmentTotal: number;                    // INR — becomes deal.totalPrice on approval
    paymentStructure: BlueprintPaymentRow[];
    requiredFromClient: string[];               // becomes Phase 3 asset checklist seed
    status: BlueprintStatus;
    sentAt?: Timestamp;
    approvedAt?: Timestamp;
    declinedAt?: Timestamp;
    clientFeedback?: string;                    // populated when status = "changes_requested"
}

export interface Phase2Data {
    startedAt?: Timestamp;
    levelTab?: LevelTab;
    blueprint?: Blueprint;                      // current/latest version
    blueprintHistory?: Blueprint[];             // archived prior versions
    changeRequestCount?: number;                // enforces BLUEPRINT_CHANGE_ROUNDS_MAX
}

// ─── PHASE 3 — IGNITION ──────────────────────────────────────────────────────

export interface AssetChecklistItem {
    id: UUID;
    label: string;                              // "Logo files (SVG preferred)"
    description?: string;
    required: boolean;
    submitted: boolean;
    submittedAt?: Timestamp;
    url?: string;                               // from /api/upload
    rejectedReason?: string;                    // if admin rejects, client sees this
}

export interface Phase3Data {
    startedAt?: Timestamp;
    levelTab?: LevelTab;
    advanceRazorpayOrderId?: string;
    advanceRazorpayPaymentId?: string;
    advancePaidAt?: Timestamp;
    advanceAmount?: number;                     // INR
    kickoffSummary?: string;                    // auto-generated on payment capture
    assetChecklist?: AssetChecklistItem[];
    assetsConfirmedAt?: Timestamp;
    manualPaymentNote?: string;                 // if admin marks paid manually (audit required)
}

// ─── PHASE 4 — BUILD ─────────────────────────────────────────────────────────

export interface SprintReport {
    id: UUID;
    weekOf: Timestamp;
    postedAt: Timestamp;
    done: string[];
    next: string[];
    needFromClient: string[];
    responseDeadline: Timestamp;                // postedAt + 48hrs
    clientResponse?: string;
    clientRespondedAt?: Timestamp;
    stagingUrl?: string;
    progressPct: number;                        // 0–100
}

export type ChangeOrderStatus = "pending" | "approved" | "declined";

export interface ChangeOrder {
    id: UUID;
    createdAt: Timestamp;
    title: string;
    description: string;
    scopeImpact: string;
    timelineImpactDays: number;
    costImpact: number;                         // INR
    status: ChangeOrderStatus;
    decidedAt?: Timestamp;
    clientNote?: string;
}

export interface Phase4Data {
    startedAt?: Timestamp;
    levelTab?: LevelTab;
    sprintReports?: SprintReport[];
    changeOrders?: ChangeOrder[];
    midRazorpayOrderId?: string;
    midRazorpayPaymentId?: string;
    midPaymentPaidAt?: Timestamp;
    midPaymentAmount?: number;
    stagingUrl?: string;                        // current working build
    finalSubmittedAt?: Timestamp;               // trigger for T4→5
}

// ─── PHASE 5 — DELIVER ───────────────────────────────────────────────────────

export interface Deliverable {
    id: UUID;
    version: number;
    uploadedAt: Timestamp;
    url: string;
    description: string;
}

export interface RevisionRound {
    id: UUID;
    roundNumber: number;                        // 1, 2 free; 3+ = Change Order triggered
    feedback: string;
    submittedAt: Timestamp;
    resolvedAt?: Timestamp;
    isFree: boolean;
    linkedChangeOrderId?: UUID;                 // if round exceeded free cap
}

export interface Phase5Data {
    startedAt?: Timestamp;
    levelTab?: LevelTab;
    reviewPeriodStartedAt?: Timestamp;
    reviewDeadline?: Timestamp;
    deliverables?: Deliverable[];
    revisionRounds?: RevisionRound[];
    finalApprovedAt?: Timestamp;                // trigger for T5→6
}

// ─── PHASE 6 — HANDOVER ──────────────────────────────────────────────────────

export interface HandoverPackage {
    builtSummary: string;
    howToUseGuide: string;                      // markdown
    accessCredentials: string;                  // V1 plain; V2 encrypted vault
    architectureOverview: string;
    emergencyContact: string;
    supportWindowDays: number;                  // default 30
    downloadUrl?: string;                       // zip or pdf
}

export interface Phase6Data {
    startedAt?: Timestamp;
    levelTab?: LevelTab;
    finalInvoiceAmount?: number;                // INR
    finalRazorpayOrderId?: string;
    finalRazorpayPaymentId?: string;
    finalPaidAt?: Timestamp;
    deployedAt?: Timestamp;                     // admin marks after production deploy
    handoverPackage?: HandoverPackage;
    handoverDeliveredAt?: Timestamp;            // compound trigger for T6→7
}

// ─── PHASE 7 — ORBIT ─────────────────────────────────────────────────────────

export type CheckInType = "30d" | "90d" | "annual" | "adhoc";

export interface CheckIn {
    id: UUID;
    type: CheckInType;
    scheduledFor: Timestamp;
    completedAt?: Timestamp;
    notes?: string;                             // admin's notes
    clientFeedback?: string;
}

export interface RetainerOffer {
    monthlyAmount: number;                      // INR
    hoursIncluded: number;
    sentAt?: Timestamp;
    acceptedAt?: Timestamp;
    declinedAt?: Timestamp;
    razorpaySubscriptionId?: string;            // if accepted and subscription created
}

export interface Referral {
    id: UUID;
    createdAt: Timestamp;
    referredName: string;
    referredCompany?: string;
    referredContact?: string;                   // email or phone
    converted: boolean;                         // became paying client?
    convertedDealToken?: string;
}

export interface Phase7Data {
    startedAt?: Timestamp;
    levelTab?: LevelTab;
    checkIns?: CheckIn[];
    retainerOffer?: RetainerOffer;
    referrals?: Referral[];
    lastInteractionAt?: Timestamp;              // used to flag dormant clients
}

// ─── The umbrella phase data container on Deal ──────────────────────────────

export interface PhaseData {
    phase1?: Phase1Data;
    phase2?: Phase2Data;
    phase3?: Phase3Data;
    phase4?: Phase4Data;
    phase5?: Phase5Data;
    phase6?: Phase6Data;
    phase7?: Phase7Data;
}

// ─── Chat (per-phase threads, typed form) ───────────────────────────────────

export interface ChatMessage {
    id: UUID;
    phase: number;                              // 1–7
    from: "admin" | "client";
    text: string;
    imageUrl?: string;
    timestamp: Timestamp;
    readByAdmin?: boolean;
    readByClient?: boolean;
}

// ─── Notification primitive (in-portal + email triggers) ────────────────────

export type NotificationKind =
    | "inbox.new"
    | "phase.advanced"
    | "payment.captured"
    | "payment.failed"
    | "blueprint.approved"
    | "blueprint.declined"
    | "blueprint.changes_requested"
    | "questionnaire.submitted"
    | "assets.uploaded"
    | "revision.requested"
    | "final.approved"
    | "chat.new"
    | "client.ghosted"
    | "checkin.due";

export interface Notification {
    id: UUID;
    kind: NotificationKind;
    dealToken: string;
    clientName: string;
    phase: number;
    title: string;
    body?: string;
    createdAt: Timestamp;
    readAt?: Timestamp;
    urgent?: boolean;
}
