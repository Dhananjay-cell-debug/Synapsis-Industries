// ─── TRANSITION ENGINE ────────────────────────────────────────────────────────
// The brain of the phase system. Every phase jump goes through a function here.
//
// Rules:
// - Pure functions. Do NOT read or write files. Do NOT touch network.
// - Input: current Deal + context. Output: { ok, deal, audit } or { ok:false, reason }.
// - The CALLER (API route) is responsible for persistence.
// - Every transition generates an AuditEntry — appended to deal.audit[].
// - Preconditions are enforced HERE, not in UI. UI is permissive; engine is strict.

import type { Deal } from "@/app/api/deals/route";
import type { AuditEntry, Blueprint, AssetChecklistItem } from "./schema";
import { makeAuditEntry, appendAudit } from "./audit";
import {
    PAYMENT_SPLIT,
    paymentAmountFor,
    SIGNAL_EXPIRY_HOURS,
    SIGNAL_EXTENSION_HOURS,
    LARGE_PROJECT_THRESHOLD,
    BLUEPRINT_CHANGE_ROUNDS_MAX,
    DEFAULT_BLUEPRINT_PAYMENT_STRUCTURE,
    REVIEW_PERIOD_BUSINESS_DAYS,
    HANDOVER_SUPPORT_DAYS,
} from "./constants";

// ─── Result type ────────────────────────────────────────────────────────────

export type TransitionOk = { ok: true; deal: Deal; audit: AuditEntry };
export type TransitionFail = { ok: false; reason: string };
export type TransitionResult = TransitionOk | TransitionFail;

// ─── Helpers ────────────────────────────────────────────────────────────────

const now = () => Date.now();

function bump(deal: Deal, audit: AuditEntry): Deal {
    return {
        ...deal,
        audit: appendAudit(deal.audit, audit),
        lastInteractionAt: audit.timestamp,
    };
}

function setPhaseData<K extends keyof NonNullable<Deal["phaseData"]>>(
    deal: Deal,
    phaseKey: K,
    patch: Partial<NonNullable<NonNullable<Deal["phaseData"]>[K]>>
): Deal {
    const existing = deal.phaseData?.[phaseKey] as object | undefined;
    return {
        ...deal,
        phaseData: {
            ...(deal.phaseData || {}),
            [phaseKey]: { ...(existing || {}), ...patch },
        },
    };
}

// ─── T0 → 1 : ELECT (admin) ─────────────────────────────────────────────────

export function t0to1_elect(
    deal: Deal,
    ctx: { adminEmail: string; note?: string; projectDays?: number }
): TransitionResult {
    if (deal.phase !== 0) return { ok: false, reason: `Not in Phase 0 (currently ${deal.phase})` };
    if (!["pending", "interested"].includes(deal.status)) {
        return { ok: false, reason: `Cannot elect from status "${deal.status}"` };
    }

    const audit = makeAuditEntry({
        actor: "admin",
        actorEmail: ctx.adminEmail,
        action: "phase.elect",
        phaseBefore: 0,
        phaseAfter: 1,
        note: ctx.note,
        data: { projectDays: ctx.projectDays },
    });

    let d: Deal = {
        ...deal,
        status: "elected",
        phase: 1,
        electedAt: now(),
        projectDays: ctx.projectDays ?? deal.projectDays,
    };
    d = setPhaseData(d, "phase1", { startedAt: now(), levelTab: "overview" });
    d = bump(d, audit);
    return { ok: true, deal: d, audit };
}

// ─── T0 : REJECT (admin) — terminal, no phase advance ───────────────────────

export function t0_reject(
    deal: Deal,
    ctx: { adminEmail: string; note?: string }
): TransitionResult {
    if (deal.phase !== 0) return { ok: false, reason: "Not in Phase 0" };
    if (deal.status === "rejected") return { ok: false, reason: "Already rejected" };

    const audit = makeAuditEntry({
        actor: "admin",
        actorEmail: ctx.adminEmail,
        action: "phase.reject",
        phaseBefore: 0,
        note: ctx.note,
    });
    const d: Deal = bump({
        ...deal,
        status: "rejected",
        rejectedAt: now(),
        rejectionNote: ctx.note,
    }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T0 : CLIENT RECOVERY (budget / clarify / extend) ───────────────────────

export function t0_clientRecovery(
    deal: Deal,
    ctx: { kind: "budget" | "clarify" | "extend"; newBudget?: string; clarification?: string }
): TransitionResult {
    if (deal.phase !== 0) return { ok: false, reason: "Not in Phase 0" };
    const expiry = deal.extendedUntil || (deal.createdAt + SIGNAL_EXPIRY_HOURS * 3600 * 1000);
    if (now() > expiry && ctx.kind !== "extend") {
        return { ok: false, reason: "Recovery window expired" };
    }

    let patch: Partial<Deal> = {};
    if (ctx.kind === "budget" && ctx.newBudget) patch = { budget: ctx.newBudget };
    if (ctx.kind === "clarify" && ctx.clarification) patch = { clientNote: ctx.clarification };
    if (ctx.kind === "extend") patch = { extendedUntil: now() + SIGNAL_EXTENSION_HOURS * 3600 * 1000 };

    const audit = makeAuditEntry({
        actor: "client",
        action: `signal.recovery.${ctx.kind}`,
        phaseBefore: 0,
        data: { newBudget: ctx.newBudget, clarification: ctx.clarification },
    });
    const d = bump({ ...deal, ...patch, status: "interested" }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T1 → 2 : GO DECISION (admin) — or NO-GO (terminal) ─────────────────────

export function t1to2_goDecision(
    deal: Deal,
    ctx: { adminEmail: string; decision: "go" | "no-go"; reason?: string }
): TransitionResult {
    if (deal.phase !== 1) return { ok: false, reason: `Not in Phase 1 (currently ${deal.phase})` };
    // Preconditions for GO: questionnaire submitted + call completed + notes logged
    if (ctx.decision === "go") {
        if (!deal.questionnaire || Object.keys(deal.questionnaire).length === 0) {
            return { ok: false, reason: "Questionnaire not submitted yet" };
        }
        if (!deal.phaseData?.phase1?.callCompletedAt) {
            return { ok: false, reason: "Discovery call not marked completed" };
        }
        if (!deal.phaseData?.phase1?.callNotes || deal.phaseData.phase1.callNotes.length < 10) {
            return { ok: false, reason: "Call notes not logged (min 10 chars)" };
        }
    }

    if (ctx.decision === "no-go") {
        const audit = makeAuditEntry({
            actor: "admin", actorEmail: ctx.adminEmail,
            action: "phase.no-go", phaseBefore: 1, note: ctx.reason,
        });
        let d = setPhaseData(deal, "phase1", { decision: "no-go", decidedAt: now(), decisionReason: ctx.reason });
        d = bump({ ...d, status: "rejected", rejectedAt: now(), rejectionNote: ctx.reason }, audit);
        return { ok: true, deal: d, audit };
    }

    const audit = makeAuditEntry({
        actor: "admin", actorEmail: ctx.adminEmail,
        action: "phase.go", phaseBefore: 1, phaseAfter: 2, note: ctx.reason,
    });
    let d = setPhaseData(deal, "phase1", { decision: "go", decidedAt: now() });
    d = setPhaseData(d, "phase2", { startedAt: now(), levelTab: "overview", changeRequestCount: 0 });
    d = bump({ ...d, phase: 2, status: "active" }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T2 : BLUEPRINT SEND (admin) — stays in Phase 2 ─────────────────────────

export function t2_sendBlueprint(
    deal: Deal,
    ctx: { adminEmail: string; blueprint: Omit<Blueprint, "version" | "status" | "sentAt"> }
): TransitionResult {
    if (deal.phase !== 2) return { ok: false, reason: "Not in Phase 2" };

    const existing = deal.phaseData?.phase2?.blueprint;
    const history = deal.phaseData?.phase2?.blueprintHistory || [];
    const nextHistory = existing ? [...history, existing] : history;
    const nextVersion = (existing?.version || 0) + 1;

    const newBlueprint: Blueprint = {
        ...ctx.blueprint,
        version: nextVersion,
        status: "sent",
        sentAt: now(),
    };

    const audit = makeAuditEntry({
        actor: "admin", actorEmail: ctx.adminEmail,
        action: `blueprint.sent.v${nextVersion}`, phaseBefore: 2,
        data: { investmentTotal: newBlueprint.investmentTotal },
    });

    let d = setPhaseData(deal, "phase2", { blueprint: newBlueprint, blueprintHistory: nextHistory });
    d = bump(d, audit);
    return { ok: true, deal: d, audit };
}

// ─── T2 → 3 : CLIENT APPROVES BLUEPRINT ─────────────────────────────────────

export function t2to3_approveBlueprint(deal: Deal): TransitionResult {
    if (deal.phase !== 2) return { ok: false, reason: "Not in Phase 2" };
    const bp = deal.phaseData?.phase2?.blueprint;
    if (!bp || bp.status !== "sent") return { ok: false, reason: "No blueprint currently pending approval" };

    const totalPrice = bp.investmentTotal;
    const paymentStructure = bp.paymentStructure.length > 0 ? bp.paymentStructure : DEFAULT_BLUEPRINT_PAYMENT_STRUCTURE;
    const payments = paymentStructure.map(ps => ({
        phase: ps.phase,
        percentage: ps.percentage,
        amount: Math.round((totalPrice * ps.percentage) / 100),
        status: "pending" as const,
    }));

    // Seed Phase 3 asset checklist from blueprint's requiredFromClient
    const assetChecklist: AssetChecklistItem[] = (bp.requiredFromClient || []).map((label, i) => ({
        id: `asset_${Date.now()}_${i}`,
        label,
        required: true,
        submitted: false,
    }));

    const audit = makeAuditEntry({
        actor: "client",
        action: `blueprint.approved.v${bp.version}`,
        phaseBefore: 2, phaseAfter: 3,
        data: { totalPrice, paymentRows: payments.length },
    });

    let d = setPhaseData(deal, "phase2", {
        blueprint: { ...bp, status: "approved", approvedAt: now() },
    });
    d = setPhaseData(d, "phase3", {
        startedAt: now(), levelTab: "overview",
        assetChecklist,
        advanceAmount: paymentAmountFor(totalPrice, 3),
    });
    d = bump({ ...d, phase: 3, totalPrice, payments }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T2 : CLIENT REQUESTS CHANGES — stays in Phase 2 ────────────────────────

export function t2_requestChanges(deal: Deal, ctx: { feedback: string }): TransitionResult {
    if (deal.phase !== 2) return { ok: false, reason: "Not in Phase 2" };
    const bp = deal.phaseData?.phase2?.blueprint;
    if (!bp || bp.status !== "sent") return { ok: false, reason: "No blueprint pending review" };

    const currentCount = deal.phaseData?.phase2?.changeRequestCount || 0;
    if (currentCount >= BLUEPRINT_CHANGE_ROUNDS_MAX) {
        return { ok: false, reason: `Change rounds exhausted (max ${BLUEPRINT_CHANGE_ROUNDS_MAX}). Next = paid consulting.` };
    }

    const audit = makeAuditEntry({
        actor: "client", action: `blueprint.changes_requested.round${currentCount + 1}`,
        phaseBefore: 2, data: { feedback: ctx.feedback },
    });

    let d = setPhaseData(deal, "phase2", {
        blueprint: { ...bp, status: "changes_requested", clientFeedback: ctx.feedback },
        changeRequestCount: currentCount + 1,
    });
    d = bump(d, audit);
    return { ok: true, deal: d, audit };
}

// ─── T2 : CLIENT DECLINES BLUEPRINT — terminal ──────────────────────────────

export function t2_decline(deal: Deal, ctx: { reason?: string }): TransitionResult {
    if (deal.phase !== 2) return { ok: false, reason: "Not in Phase 2" };
    const bp = deal.phaseData?.phase2?.blueprint;
    if (!bp) return { ok: false, reason: "No blueprint to decline" };

    const audit = makeAuditEntry({
        actor: "client", action: "blueprint.declined",
        phaseBefore: 2, note: ctx.reason,
    });
    let d = setPhaseData(deal, "phase2", {
        blueprint: { ...bp, status: "declined", declinedAt: now(), clientFeedback: ctx.reason },
    });
    d = bump({ ...d, status: "rejected", rejectedAt: now(), rejectionNote: ctx.reason }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T3 : ADVANCE PAID (webhook OR admin manual) — does NOT advance phase ──
// Phase 4 only unlocks after assets submitted + admin confirms (T3→4).

export function t3_advancePaid(
    deal: Deal,
    ctx: { paymentId?: string; orderId?: string; source: "webhook" | "manual"; adminEmail?: string; note?: string }
): TransitionResult {
    if (deal.phase !== 3) return { ok: false, reason: "Not in Phase 3" };
    if (ctx.source === "manual" && !ctx.adminEmail) return { ok: false, reason: "Manual payment requires admin email + note" };
    if (ctx.source === "manual" && (!ctx.note || ctx.note.length < 10)) {
        return { ok: false, reason: "Manual payment requires note >=10 chars (audit)" };
    }

    const audit = makeAuditEntry({
        actor: ctx.source === "webhook" ? "system" : "admin",
        actorEmail: ctx.adminEmail,
        action: `payment.captured.advance.${ctx.source}`,
        phaseBefore: 3,
        note: ctx.note,
        data: { paymentId: ctx.paymentId, orderId: ctx.orderId },
    });

    // Mark payment row as paid
    const payments = (deal.payments || []).map(p =>
        p.phase === 3 && p.status === "pending"
            ? { ...p, status: "paid" as const, paidAt: now(), sessionId: ctx.paymentId }
            : p
    );

    let d = setPhaseData(deal, "phase3", {
        advanceRazorpayPaymentId: ctx.paymentId,
        advanceRazorpayOrderId: ctx.orderId,
        advancePaidAt: now(),
        manualPaymentNote: ctx.source === "manual" ? ctx.note : undefined,
        kickoffSummary: deal.phaseData?.phase3?.kickoffSummary
            ?? `Kickoff for ${deal.company} — ${deal.need}. Advance of ${paymentAmountFor(deal.totalPrice || 0, 3)} INR received ${new Date().toLocaleDateString("en-IN")}.`,
    });
    d = bump({ ...d, payments }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T3 : ASSET SUBMITTED BY CLIENT (per-item) ──────────────────────────────

export function t3_submitAsset(
    deal: Deal,
    ctx: { itemId: string; url: string }
): TransitionResult {
    if (deal.phase !== 3) return { ok: false, reason: "Not in Phase 3" };
    const checklist = deal.phaseData?.phase3?.assetChecklist || [];
    const idx = checklist.findIndex(a => a.id === ctx.itemId);
    if (idx === -1) return { ok: false, reason: "Asset item not found" };

    const updated = [...checklist];
    updated[idx] = { ...updated[idx], submitted: true, submittedAt: now(), url: ctx.url, rejectedReason: undefined };

    const audit = makeAuditEntry({
        actor: "client", action: "asset.submitted", phaseBefore: 3,
        data: { itemId: ctx.itemId, label: updated[idx].label },
    });
    let d = setPhaseData(deal, "phase3", { assetChecklist: updated });
    d = bump(d, audit);
    return { ok: true, deal: d, audit };
}

// ─── T3 → 4 : CONFIRM ASSETS (admin) — compound gate check ──────────────────

export function t3to4_confirmAssets(
    deal: Deal,
    ctx: { adminEmail: string; note?: string }
): TransitionResult {
    if (deal.phase !== 3) return { ok: false, reason: "Not in Phase 3" };
    if (!deal.phaseData?.phase3?.advancePaidAt) {
        return { ok: false, reason: "Advance payment not received yet" };
    }
    const checklist = deal.phaseData?.phase3?.assetChecklist || [];
    const requiredPending = checklist.filter(a => a.required && !a.submitted);
    if (requiredPending.length > 0) {
        return { ok: false, reason: `${requiredPending.length} required asset(s) still pending: ${requiredPending.map(a => a.label).join(", ")}` };
    }

    const audit = makeAuditEntry({
        actor: "admin", actorEmail: ctx.adminEmail,
        action: "phase.assets_confirmed", phaseBefore: 3, phaseAfter: 4, note: ctx.note,
    });
    let d = setPhaseData(deal, "phase3", { assetsConfirmedAt: now() });
    d = setPhaseData(d, "phase4", { startedAt: now(), levelTab: "overview", sprintReports: [], changeOrders: [] });
    d = bump({ ...d, phase: 4 }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T4 → 5 : SUBMIT FINAL BUILD (admin) ────────────────────────────────────

export function t4to5_submitFinal(
    deal: Deal,
    ctx: { adminEmail: string; stagingUrl: string; note?: string }
): TransitionResult {
    if (deal.phase !== 4) return { ok: false, reason: "Not in Phase 4" };

    const sprintReports = deal.phaseData?.phase4?.sprintReports || [];
    if (sprintReports.length === 0) {
        return { ok: false, reason: "At least 1 sprint report required before final submission" };
    }

    // Mid-payment check for large projects
    const isLarge = (deal.totalPrice || 0) >= LARGE_PROJECT_THRESHOLD;
    if (isLarge) {
        const midPaid = deal.payments?.find(p => p.phase === 4 && p.status === "paid");
        if (!midPaid) {
            return { ok: false, reason: `Project total ≥ ₹${LARGE_PROJECT_THRESHOLD / 1000}k — mid-payment must be paid before final` };
        }
    }

    const audit = makeAuditEntry({
        actor: "admin", actorEmail: ctx.adminEmail,
        action: "phase.final_submitted", phaseBefore: 4, phaseAfter: 5,
        note: ctx.note, data: { stagingUrl: ctx.stagingUrl },
    });

    const reviewStart = now();
    const reviewDeadline = reviewStart + (REVIEW_PERIOD_BUSINESS_DAYS * 24 * 3600 * 1000);

    let d = setPhaseData(deal, "phase4", {
        finalSubmittedAt: reviewStart, stagingUrl: ctx.stagingUrl,
    });
    d = setPhaseData(d, "phase5", {
        startedAt: reviewStart, levelTab: "overview",
        reviewPeriodStartedAt: reviewStart, reviewDeadline,
        deliverables: [{ id: `dlv_${Date.now()}`, version: 1, uploadedAt: reviewStart, url: ctx.stagingUrl, description: "Initial final build" }],
        revisionRounds: [],
    });
    d = bump({ ...d, phase: 5 }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T4 : MID PAYMENT (webhook OR admin manual) ─────────────────────────────

export function t4_midPaymentPaid(
    deal: Deal,
    ctx: { paymentId?: string; orderId?: string; source: "webhook" | "manual"; adminEmail?: string; note?: string }
): TransitionResult {
    if (deal.phase !== 4) return { ok: false, reason: "Not in Phase 4" };
    if (ctx.source === "manual" && (!ctx.adminEmail || !ctx.note || ctx.note.length < 10)) {
        return { ok: false, reason: "Manual mid-payment requires admin email + note ≥10 chars" };
    }

    const payments = (deal.payments || []).map(p =>
        p.phase === 4 && p.status === "pending"
            ? { ...p, status: "paid" as const, paidAt: now(), sessionId: ctx.paymentId }
            : p
    );
    const audit = makeAuditEntry({
        actor: ctx.source === "webhook" ? "system" : "admin", actorEmail: ctx.adminEmail,
        action: `payment.captured.mid.${ctx.source}`, phaseBefore: 4, note: ctx.note,
        data: { paymentId: ctx.paymentId, orderId: ctx.orderId },
    });
    let d = setPhaseData(deal, "phase4", {
        midRazorpayPaymentId: ctx.paymentId, midRazorpayOrderId: ctx.orderId, midPaymentPaidAt: now(),
    });
    d = bump({ ...d, payments }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T5 → 6 : FINAL APPROVAL (client) ───────────────────────────────────────

export function t5to6_finalApprove(deal: Deal): TransitionResult {
    if (deal.phase !== 5) return { ok: false, reason: "Not in Phase 5" };
    const deliverables = deal.phaseData?.phase5?.deliverables || [];
    if (deliverables.length === 0) {
        return { ok: false, reason: "No deliverable to approve" };
    }

    const sumPaid = (deal.payments || []).filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const finalInvoiceAmount = Math.max(0, (deal.totalPrice || 0) - sumPaid);

    const audit = makeAuditEntry({
        actor: "client", action: "final.approved",
        phaseBefore: 5, phaseAfter: 6,
        data: { finalInvoiceAmount },
    });

    let d = setPhaseData(deal, "phase5", { finalApprovedAt: now() });
    d = setPhaseData(d, "phase6", {
        startedAt: now(), levelTab: "overview",
        finalInvoiceAmount,
    });
    d = bump({ ...d, phase: 6 }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T5 : SUBMIT REVISION (client) — stays in Phase 5 ───────────────────────

export function t5_submitRevision(
    deal: Deal,
    ctx: { feedback: string }
): TransitionResult {
    if (deal.phase !== 5) return { ok: false, reason: "Not in Phase 5" };
    const rounds = deal.phaseData?.phase5?.revisionRounds || [];
    const existingFreeCount = rounds.filter(r => r.isFree).length;
    const nextRoundNumber = rounds.length + 1;
    const isFree = existingFreeCount < 2;

    const newRound = {
        id: `rev_${Date.now()}`,
        roundNumber: nextRoundNumber,
        feedback: ctx.feedback,
        submittedAt: now(),
        isFree,
    };

    const audit = makeAuditEntry({
        actor: "client", action: `revision.round${nextRoundNumber}.${isFree ? "free" : "paid"}`,
        phaseBefore: 5, data: { feedback: ctx.feedback },
    });

    let d = setPhaseData(deal, "phase5", { revisionRounds: [...rounds, newRound] });
    d = bump(d, audit);
    return { ok: true, deal: d, audit };
}

// ─── T6 : FINAL PAYMENT (webhook OR manual) ─────────────────────────────────

export function t6_finalPaid(
    deal: Deal,
    ctx: { paymentId?: string; orderId?: string; source: "webhook" | "manual"; adminEmail?: string; note?: string }
): TransitionResult {
    if (deal.phase !== 6) return { ok: false, reason: "Not in Phase 6" };
    if (ctx.source === "manual" && (!ctx.adminEmail || !ctx.note || ctx.note.length < 10)) {
        return { ok: false, reason: "Manual final payment requires admin email + note ≥10 chars" };
    }

    const payments = (deal.payments || []).map(p =>
        p.phase === 6 && p.status === "pending"
            ? { ...p, status: "paid" as const, paidAt: now(), sessionId: ctx.paymentId }
            : p
    );
    const audit = makeAuditEntry({
        actor: ctx.source === "webhook" ? "system" : "admin", actorEmail: ctx.adminEmail,
        action: `payment.captured.final.${ctx.source}`, phaseBefore: 6,
        note: ctx.note, data: { paymentId: ctx.paymentId, orderId: ctx.orderId },
    });
    let d = setPhaseData(deal, "phase6", {
        finalRazorpayPaymentId: ctx.paymentId, finalRazorpayOrderId: ctx.orderId, finalPaidAt: now(),
    });
    d = bump({ ...d, payments }, audit);
    return { ok: true, deal: d, audit };
}

// ─── T6 : MARK DEPLOYED (admin) ─────────────────────────────────────────────

export function t6_markDeployed(
    deal: Deal, ctx: { adminEmail: string; note?: string }
): TransitionResult {
    if (deal.phase !== 6) return { ok: false, reason: "Not in Phase 6" };
    if (!deal.phaseData?.phase6?.finalPaidAt) return { ok: false, reason: "Final payment not received yet" };

    const audit = makeAuditEntry({
        actor: "admin", actorEmail: ctx.adminEmail, action: "deploy.marked",
        phaseBefore: 6, note: ctx.note,
    });
    let d = setPhaseData(deal, "phase6", { deployedAt: now() });
    d = bump(d, audit);
    return { ok: true, deal: d, audit };
}

// ─── T6 : UPLOAD HANDOVER PACKAGE (admin) ───────────────────────────────────

export function t6_uploadHandover(
    deal: Deal,
    ctx: { adminEmail: string; handoverPackage: NonNullable<NonNullable<Deal["phaseData"]>["phase6"]>["handoverPackage"] }
): TransitionResult {
    if (deal.phase !== 6) return { ok: false, reason: "Not in Phase 6" };
    if (!ctx.handoverPackage) return { ok: false, reason: "Handover package is empty" };

    const audit = makeAuditEntry({
        actor: "admin", actorEmail: ctx.adminEmail, action: "handover.uploaded",
        phaseBefore: 6,
    });
    let d = setPhaseData(deal, "phase6", {
        handoverPackage: { supportWindowDays: HANDOVER_SUPPORT_DAYS, ...ctx.handoverPackage },
        handoverDeliveredAt: now(),
    });
    d = bump(d, audit);
    return { ok: true, deal: d, audit };
}

// ─── T6 → 7 : ORBIT ADVANCE (triple compound check) ─────────────────────────
// Auto-called after any of: finalPaid, deployed, handover upload.
// Only advances when ALL three sub-gates have fired.

export function t6to7_tryAdvance(deal: Deal): TransitionResult {
    if (deal.phase !== 6) return { ok: false, reason: "Not in Phase 6" };
    const p6 = deal.phaseData?.phase6;
    if (!p6?.finalPaidAt)         return { ok: false, reason: "Sub-gate failed: final payment" };
    if (!p6?.deployedAt)          return { ok: false, reason: "Sub-gate failed: deployed" };
    if (!p6?.handoverDeliveredAt) return { ok: false, reason: "Sub-gate failed: handover package" };

    const audit = makeAuditEntry({
        actor: "system", action: "phase.orbit_entered",
        phaseBefore: 6, phaseAfter: 7,
    });

    // Seed Phase 7 check-ins
    const t = now();
    const day = 24 * 3600 * 1000;
    const checkIns = [
        { id: `chk_30_${t}`,   type: "30d" as const,    scheduledFor: t + 30 * day },
        { id: `chk_90_${t}`,   type: "90d" as const,    scheduledFor: t + 90 * day },
        { id: `chk_ann_${t}`,  type: "annual" as const, scheduledFor: t + 365 * day },
    ];

    let d = setPhaseData(deal, "phase7", {
        startedAt: t, levelTab: "overview", checkIns, referrals: [],
    });
    d = bump({ ...d, phase: 7, status: "active" }, audit);
    return { ok: true, deal: d, audit };
}

// ─── GOD MODE : FORCE PHASE JUMP (admin override) ───────────────────────────
// Audit note mandatory. Used only when automated flow is stuck and admin takes manual control.

export function forcePhaseJump(
    deal: Deal,
    ctx: { adminEmail: string; toPhase: number; note: string }
): TransitionResult {
    if (!ctx.note || ctx.note.length < 10) {
        return { ok: false, reason: "God-mode jump requires note ≥10 chars (compliance)" };
    }
    if (ctx.toPhase < 0 || ctx.toPhase > 7) {
        return { ok: false, reason: "Invalid phase number" };
    }

    const audit = makeAuditEntry({
        actor: "admin", actorEmail: ctx.adminEmail,
        action: "phase.god_mode_jump",
        phaseBefore: deal.phase, phaseAfter: ctx.toPhase,
        note: ctx.note,
    });
    const d = bump({ ...deal, phase: ctx.toPhase }, audit);
    return { ok: true, deal: d, audit };
}

// ─── Preconditions check (used by UI to enable/disable transition buttons) ──

export function canTransition(deal: Deal, transitionName: string): { ok: boolean; reason?: string } {
    // Dry-run: call the relevant transition with a stub ctx and see if it returns ok
    // (We rely on the transition functions being pure — no side effects on failure.)
    switch (transitionName) {
        case "elect":              return precheck(t0to1_elect(deal, { adminEmail: "dry@run" }));
        case "reject":             return precheck(t0_reject(deal, { adminEmail: "dry@run" }));
        case "go":                 return precheck(t1to2_goDecision(deal, { adminEmail: "dry@run", decision: "go" }));
        case "approveBlueprint":   return precheck(t2to3_approveBlueprint(deal));
        case "confirmAssets":      return precheck(t3to4_confirmAssets(deal, { adminEmail: "dry@run" }));
        case "submitFinal":        return precheck(t4to5_submitFinal(deal, { adminEmail: "dry@run", stagingUrl: "dry" }));
        case "finalApprove":       return precheck(t5to6_finalApprove(deal));
        case "orbitAdvance":       return precheck(t6to7_tryAdvance(deal));
        default:                   return { ok: false, reason: "Unknown transition" };
    }
}
function precheck(r: TransitionResult): { ok: boolean; reason?: string } {
    if (r.ok) return { ok: true };
    return { ok: false, reason: (r as TransitionFail).reason };
}
