// ─── SYN DEAL SNAPSHOT ─────────────────────────────────────────────────────
// Single source of truth for "everything Syn knows about this deal right now."
// Pulled fresh on every chat request. No caching — Syn must see live state.
//
// What lives here:
//   - Deal core fields (name, company, phase, status, totalPrice, etc.)
//   - Per-phase data (phase1Data...phase7Data — sanitized for prompt injection)
//   - Live payment rows from synapsis.payments
//   - Manual NEFT proofs (any pending review)
//   - Invoices issued
//   - Last 10 audit entries
//   - Open Raised Doubts / Issues count
//   - Time-based context (phase age, days since last interaction, idle warnings)
//   - canTransition map (which phase actions the engine considers eligible)
//
// This is the package the LLM gets injected as a structured JSON block. The
// LLM cannot fabricate phase status — it sees the real shape.

import { findDealByToken } from "@/lib/phases/dealStore";
import { listPaymentsForDeal, listPendingManualProofs } from "@/lib/payments/db";
import { canTransition } from "@/lib/phases/transitions";
import { supabase } from "@/lib/supabase";
import { paymentAmountFor } from "@/lib/phases/constants";
import type { Deal } from "@/app/api/deals/route";
import type { PaymentRow, ManualProofRow, InvoiceRow } from "@/lib/payments/db";
import type { PhaseData } from "@/lib/phases/schema";

// ─── Types ────────────────────────────────────────────────────────────────

export interface DealSnapshot {
    // Identity
    token: string;
    name: string;
    company: string;
    email?: string;

    // State
    phase: number;
    phaseLabel: string;
    status: string;
    createdAtMs: number;
    lastInteractionMs?: number;

    // Money
    totalPrice?: number;
    currency: string;
    paymentSchedule: { phase: number; label: string; expectedAmount: number; status: string }[];
    paymentsLive: SnapshotPayment[];
    pendingManualProofs: SnapshotManualProof[];
    invoices: SnapshotInvoice[];

    // Timing
    phaseAgeDays?: number;
    daysSinceLastInteraction?: number;
    idleWarning: "none" | "ghosting_risk" | "stalled";

    // Per-phase data (sanitized for prompt — strips internal-only fields)
    phaseDigest: {
        phase1?: SnapshotPhase1;
        phase2?: SnapshotPhase2;
        phase3?: SnapshotPhase3;
        phase4?: SnapshotPhase4;
        phase5?: SnapshotPhase5;
        phase6?: SnapshotPhase6;
        phase7?: SnapshotPhase7;
    };

    // Activity
    auditTail: SnapshotAuditEntry[];
    raisedOpen: { doubts: number; issues: number; total: number };

    // Engine
    availableTransitions: Record<string, boolean>;

    // Snapshot metadata
    builtAt: string;        // ISO timestamp
}

export interface SnapshotPayment {
    phase: number;
    status: string;
    method: string | null;
    amountMajor: number;        // INR rupees / USD dollars
    currency: string;
    capturedAt?: string;
    confirmation:
        | { source: "razorpay"; paymentId: string }
        | { source: "stripe"; sessionId: string; paymentIntentId?: string }
        | { source: "manual_neft"; utr: string }
        | { source: "none" };
}

export interface SnapshotManualProof {
    id: string;
    phase: number;
    amountMajor: number;
    utr: string;
    status: string;
    submittedAt: string;
}

export interface SnapshotInvoice {
    invoiceNumber: string;
    phase: number;
    amountMajor: number;
    currency: string;
    issuedAt: string;
}

export interface SnapshotPhase1 {
    callScheduled: boolean;
    callCompleted: boolean;
    decision?: "go" | "no-go" | "pending";
    questionnaireSubmitted: boolean;
    questionnaireAnswerCount: number;
}

export interface SnapshotPhase2 {
    blueprintStatus?: string;        // draft | sent | changes_requested | approved | declined
    blueprintVersion?: number;
    investmentTotal?: number;
    sentAt?: string;
    approvedAt?: string;
}

export interface SnapshotPhase3 {
    advancePaid: boolean;
    advancePaidAt?: string;
    advanceAmount?: number;
    assetChecklist: { id: string; label: string; required: boolean; submitted: boolean }[];
    assetsConfirmed: boolean;
    assetsConfirmedAt?: string;
}

export interface SnapshotPhase4 {
    sprintCount: number;
    latestSprintWeekOf?: string;
    latestSprintProgressPct?: number;
    needFromClient?: string[];
    activeChangeOrders: number;
    midPaymentPaid: boolean;
    finalSubmittedAt?: string;
}

export interface SnapshotPhase5 {
    deliverableCount: number;
    revisionRoundsUsed: number;
    revisionRoundsRemaining: number;     // 2 max free
    finalApprovedAt?: string;
    reviewDeadline?: string;
}

export interface SnapshotPhase6 {
    finalPaid: boolean;
    deployed: boolean;
    deployedAt?: string;
    handoverDelivered: boolean;
    supportWindowDaysLeft?: number;
}

export interface SnapshotPhase7 {
    checkInsCompleted: number;
    nextCheckInDue?: string;
    retainerStatus?: "not_offered" | "sent" | "accepted" | "declined";
    referralCount: number;
    referralsConverted: number;
}

export interface SnapshotAuditEntry {
    timestamp: string;
    actor: string;
    action: string;
    note?: string;
    phaseBefore?: number;
    phaseAfter?: number;
}

// ─── Public API ───────────────────────────────────────────────────────────

const PHASE_LABELS: Record<number, string> = {
    0: "SIGNAL — pending review",
    1: "DISCOVER — discovery questionnaire & call",
    2: "BLUEPRINT — system blueprint in preparation/review",
    3: "IGNITION — advance payment + asset collection",
    4: "BUILD — weekly sprint cycle",
    5: "DELIVER — staging review + revision rounds",
    6: "HANDOVER — final payment + delivery",
    7: "ORBIT — post-launch support",
};

const TRANSITION_PROBES = [
    "elect", "reject", "goDecision",
    "sendBlueprint", "approveBlueprint", "requestChanges", "declineBlueprint",
    "submitAsset", "confirmAssets",
    "submitFinal",
    "finalApprove", "submitRevision",
    "finalPaid", "markDeployed", "uploadHandover", "tryAdvanceToOrbit",
] as const;

export async function buildDealSnapshot(token: string): Promise<DealSnapshot | null> {
    const deal = await findDealByToken(token);
    if (!deal) return null;

    const [paymentsLive, pendingProofs, invoiceRows, auditTail, raisedOpen] = await Promise.all([
        safeListPayments(token),
        safeListProofs(token),
        safeListInvoices(token),
        safeAuditTail(deal),
        safeRaisedOpen(token),
    ]);

    const now = Date.now();
    const phaseAgeMs = deal.electedAt ? now - deal.electedAt : undefined;
    const lastIntMs = deal.lastInteractionAt;
    const daysSinceLastInteraction = lastIntMs ? Math.floor((now - lastIntMs) / 86_400_000) : undefined;

    return {
        token: deal.token,
        name: deal.name,
        company: deal.company || "",
        email: undefined,                // not exposed in deal struct, fetch elsewhere if needed

        phase: deal.phase ?? 0,
        phaseLabel: PHASE_LABELS[deal.phase ?? 0] || `Phase ${deal.phase}`,
        status: deal.status || "unknown",
        createdAtMs: deal.createdAt,
        lastInteractionMs: lastIntMs,

        totalPrice: deal.totalPrice,
        currency: deal.currency || "INR",
        paymentSchedule: buildPaymentSchedule(deal, paymentsLive),
        paymentsLive: paymentsLive.map(toSnapshotPayment),
        pendingManualProofs: pendingProofs
            .filter(p => p.deal_token === token)
            .map(toSnapshotProof),
        invoices: invoiceRows.map(toSnapshotInvoice),

        phaseAgeDays: phaseAgeMs ? Math.floor(phaseAgeMs / 86_400_000) : undefined,
        daysSinceLastInteraction,
        idleWarning:
            daysSinceLastInteraction === undefined ? "none" :
            daysSinceLastInteraction >= 14 ? "stalled" :
            daysSinceLastInteraction >= 7 ? "ghosting_risk" :
            "none",

        phaseDigest: buildPhaseDigest(deal.phaseData, deal),

        auditTail,
        raisedOpen,

        availableTransitions: buildTransitionMap(deal),

        builtAt: new Date().toISOString(),
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function safeListPayments(token: string): Promise<PaymentRow[]> {
    try { return await listPaymentsForDeal(token); }
    catch (e) { console.error("[snapshot] listPayments failed:", e); return []; }
}

async function safeListProofs(token: string): Promise<ManualProofRow[]> {
    try { return await listPendingManualProofs(); }
    catch (e) { console.error("[snapshot] listProofs failed:", e); return []; }
}

async function safeListInvoices(token: string): Promise<InvoiceRow[]> {
    try {
        const { data, error } = await supabase
            .from("invoices")
            .select("invoice_number, phase, amount_paise, currency, issued_at")
            .eq("deal_token", token)
            .order("issued_at", { ascending: false });
        if (error) throw error;
        return (data || []) as InvoiceRow[];
    } catch (e) {
        console.error("[snapshot] listInvoices failed:", e);
        return [];
    }
}

async function safeAuditTail(deal: Deal): Promise<SnapshotAuditEntry[]> {
    const audit = (deal.audit || []) as any[];
    return audit
        .slice(-10)
        .reverse()
        .map(a => ({
            timestamp: new Date(a.timestamp).toISOString(),
            actor: a.actor,
            action: a.action,
            note: a.note,
            phaseBefore: a.phaseBefore,
            phaseAfter: a.phaseAfter,
        }));
}

async function safeRaisedOpen(token: string): Promise<{ doubts: number; issues: number; total: number }> {
    try {
        const db = supabase.schema("synapsis" as any);
        const [doubtsRes, issuesRes] = await Promise.all([
            db.from("raised_items")
                .select("id", { count: "exact", head: true })
                .eq("deal_token", token)
                .eq("kind", "doubt")
                .eq("status", "open"),
            db.from("raised_items")
                .select("id", { count: "exact", head: true })
                .eq("deal_token", token)
                .eq("kind", "issue")
                .eq("status", "open"),
        ]);
        const doubts = doubtsRes.count ?? 0;
        const issues = issuesRes.count ?? 0;
        return { doubts, issues, total: doubts + issues };
    } catch (e) {
        return { doubts: 0, issues: 0, total: 0 };
    }
}

function buildPaymentSchedule(deal: Deal, payments: PaymentRow[]): DealSnapshot["paymentSchedule"] {
    if (!deal.totalPrice) return [];
    const phases: (3 | 4 | 6)[] = [3, 4, 6];
    return phases.map(p => {
        const paid = payments.find(pm => pm.phase === p);
        return {
            phase: p,
            label: p === 3 ? "Advance" : p === 4 ? "Mid-payment" : "Final",
            expectedAmount: paymentAmountFor(deal.totalPrice!, p),
            status: paid?.status || "not_yet_due",
        };
    });
}

function toSnapshotPayment(p: PaymentRow): SnapshotPayment {
    let confirmation: SnapshotPayment["confirmation"];
    if (p.razorpay_payment_id?.startsWith("pay_")) {
        confirmation = { source: "razorpay", paymentId: p.razorpay_payment_id };
    } else if (p.stripe_session_id?.startsWith("cs_")) {
        confirmation = {
            source: "stripe",
            sessionId: p.stripe_session_id,
            paymentIntentId: p.stripe_payment_intent_id || undefined,
        };
    } else if (p.razorpay_payment_id?.startsWith("neft_")) {
        confirmation = { source: "manual_neft", utr: p.razorpay_payment_id.replace(/^neft_/, "") };
    } else {
        confirmation = { source: "none" };
    }
    return {
        phase: p.phase,
        status: p.status,
        method: p.method,
        amountMajor: (p.amount_minor ?? p.amount_paise) / 100,
        currency: p.currency,
        capturedAt: p.paid_at || undefined,
        confirmation,
    };
}

function toSnapshotProof(p: ManualProofRow): SnapshotManualProof {
    return {
        id: p.id,
        phase: p.phase,
        amountMajor: p.amount_paise / 100,
        utr: p.utr,
        status: p.status,
        submittedAt: p.submitted_at,
    };
}

function toSnapshotInvoice(i: InvoiceRow): SnapshotInvoice {
    return {
        invoiceNumber: i.invoice_number,
        phase: i.phase,
        amountMajor: i.amount_paise / 100,
        currency: i.currency,
        issuedAt: i.issued_at,
    };
}

function buildPhaseDigest(pd: PhaseData | undefined, deal: Deal): DealSnapshot["phaseDigest"] {
    if (!pd) return {};
    const out: DealSnapshot["phaseDigest"] = {};

    if (pd.phase1 || deal.questionnaire) {
        const answerCount = Object.keys(deal.questionnaire || {}).length;
        out.phase1 = {
            callScheduled: !!pd.phase1?.callScheduledAt,
            callCompleted: !!pd.phase1?.callCompletedAt,
            decision: pd.phase1?.decision || "pending",
            questionnaireSubmitted: !!deal.questionnaireSubmittedAt,
            questionnaireAnswerCount: answerCount,
        };
    }
    if (pd.phase2) {
        const bp = pd.phase2.blueprint;
        out.phase2 = {
            blueprintStatus: bp?.status,
            blueprintVersion: bp?.version,
            investmentTotal: bp?.investmentTotal,
            sentAt: bp?.sentAt ? new Date(bp.sentAt).toISOString() : undefined,
            approvedAt: bp?.approvedAt ? new Date(bp.approvedAt).toISOString() : undefined,
        };
    }
    if (pd.phase3) {
        const checklist = pd.phase3.assetChecklist || [];
        out.phase3 = {
            advancePaid: !!pd.phase3.advancePaidAt,
            advancePaidAt: pd.phase3.advancePaidAt ? new Date(pd.phase3.advancePaidAt).toISOString() : undefined,
            advanceAmount: pd.phase3.advanceAmount,
            assetChecklist: checklist.map(c => ({
                id: c.id,
                label: c.label,
                required: c.required,
                submitted: c.submitted,
            })),
            assetsConfirmed: !!pd.phase3.assetsConfirmedAt,
            assetsConfirmedAt: pd.phase3.assetsConfirmedAt ? new Date(pd.phase3.assetsConfirmedAt).toISOString() : undefined,
        };
    }
    if (pd.phase4) {
        const sprints = pd.phase4.sprintReports || [];
        const latest = sprints[sprints.length - 1];
        const cos = pd.phase4.changeOrders || [];
        out.phase4 = {
            sprintCount: sprints.length,
            latestSprintWeekOf: latest?.weekOf ? new Date(latest.weekOf).toISOString() : undefined,
            latestSprintProgressPct: latest?.progressPct,
            needFromClient: latest?.needFromClient,
            activeChangeOrders: cos.filter(c => c.status === "pending").length,
            midPaymentPaid: !!pd.phase4.midPaymentPaidAt,
            finalSubmittedAt: pd.phase4.finalSubmittedAt ? new Date(pd.phase4.finalSubmittedAt).toISOString() : undefined,
        };
    }
    if (pd.phase5) {
        const rounds = pd.phase5.revisionRounds || [];
        const freeUsed = rounds.filter(r => r.isFree).length;
        out.phase5 = {
            deliverableCount: (pd.phase5.deliverables || []).length,
            revisionRoundsUsed: rounds.length,
            revisionRoundsRemaining: Math.max(0, 2 - freeUsed),
            finalApprovedAt: pd.phase5.finalApprovedAt ? new Date(pd.phase5.finalApprovedAt).toISOString() : undefined,
            reviewDeadline: pd.phase5.reviewDeadline ? new Date(pd.phase5.reviewDeadline).toISOString() : undefined,
        };
    }
    if (pd.phase6) {
        const supportWindowDays = pd.phase6.handoverPackage?.supportWindowDays || 30;
        const deployedAt = pd.phase6.deployedAt;
        const supportWindowDaysLeft = deployedAt
            ? Math.max(0, supportWindowDays - Math.floor((Date.now() - deployedAt) / 86_400_000))
            : undefined;
        out.phase6 = {
            finalPaid: !!pd.phase6.finalPaidAt,
            deployed: !!pd.phase6.deployedAt,
            deployedAt: pd.phase6.deployedAt ? new Date(pd.phase6.deployedAt).toISOString() : undefined,
            handoverDelivered: !!pd.phase6.handoverDeliveredAt,
            supportWindowDaysLeft,
        };
    }
    if (pd.phase7) {
        const checkIns = pd.phase7.checkIns || [];
        const completed = checkIns.filter(c => c.completedAt);
        const upcoming = checkIns.filter(c => !c.completedAt && c.scheduledFor > Date.now())
            .sort((a, b) => a.scheduledFor - b.scheduledFor)[0];
        const refs = pd.phase7.referrals || [];
        out.phase7 = {
            checkInsCompleted: completed.length,
            nextCheckInDue: upcoming?.scheduledFor ? new Date(upcoming.scheduledFor).toISOString() : undefined,
            retainerStatus:
                pd.phase7.retainerOffer?.acceptedAt ? "accepted" :
                pd.phase7.retainerOffer?.declinedAt ? "declined" :
                pd.phase7.retainerOffer?.sentAt ? "sent" :
                "not_offered",
            referralCount: refs.length,
            referralsConverted: refs.filter(r => r.converted).length,
        };
    }
    return out;
}

function buildTransitionMap(deal: Deal): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const action of TRANSITION_PROBES) {
        try {
            const probe = canTransition(deal, action) as boolean | { ok: boolean };
            out[action] = typeof probe === "boolean" ? probe : !!probe?.ok;
        } catch {
            out[action] = false;
        }
    }
    return out;
}

// ─── Renderer for prompt injection ─────────────────────────────────────────
// Returns a compact, structured markdown block the LLM can read directly.

export function renderSnapshotForPrompt(snap: DealSnapshot): string {
    const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
    const fmtMoney = (n: number | undefined, ccy: string) => n != null ? `${ccy === "USD" ? "$" : "₹"}${n.toLocaleString("en-IN")}` : "—";

    const lines: string[] = [];
    lines.push(`## LIVE DEAL SNAPSHOT  (built ${fmtDate(snap.builtAt)})`);
    lines.push("");
    lines.push(`- **Client:** ${snap.name}${snap.company ? ` (${snap.company})` : ""}`);
    lines.push(`- **Token:** \`${snap.token}\``);
    lines.push(`- **Phase:** ${snap.phase} — ${snap.phaseLabel}`);
    lines.push(`- **Engagement status:** ${snap.status}`);
    if (snap.totalPrice) lines.push(`- **Total project investment:** ${fmtMoney(snap.totalPrice, snap.currency)}`);
    if (snap.phaseAgeDays != null) lines.push(`- **In current phase for:** ${snap.phaseAgeDays} day(s)`);
    if (snap.daysSinceLastInteraction != null) lines.push(`- **Days since last interaction:** ${snap.daysSinceLastInteraction} (${snap.idleWarning})`);

    // Payments
    if (snap.paymentSchedule.length || snap.paymentsLive.length) {
        lines.push("");
        lines.push("### Payments");
        for (const sched of snap.paymentSchedule) {
            const live = snap.paymentsLive.find(p => p.phase === sched.phase);
            const conf = live?.confirmation.source || "none";
            lines.push(`- Phase ${sched.phase} (${sched.label}): expected ${fmtMoney(sched.expectedAmount, snap.currency)}, status=**${live?.status || sched.status}**${conf !== "none" ? ` · confirmed-via=${conf}` : ""}${live?.capturedAt ? ` · captured ${fmtDate(live.capturedAt)}` : ""}`);
        }
        if (snap.pendingManualProofs.length) {
            lines.push(`- ⚠️ ${snap.pendingManualProofs.length} manual NEFT proof(s) awaiting admin verify`);
        }
    }

    // Per-phase digest — only show phases that have data
    const pd = snap.phaseDigest;
    lines.push("");
    lines.push("### Per-phase state");
    if (pd.phase1) {
        lines.push(`- **Phase 1 (Discover):** questionnaire ${pd.phase1.questionnaireSubmitted ? `submitted (${pd.phase1.questionnaireAnswerCount} answers)` : "incomplete"}, call ${pd.phase1.callCompleted ? "completed" : pd.phase1.callScheduled ? "scheduled" : "not scheduled"}, decision=${pd.phase1.decision}`);
    }
    if (pd.phase2) {
        lines.push(`- **Phase 2 (Blueprint):** status=${pd.phase2.blueprintStatus || "—"}, version=${pd.phase2.blueprintVersion ?? "—"}, total=${fmtMoney(pd.phase2.investmentTotal, snap.currency)}${pd.phase2.sentAt ? `, sent ${fmtDate(pd.phase2.sentAt)}` : ""}${pd.phase2.approvedAt ? `, approved ${fmtDate(pd.phase2.approvedAt)}` : ""}`);
    }
    if (pd.phase3) {
        const totalReq = pd.phase3.assetChecklist.filter(a => a.required).length;
        const submittedReq = pd.phase3.assetChecklist.filter(a => a.required && a.submitted).length;
        lines.push(`- **Phase 3 (Ignition):** advance ${pd.phase3.advancePaid ? `paid ${fmtDate(pd.phase3.advancePaidAt)}` : "pending"}, assets ${totalReq === 0 ? "no requirements set" : `${submittedReq}/${totalReq} required submitted`}, confirmed=${pd.phase3.assetsConfirmed}`);
    }
    if (pd.phase4) {
        lines.push(`- **Phase 4 (Build):** ${pd.phase4.sprintCount} sprint(s), latest progress=${pd.phase4.latestSprintProgressPct ?? "—"}%, ${pd.phase4.activeChangeOrders} pending change order(s), mid-payment=${pd.phase4.midPaymentPaid ? "paid" : "pending"}${pd.phase4.finalSubmittedAt ? `, FINAL submitted ${fmtDate(pd.phase4.finalSubmittedAt)}` : ""}`);
        if (pd.phase4.needFromClient?.length) {
            lines.push(`  - Last sprint needs from client: ${pd.phase4.needFromClient.join("; ")}`);
        }
    }
    if (pd.phase5) {
        lines.push(`- **Phase 5 (Deliver):** ${pd.phase5.deliverableCount} deliverable(s), ${pd.phase5.revisionRoundsUsed} revision round(s) used (${pd.phase5.revisionRoundsRemaining} free remaining)${pd.phase5.finalApprovedAt ? `, APPROVED ${fmtDate(pd.phase5.finalApprovedAt)}` : ""}${pd.phase5.reviewDeadline ? `, review deadline ${fmtDate(pd.phase5.reviewDeadline)}` : ""}`);
    }
    if (pd.phase6) {
        lines.push(`- **Phase 6 (Handover):** final-paid=${pd.phase6.finalPaid}, deployed=${pd.phase6.deployed}${pd.phase6.deployedAt ? ` (${fmtDate(pd.phase6.deployedAt)})` : ""}, handover-delivered=${pd.phase6.handoverDelivered}${pd.phase6.supportWindowDaysLeft != null ? `, support window ${pd.phase6.supportWindowDaysLeft} day(s) left` : ""}`);
    }
    if (pd.phase7) {
        lines.push(`- **Phase 7 (Orbit):** ${pd.phase7.checkInsCompleted} check-in(s) completed${pd.phase7.nextCheckInDue ? `, next due ${fmtDate(pd.phase7.nextCheckInDue)}` : ""}, retainer=${pd.phase7.retainerStatus}, ${pd.phase7.referralCount} referral(s) (${pd.phase7.referralsConverted} converted)`);
    }

    // Available transitions
    const eligible = Object.entries(snap.availableTransitions).filter(([, ok]) => ok).map(([k]) => k);
    lines.push("");
    lines.push(`### Engine state`);
    lines.push(`- **Transitions currently eligible:** ${eligible.length ? eligible.join(", ") : "(none — phase is gated)"}`);
    lines.push(`- **Open raises:** ${snap.raisedOpen.doubts} doubt(s), ${snap.raisedOpen.issues} issue(s)`);

    // Audit tail (last 5 only for prompt brevity)
    if (snap.auditTail.length) {
        lines.push("");
        lines.push("### Recent activity (last 5)");
        for (const a of snap.auditTail.slice(0, 5)) {
            lines.push(`- ${fmtDate(a.timestamp)} · ${a.actor} · ${a.action}${a.note ? ` — ${a.note}` : ""}`);
        }
    }

    return lines.join("\n");
}
