// ─── PHASE 6: uploadHandover ───────────────────────────────────────────────
// Auto-finalize the handover package when admin marks it complete and all
// required fields are filled.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, rulePhaseEquals } from "./common";

export const phase6_uploadHandover: Checklist = {
    id: "phase-6-uploadHandover",
    targetAction: "uploadHandover",
    description: "Auto-publish the handover package when admin has filled and approved it.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(6),
        {
            id: "deployed",
            description: "Project is marked deployed",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.phaseData?.phase6?.deployedAt,
                evidence: deal.phaseData?.phase6?.deployedAt ? "Deployed" : "Not yet deployed",
            }),
        },
        {
            id: "handoverPackage.complete",
            description: "Handover package has all required fields",
            severity: "blocker",
            check: (deal) => {
                const hp = deal.phaseData?.phase6?.handoverPackage;
                if (!hp) return { passed: false, evidence: "No handoverPackage object" };
                const required = {
                    builtSummary: !!hp.builtSummary && hp.builtSummary.length >= 50,
                    howToUseGuide: !!hp.howToUseGuide && hp.howToUseGuide.length >= 50,
                    accessCredentials: !!hp.accessCredentials,
                    architectureOverview: !!hp.architectureOverview && hp.architectureOverview.length >= 50,
                    emergencyContact: !!hp.emergencyContact,
                };
                const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
                return {
                    passed: missing.length === 0,
                    evidence: missing.length === 0 ? "All fields present" : `Missing: ${missing.join(", ")}`,
                };
            },
        },
        {
            id: "admin.handoverApproved",
            description: "Admin has set phase6.handoverApproved=true",
            severity: "blocker",
            check: (deal) => {
                const flag = (deal.phaseData?.phase6 as any)?.handoverApproved;
                return {
                    passed: flag === true,
                    evidence: flag === true ? "Admin approved" : "Awaiting handoverApproved",
                };
            },
        },
    ],
};
