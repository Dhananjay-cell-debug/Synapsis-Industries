// ─── SYN ORCHESTRATOR ──────────────────────────────────────────────────────
// The autonomous core. For a single deal, picks the relevant checklists,
// runs verification, and if a checklist passes — fires the corresponding
// transition through the pure transition pipeline. Persists. Audits. Notifies.
//
// Called by:
//   1. /api/syn/cron/sweep — every 5 min over all active deals
//   2. /api/razorpay/webhook + /api/stripe/webhook (payment post-hook)
//   3. /api/syn/orchestrator/run — admin manual trigger for one deal

import { mutateDeal } from "@/lib/phases/dealStore";
import type { Deal } from "@/app/api/deals/route";
import { relevantChecklistsForDeal, getChecklist } from "./checklists";
import { buildVerifyCtx, runChecklist, type VerifyOutcome, type Checklist } from "./verification";
import { recordSynAction, evidenceFromOutcome } from "./audit";
import {
    t0to1_elect, t0_reject,
    t1to2_goDecision,
    t2_sendBlueprint,
    t3to4_confirmAssets,
    t4to5_submitFinal,
    t6_markDeployed, t6_uploadHandover, t6to7_tryAdvance,
} from "@/lib/phases/transitions";
import type { TransitionResult } from "@/lib/phases/transitions";

// Bot email — used as adminEmail for transitions Syn fires.
const SYN_BOT_EMAIL = "syn-bot@synapsis-industries.local";

export interface SweepReport {
    dealToken: string;
    phase: number;
    checklistsRun: number;
    transitionsFired: string[];
    blocked: { checklistId: string; blockedBy: string | null }[];
    errors: { checklistId: string; error: string }[];
}

/**
 * Run all relevant checklists for one deal. Fire transitions where verification passes.
 * Idempotent — a deal that already advanced past the checklist's target phase is a no-op.
 */
export async function synSweep(deal: Deal): Promise<SweepReport> {
    const report: SweepReport = {
        dealToken: deal.token,
        phase: deal.phase ?? 0,
        checklistsRun: 0,
        transitionsFired: [],
        blocked: [],
        errors: [],
    };

    // Respect per-deal kill-switch
    if ((deal as any).synKillSwitch?.active) {
        await recordSynAction({
            dealToken: deal.token,
            actionType: "verify",
            outcome: "blocked",
            evidence: { reason: "kill_switch_active" },
            note: "Skipped sweep — deal kill-switch ON",
            initiatedBy: "syn_auto",
        });
        return report;
    }

    const checklists = relevantChecklistsForDeal(deal.phase ?? 0);
    if (checklists.length === 0) return report;

    let workingDeal = deal;
    for (const checklist of checklists) {
        report.checklistsRun++;
        try {
            const ctx = await buildVerifyCtx(workingDeal);
            const outcome = await runChecklist(checklist, workingDeal, ctx);

            if (!outcome.passed) {
                report.blocked.push({ checklistId: checklist.id, blockedBy: outcome.blockedBy });
                await recordSynAction({
                    dealToken: workingDeal.token,
                    actionType: "transition.blocked",
                    targetAction: checklist.targetAction,
                    outcome: "blocked",
                    checklistId: checklist.id,
                    evidence: evidenceFromOutcome(outcome),
                    initiatedBy: "syn_auto",
                });
                continue;
            }

            // Verification passed — fire the transition
            const fired: TransitionResult = await fireTransition(workingDeal, checklist, outcome);
            if (fired.ok === true) {
                report.transitionsFired.push(checklist.targetAction);
                workingDeal = fired.deal;
            } else {
                const failReason = (fired as { ok: false; reason: string }).reason;
                report.errors.push({ checklistId: checklist.id, error: failReason });
                await recordSynAction({
                    dealToken: workingDeal.token,
                    actionType: "transition.attempt",
                    targetAction: checklist.targetAction,
                    outcome: "error",
                    checklistId: checklist.id,
                    evidence: { reason: failReason, verify: evidenceFromOutcome(outcome) },
                    initiatedBy: "syn_auto",
                });
            }
        } catch (e) {
            const msg = String((e as Error)?.message || e);
            report.errors.push({ checklistId: checklist.id, error: msg });
            await recordSynAction({
                dealToken: workingDeal.token,
                actionType: "verify",
                checklistId: checklist.id,
                outcome: "error",
                evidence: { error: msg },
                initiatedBy: "syn_auto",
            });
        }
    }

    return report;
}

// ─── Internals ────────────────────────────────────────────────────────────

async function fireTransition(
    deal: Deal,
    checklist: Checklist,
    outcome: VerifyOutcome,
): Promise<TransitionResult> {
    const adminCtx = { adminEmail: SYN_BOT_EMAIL, note: `Auto-fired by Syn after ${checklist.id} passed` };

    let result: TransitionResult;
    switch (checklist.targetAction) {
        case "elect":
            result = t0to1_elect(deal, adminCtx);
            break;
        case "reject":
            result = t0_reject(deal, { adminEmail: SYN_BOT_EMAIL, note: "Auto-rejected: inbox timer + grace window expired" });
            break;
        case "goDecision":
            result = t1to2_goDecision(deal, { adminEmail: SYN_BOT_EMAIL, decision: "go" });
            break;
        case "sendBlueprint": {
            // Pull the existing draft blueprint and dispatch it via Syn.
            const draft = deal.phaseData?.phase2?.blueprint;
            if (!draft) return { ok: false, reason: "No draft blueprint to send" };
            const { version: _v, status: _s, sentAt: _sa, ...payload } = draft;
            result = t2_sendBlueprint(deal, { adminEmail: SYN_BOT_EMAIL, blueprint: payload });
            break;
        }
        case "confirmAssets":
            result = t3to4_confirmAssets(deal, adminCtx);
            break;
        case "submitFinal": {
            const stagingUrl = deal.phaseData?.phase4?.stagingUrl;
            if (!stagingUrl) return { ok: false, reason: "No stagingUrl set" };
            result = t4to5_submitFinal(deal, { adminEmail: SYN_BOT_EMAIL, stagingUrl, note: adminCtx.note });
            break;
        }
        case "markDeployed":
            result = t6_markDeployed(deal, adminCtx);
            break;
        case "uploadHandover": {
            const hp = deal.phaseData?.phase6?.handoverPackage;
            if (!hp) return { ok: false, reason: "No handoverPackage prepared" };
            result = t6_uploadHandover(deal, { adminEmail: SYN_BOT_EMAIL, handoverPackage: hp });
            break;
        }
        case "tryAdvanceToOrbit":
            result = t6to7_tryAdvance(deal);
            break;
        case "t3_advancePaid":
        case "t6_finalPaid":
            return { ok: false, reason: "payment transitions are webhook-fired only" };
        default:
            return { ok: false, reason: `No transition handler for ${checklist.targetAction}` };
    }

    if (!result.ok) return result;

    // Persist
    const persisted = await mutateDeal(deal.token, () => result.deal);
    if (!persisted) {
        return { ok: false, reason: "Persistence failed (mutateDeal returned null)" };
    }

    // Audit success
    await recordSynAction({
        dealToken: deal.token,
        actionType: "transition.fired",
        targetAction: checklist.targetAction,
        outcome: "success",
        checklistId: checklist.id,
        evidence: {
            phaseBefore: result.audit.phaseBefore,
            phaseAfter: result.audit.phaseAfter,
            verify: evidenceFromOutcome(outcome),
        },
        initiatedBy: "syn_auto",
        note: `Phase ${result.audit.phaseBefore} → ${result.audit.phaseAfter}`,
    });

    // Side effect: notify admin via email
    await notifyAdminTransition(deal, checklist, result).catch(e => {
        console.error("[orchestrator] notify failed:", e);
    });

    return { ok: true, deal: persisted, audit: result.audit };
}

async function notifyAdminTransition(deal: Deal, checklist: Checklist, result: TransitionResult): Promise<void> {
    if (!result.ok) return;
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.ADMIN_EMAIL) return;
    try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });
        await transporter.sendMail({
            from: `Syn (Synapsis pilot) <${process.env.GMAIL_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `🤖 Syn fired: ${checklist.targetAction} for ${deal.name}`,
            html: `
                <h2>Syn just advanced ${deal.name} (${deal.company || "—"})</h2>
                <p><strong>Action:</strong> ${checklist.targetAction}</p>
                <p><strong>Phase:</strong> ${result.audit.phaseBefore} → ${result.audit.phaseAfter}</p>
                <p><strong>Checklist:</strong> ${checklist.id}</p>
                <p><strong>Deal token:</strong> ${deal.token}</p>
                <p>Open admin: <a href="https://synapsis-industries.vercel.app/dashboard">/dashboard</a></p>
                <p style="color:#888;font-size:11px;margin-top:24px">This action is auto-reversible within 5 minutes via the rollback button in Syn activity feed.</p>
            `,
        });
    } catch (e) {
        console.error("[orchestrator] email send failed:", e);
    }
}
