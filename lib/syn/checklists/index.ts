// ─── CHECKLIST REGISTRY ────────────────────────────────────────────────────
// All Syn-eligible checklists registered by stable id. The verify endpoint
// and the autonomous cron sweep both look up checklists here.

import type { Checklist } from "../verification";

import { phase0to1_elect } from "./phase-0-to-1-elect";
import { phase0_rejectTimeout } from "./phase-0-reject-timeout";
import { phase1to2_goDecision } from "./phase-1-to-2-goDecision";
import { phase2_sendBlueprint } from "./phase-2-sendBlueprint";
import { paymentPhase3 } from "./payment-phase-3";
import { phase3to4_confirmAssets } from "./phase-3-to-4-confirmAssets";
import { phase4to5_submitFinal } from "./phase-4-to-5-submitFinal";
import { paymentPhase6 } from "./payment-phase-6";
import { phase6_markDeployed } from "./phase-6-markDeployed";
import { phase6_uploadHandover } from "./phase-6-uploadHandover";
import { phase6to7_tryAdvanceToOrbit } from "./phase-6-to-7-tryAdvanceToOrbit";

export const CHECKLISTS: Record<string, Checklist> = {
    [phase0to1_elect.id]:                phase0to1_elect,
    [phase0_rejectTimeout.id]:           phase0_rejectTimeout,
    [phase1to2_goDecision.id]:           phase1to2_goDecision,
    [phase2_sendBlueprint.id]:           phase2_sendBlueprint,
    [paymentPhase3.id]:                  paymentPhase3,
    [phase3to4_confirmAssets.id]:        phase3to4_confirmAssets,
    [phase4to5_submitFinal.id]:          phase4to5_submitFinal,
    [paymentPhase6.id]:                  paymentPhase6,
    [phase6_markDeployed.id]:            phase6_markDeployed,
    [phase6_uploadHandover.id]:          phase6_uploadHandover,
    [phase6to7_tryAdvanceToOrbit.id]:    phase6to7_tryAdvanceToOrbit,
};

export function getChecklist(id: string): Checklist | null {
    return CHECKLISTS[id] || null;
}

export function listChecklistIds(): string[] {
    return Object.keys(CHECKLISTS);
}

/** Pick the most relevant checklist for a deal's current phase. */
export function relevantChecklistsForDeal(phase: number): Checklist[] {
    const map: Record<number, string[]> = {
        0: [phase0to1_elect.id, phase0_rejectTimeout.id],
        1: [phase1to2_goDecision.id],
        2: [phase2_sendBlueprint.id],
        3: [paymentPhase3.id, phase3to4_confirmAssets.id],
        4: [phase4to5_submitFinal.id],
        5: [],   // all transitions in phase 5 are client-only
        6: [paymentPhase6.id, phase6_markDeployed.id, phase6_uploadHandover.id, phase6to7_tryAdvanceToOrbit.id],
        7: [],
    };
    return (map[phase] || []).map(id => CHECKLISTS[id]).filter(Boolean);
}
