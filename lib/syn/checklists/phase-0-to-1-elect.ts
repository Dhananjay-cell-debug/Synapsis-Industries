// ─── PHASE 0 → 1: elect ────────────────────────────────────────────────────
// Auto-fires when an inbox lead is high-signal: full intake, budget present,
// ≥24hrs in inbox without admin reject, no spam flag. Conservative — Syn
// only auto-elects very-clean leads. Anything ambiguous routes to admin.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff } from "./common";

export const phase0to1_elect: Checklist = {
    id: "phase-0-to-1-elect",
    targetAction: "elect",
    description: "Auto-elect high-signal leads from the inbox.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        {
            id: "phase.is.0",
            description: "Deal is in phase 0 (inbox)",
            severity: "blocker",
            check: (deal) => ({
                passed: deal.phase === 0,
                evidence: `phase=${deal.phase}`,
            }),
        },
        {
            id: "not.rejected.or.elected",
            description: "Deal has not already been elected or rejected",
            severity: "blocker",
            check: (deal) => ({
                passed: !deal.electedAt && !deal.rejectedAt,
                evidence: deal.electedAt ? "Already elected" : deal.rejectedAt ? "Already rejected" : "Open",
            }),
        },
        {
            id: "intake.complete",
            description: "Lead intake has name, company, need, message",
            severity: "blocker",
            check: (deal) => {
                const fields = {
                    name: !!deal.name,
                    company: !!deal.company,
                    need: !!deal.need,
                    message: !!deal.message && deal.message.length >= 30,
                };
                const missing = Object.entries(fields).filter(([, v]) => !v).map(([k]) => k);
                return {
                    passed: missing.length === 0,
                    evidence: missing.length === 0 ? "All required fields present" : `Missing: ${missing.join(", ")}`,
                    data: fields,
                };
            },
        },
        {
            id: "budget.signal",
            description: "Lead provided a budget signal (any value)",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.budget && deal.budget.trim().length > 0,
                evidence: deal.budget ? `Budget="${deal.budget}"` : "No budget provided",
            }),
        },
        {
            id: "inbox.aged.24h",
            description: "Lead has been in inbox ≥24hrs (admin had a window to review/reject)",
            severity: "blocker",
            check: (deal, ctx) => {
                const ageMs = ctx.nowMs - deal.createdAt;
                const hours = Math.round(ageMs / 3600000);
                return {
                    passed: ageMs >= 24 * 3600 * 1000,
                    evidence: `${hours}hr in inbox`,
                };
            },
        },
        {
            id: "not.spam.signals",
            description: "Message does not contain obvious spam signals",
            severity: "blocker",
            check: (deal) => {
                const msg = (deal.message || "").toLowerCase();
                const spamSignals = ["seo services", "rank #1", "guest post", "backlink", "crypto investment", "make money fast"];
                const hits = spamSignals.filter(s => msg.includes(s));
                return {
                    passed: hits.length === 0,
                    evidence: hits.length === 0 ? "No spam signals" : `Spam signals: ${hits.join(", ")}`,
                };
            },
        },
    ],
};
