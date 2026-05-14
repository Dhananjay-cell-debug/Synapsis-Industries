// ─── PHASE 6 → 7: tryAdvanceToOrbit ────────────────────────────────────────
// Auto-advances to Orbit when handover delivered + final paid + 7-day quiet
// period passed with no client revision requests.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, rulePhaseEquals } from "./common";

export const phase6to7_tryAdvanceToOrbit: Checklist = {
    id: "phase-6-to-7-tryAdvanceToOrbit",
    targetAction: "tryAdvanceToOrbit",
    description: "Auto-advance to Orbit after handover settles for 7 days.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(6),
        {
            id: "finalPaid",
            description: "Final payment captured",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.phaseData?.phase6?.finalPaidAt,
                evidence: deal.phaseData?.phase6?.finalPaidAt ? "OK" : "Not yet",
            }),
        },
        {
            id: "handoverDelivered",
            description: "Handover package was delivered",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.phaseData?.phase6?.handoverDeliveredAt,
                evidence: deal.phaseData?.phase6?.handoverDeliveredAt ? "OK" : "Not yet delivered",
            }),
        },
        {
            id: "quiet.window.elapsed",
            description: "≥7 days since handover with no new revision requests",
            severity: "blocker",
            check: (deal, ctx) => {
                const handoverAt = deal.phaseData?.phase6?.handoverDeliveredAt;
                if (!handoverAt) return { passed: false, evidence: "No handover timestamp" };
                const ageMs = ctx.nowMs - handoverAt;
                const days = Math.floor(ageMs / 86_400_000);
                return {
                    passed: ageMs >= 7 * 86_400_000,
                    evidence: `${days} day(s) since handover`,
                };
            },
        },
        {
            id: "no.recent.revision",
            description: "No revision round opened in the last 7 days",
            severity: "blocker",
            check: (deal, ctx) => {
                const rounds = deal.phaseData?.phase5?.revisionRounds || [];
                const cutoff = ctx.nowMs - 7 * 86_400_000;
                const recent = rounds.filter(r => r.submittedAt >= cutoff);
                return {
                    passed: recent.length === 0,
                    evidence: recent.length === 0 ? "No recent revisions" : `${recent.length} revision(s) within 7 days`,
                };
            },
        },
    ],
};
