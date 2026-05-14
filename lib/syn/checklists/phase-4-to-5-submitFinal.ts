// ─── PHASE 4 → 5: submitFinal ──────────────────────────────────────────────
// Auto-submits the final build for client review when staging is healthy
// and admin has marked it ready (latest sprint progressPct=100 + stagingUrl
// returns 200 in our preflight + admin set readyForDelivery=true).

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, ruleNoOpenIssue, rulePhaseEquals } from "./common";

async function fetchHead(url: string, ms = 6000): Promise<number | null> {
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), ms);
        const r = await fetch(url, { method: "HEAD", signal: c.signal });
        clearTimeout(t);
        return r.status;
    } catch { return null; }
}

export const phase4to5_submitFinal: Checklist = {
    id: "phase-4-to-5-submitFinal",
    targetAction: "submitFinal",
    description: "Auto-submit the staging build to client review when all build conditions clear.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(4),
        ruleNoOpenIssue(4),
        {
            id: "staging.url.present",
            description: "Phase 4 stagingUrl is set",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.phaseData?.phase4?.stagingUrl,
                evidence: deal.phaseData?.phase4?.stagingUrl || "Missing",
            }),
        },
        {
            id: "latest.sprint.complete",
            description: "Latest sprint progressPct = 100",
            severity: "blocker",
            check: (deal) => {
                const sprints = deal.phaseData?.phase4?.sprintReports || [];
                const latest = sprints[sprints.length - 1];
                if (!latest) return { passed: false, evidence: "No sprint reports yet" };
                return {
                    passed: latest.progressPct === 100,
                    evidence: `latest sprint progress = ${latest.progressPct}%`,
                };
            },
        },
        {
            id: "no.pending.change_order",
            description: "No pending Change Orders",
            severity: "blocker",
            check: (deal) => {
                const cos = (deal.phaseData?.phase4?.changeOrders || []).filter(c => c.status === "pending");
                return {
                    passed: cos.length === 0,
                    evidence: cos.length === 0 ? "No pending COs" : `${cos.length} pending Change Order(s)`,
                };
            },
        },
        {
            id: "staging.returns.200",
            description: "stagingUrl returns HTTP 200 on preflight HEAD",
            severity: "blocker",
            check: async (deal) => {
                const url = deal.phaseData?.phase4?.stagingUrl;
                if (!url) return { passed: false, evidence: "No URL to check" };
                const status = await fetchHead(url);
                return {
                    passed: status !== null && status >= 200 && status < 400,
                    evidence: status === null ? "Preflight failed (network/timeout)" : `HTTP ${status}`,
                };
            },
        },
        {
            id: "admin.readyForDelivery",
            description: "Admin has set phase4.readyForDelivery=true",
            severity: "blocker",
            check: (deal) => {
                const flag = (deal.phaseData?.phase4 as any)?.readyForDelivery;
                return {
                    passed: flag === true,
                    evidence: flag === true ? "Admin marked ready" : "Admin has not marked readyForDelivery",
                };
            },
        },
    ],
};
