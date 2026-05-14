// ─── PHASE 0: reject (timeout only) ────────────────────────────────────────
// Syn auto-rejects ONLY in the hard-timeout case: 48hr inbox timer expired
// AND no clientRecovery action in subsequent 24hrs. Never fires reject for
// any other reason. Negative judgment stays with admin.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff } from "./common";

export const phase0_rejectTimeout: Checklist = {
    id: "phase-0-reject-timeout",
    targetAction: "reject",
    description: "Auto-reject a stalled phase-0 lead after timeout + grace window.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        {
            id: "phase.is.0",
            description: "Deal is in phase 0",
            severity: "blocker",
            check: (deal) => ({ passed: deal.phase === 0, evidence: `phase=${deal.phase}` }),
        },
        {
            id: "not.elected.or.rejected",
            description: "Deal not already elected or rejected",
            severity: "blocker",
            check: (deal) => ({
                passed: !deal.electedAt && !deal.rejectedAt,
                evidence: deal.electedAt ? "Already elected" : deal.rejectedAt ? "Already rejected" : "Open",
            }),
        },
        {
            id: "primary.timer.expired",
            description: "48hr primary inbox timer has expired",
            severity: "blocker",
            check: (deal, ctx) => {
                const ageMs = ctx.nowMs - deal.createdAt;
                return {
                    passed: ageMs >= 48 * 3600 * 1000,
                    evidence: `${Math.round(ageMs / 3600000)}hr in inbox (need ≥48hr)`,
                };
            },
        },
        {
            id: "extension.expired",
            description: "If client took an extension, that extension has expired",
            severity: "blocker",
            check: (deal, ctx) => {
                if (!deal.extendedUntil) return { passed: true, evidence: "No extension was taken" };
                return {
                    passed: ctx.nowMs >= deal.extendedUntil,
                    evidence: `Extension until ${new Date(deal.extendedUntil).toISOString()}`,
                };
            },
        },
        {
            id: "grace.window.elapsed",
            description: "≥24hr grace window elapsed since primary timer expiry (or since extension expiry)",
            severity: "blocker",
            check: (deal, ctx) => {
                const referenceMs = deal.extendedUntil || (deal.createdAt + 48 * 3600 * 1000);
                const graceMs = ctx.nowMs - referenceMs;
                return {
                    passed: graceMs >= 24 * 3600 * 1000,
                    evidence: `${Math.round(graceMs / 3600000)}hr grace window elapsed`,
                };
            },
        },
    ],
};
