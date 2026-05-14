// ─── PHASE 1 → 2: goDecision (GO only) ─────────────────────────────────────
// Syn fires GO only. NO-GO stays admin-only. The verification: discovery
// questionnaire is submitted with substantive answers AND discovery call
// completed with admin call-notes present AND no NO-GO flag.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, rulePhaseEquals } from "./common";

export const phase1to2_goDecision: Checklist = {
    id: "phase-1-to-2-goDecision",
    targetAction: "goDecision",
    description: "Auto-fire GO decision after Discovery is complete.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(1),
        {
            id: "questionnaire.submitted",
            description: "Client has submitted the Discovery Questionnaire",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.questionnaireSubmittedAt,
                evidence: deal.questionnaireSubmittedAt ? `Submitted ${new Date(deal.questionnaireSubmittedAt).toISOString()}` : "Not yet submitted",
            }),
        },
        {
            id: "questionnaire.has_substance",
            description: "Each answer in the questionnaire has substantive content (≥50 chars per answer)",
            severity: "blocker",
            check: (deal) => {
                const q = deal.questionnaire || {};
                const answers = Object.values(q).filter(v => typeof v === "string");
                if (answers.length === 0) return { passed: false, evidence: "No questionnaire answers found" };
                const tooShort = answers.filter(a => (a as string).length < 50).length;
                return {
                    passed: tooShort === 0,
                    evidence: tooShort === 0 ? `All ${answers.length} answers ≥50 chars` : `${tooShort} answer(s) shorter than 50 chars`,
                };
            },
        },
        {
            id: "call.completed",
            description: "Discovery call has been completed",
            severity: "blocker",
            check: (deal) => {
                const p1 = deal.phaseData?.phase1;
                return {
                    passed: !!p1?.callCompletedAt,
                    evidence: p1?.callCompletedAt ? `Completed ${new Date(p1.callCompletedAt).toISOString()}` : "Call not yet completed",
                };
            },
        },
        {
            id: "call.notes.present",
            description: "Admin has logged call notes (≥50 chars)",
            severity: "blocker",
            check: (deal) => {
                const notes = deal.phaseData?.phase1?.callNotes || "";
                return {
                    passed: notes.length >= 50,
                    evidence: notes.length >= 50 ? `${notes.length} chars of call notes` : `Only ${notes.length} chars — admin call notes needed`,
                };
            },
        },
        {
            id: "no.no_go.flag",
            description: "Admin has not flagged a NO-GO decision",
            severity: "blocker",
            check: (deal) => {
                const decision = deal.phaseData?.phase1?.decision;
                return {
                    passed: decision !== "no-go",
                    evidence: decision === "no-go" ? "Admin set NO-GO — Syn will not override" : `decision=${decision || "pending"}`,
                };
            },
        },
    ],
};
