// ─── PHASE 2: sendBlueprint ────────────────────────────────────────────────
// Syn auto-sends the blueprint once admin marks the draft "ready to send"
// (status=draft + all required fields filled + investment lines reconcile +
// payment %s sum to 100). Syn is the dispatcher, not the author.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, rulePhaseEquals } from "./common";

export const phase2_sendBlueprint: Checklist = {
    id: "phase-2-sendBlueprint",
    targetAction: "sendBlueprint",
    description: "Auto-dispatch the blueprint when admin has finalized the draft.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(2),
        {
            id: "blueprint.exists",
            description: "Blueprint document exists",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.phaseData?.phase2?.blueprint,
                evidence: deal.phaseData?.phase2?.blueprint ? "Blueprint present" : "No blueprint object on deal",
            }),
        },
        {
            id: "blueprint.status.is.draft",
            description: "Blueprint status is 'draft' (ready to send)",
            severity: "blocker",
            check: (deal) => {
                const status = deal.phaseData?.phase2?.blueprint?.status;
                return {
                    passed: status === "draft",
                    evidence: `status=${status}`,
                };
            },
        },
        {
            id: "blueprint.required_fields",
            description: "All required blueprint fields are filled",
            severity: "blocker",
            check: (deal) => {
                const bp = deal.phaseData?.phase2?.blueprint;
                if (!bp) return { passed: false, evidence: "No blueprint" };
                const required = {
                    problemStatement: !!bp.problemStatement && bp.problemStatement.length >= 50,
                    solutionArchitecture: !!bp.solutionArchitecture && bp.solutionArchitecture.length >= 50,
                    scopeIn: Array.isArray(bp.scopeIn) && bp.scopeIn.length > 0,
                    techStack: Array.isArray(bp.techStack) && bp.techStack.length > 0,
                    timeline: Array.isArray(bp.timeline) && bp.timeline.length > 0,
                    investment: Array.isArray(bp.investment) && bp.investment.length > 0,
                    paymentStructure: Array.isArray(bp.paymentStructure) && bp.paymentStructure.length > 0,
                };
                const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
                return {
                    passed: missing.length === 0,
                    evidence: missing.length === 0 ? "All required fields present" : `Missing: ${missing.join(", ")}`,
                };
            },
        },
        {
            id: "blueprint.investment_reconciles",
            description: "Sum of investment line amounts equals investmentTotal",
            severity: "blocker",
            check: (deal) => {
                const bp = deal.phaseData?.phase2?.blueprint;
                if (!bp) return { passed: false, evidence: "No blueprint" };
                const sum = (bp.investment || []).reduce((s, l) => s + (l.amount || 0), 0);
                return {
                    passed: Math.abs(sum - bp.investmentTotal) < 1,
                    evidence: `sum=${sum}, total=${bp.investmentTotal}`,
                };
            },
        },
        {
            id: "blueprint.payment_percentages_sum_100",
            description: "Sum of payment-structure percentages = 100",
            severity: "blocker",
            check: (deal) => {
                const bp = deal.phaseData?.phase2?.blueprint;
                if (!bp) return { passed: false, evidence: "No blueprint" };
                const sum = (bp.paymentStructure || []).reduce((s, r) => s + (r.percentage || 0), 0);
                return {
                    passed: sum === 100,
                    evidence: `payment % sum = ${sum}`,
                };
            },
        },
    ],
};
