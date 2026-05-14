// ─── COMMON CHECKLIST RULES ────────────────────────────────────────────────
// Re-usable rules every checklist composes. Keeps individual checklists small
// and consistent.

import type { CheckRule } from "../verification";

export const ruleDealExists: CheckRule = {
    id: "deal.exists",
    description: "Deal record present and active",
    severity: "blocker",
    check: (deal) => {
        const blocked: string[] = ["expired"];
        const ok = !!deal && !blocked.includes(deal.status);
        return {
            passed: ok,
            evidence: deal ? `Deal ${deal.token} status=${deal.status}` : "Deal missing",
        };
    },
};

export const ruleKillSwitchOff: CheckRule = {
    id: "syn.kill_switch.off",
    description: "Admin has not engaged the Syn kill-switch for this deal",
    severity: "blocker",
    check: (deal) => {
        const ks = (deal as any).synKillSwitch as { active?: boolean; engagedAt?: number; reason?: string } | undefined;
        const active = !!ks?.active;
        return {
            passed: !active,
            evidence: active ? `Kill-switch ON since ${new Date(ks!.engagedAt || 0).toISOString()} — ${ks!.reason || "no reason"}` : "Kill-switch off",
        };
    },
};

export const ruleNoOpenIssue = (phaseFilter?: number): CheckRule => ({
    id: phaseFilter == null ? "raised.no_open_issue" : `raised.no_open_issue.phase_${phaseFilter}`,
    description: phaseFilter == null
        ? "No open Raised Issue against this deal"
        : `No open Raised Issue against phase ${phaseFilter}`,
    severity: "blocker",
    check: (deal, ctx) => {
        const issues = phaseFilter == null
            ? ctx.openRaisedIssues
            : ctx.openRaisedIssues.filter(i => i.phase === phaseFilter);
        return {
            passed: issues.length === 0,
            evidence: issues.length === 0 ? "Clear" : `${issues.length} open issue(s) — admin must resolve first`,
            data: { issueIds: issues.map(i => i.id) },
        };
    },
});

export const rulePhaseEquals = (n: number): CheckRule => ({
    id: `phase.is.${n}`,
    description: `Deal is currently in phase ${n}`,
    severity: "blocker",
    check: (deal) => ({
        passed: deal.phase === n,
        evidence: `Current phase = ${deal.phase}`,
    }),
});
