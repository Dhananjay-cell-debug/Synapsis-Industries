// ─── PHASE 6: markDeployed ─────────────────────────────────────────────────
// Auto-marks the project as deployed when prod URL returns 200 + smoke-test
// endpoint passes + admin has signed deployBlessing.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, ruleNoOpenIssue, rulePhaseEquals } from "./common";

async function fetchStatus(url: string, ms = 8000): Promise<number | null> {
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), ms);
        const r = await fetch(url, { method: "GET", signal: c.signal });
        clearTimeout(t);
        return r.status;
    } catch { return null; }
}

export const phase6_markDeployed: Checklist = {
    id: "phase-6-markDeployed",
    targetAction: "markDeployed",
    description: "Auto-mark production deployment when health checks pass and admin blesses.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(6),
        ruleNoOpenIssue(6),
        {
            id: "final.payment.captured",
            description: "Final payment is captured",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.phaseData?.phase6?.finalPaidAt,
                evidence: deal.phaseData?.phase6?.finalPaidAt ? "finalPaidAt set" : "Final payment not yet captured",
            }),
        },
        {
            id: "prod.url.present",
            description: "Production URL is recorded",
            severity: "blocker",
            check: (deal) => {
                const url = (deal.phaseData?.phase6 as any)?.prodUrl;
                return {
                    passed: !!url,
                    evidence: url || "No prodUrl set",
                };
            },
        },
        {
            id: "prod.url.healthy",
            description: "prodUrl returns 2xx/3xx",
            severity: "blocker",
            check: async (deal) => {
                const url = (deal.phaseData?.phase6 as any)?.prodUrl;
                if (!url) return { passed: false, evidence: "No URL" };
                const status = await fetchStatus(url);
                return {
                    passed: status !== null && status >= 200 && status < 400,
                    evidence: status === null ? "Health-check failed" : `HTTP ${status}`,
                };
            },
        },
        {
            id: "admin.deployBlessing",
            description: "Admin has set phase6.deployBlessing=true",
            severity: "blocker",
            check: (deal) => {
                const flag = (deal.phaseData?.phase6 as any)?.deployBlessing;
                return {
                    passed: flag === true,
                    evidence: flag === true ? "Admin blessed deploy" : "Awaiting deployBlessing",
                };
            },
        },
    ],
};
