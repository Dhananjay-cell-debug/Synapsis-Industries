// ─── SYN AUDIT LOG ─────────────────────────────────────────────────────────
// Every Syn action — read, verify, attempt-transition, notify, kill-switch —
// writes a row into synapsis.syn_actions. This is the source of truth for
// the admin activity feed (top-bar button) and for rollback.

import { supabase } from "@/lib/supabase";
import type { VerifyOutcome } from "./verification";

export type SynActionType =
    | "verify"               // ran a checklist, no side effect
    | "transition.attempt"   // attempted to fire a phase transition (success or failed)
    | "transition.fired"     // transition succeeded
    | "transition.blocked"   // checklist failed → transition refused
    | "notify.admin"
    | "notify.client"
    | "kill_switch.engage"
    | "kill_switch.release"
    | "flag.review"
    | "decision.request"
    | "rollback";

export type SynActionOutcome = "success" | "blocked" | "error" | "info";

export interface SynActionLog {
    dealToken: string | null;            // null only for global actions (e.g. global kill-switch)
    actionType: SynActionType;
    targetAction?: string;               // e.g. "confirmAssets" — present for transition.* types
    outcome: SynActionOutcome;
    checklistId?: string;
    evidence: Record<string, unknown>;   // structured. Always include VerifyOutcome on transition.* / verify
    note?: string;
    initiatedBy?: "syn_auto" | "admin_manual" | "system_event";
}

export async function recordSynAction(log: SynActionLog): Promise<string | null> {
    try {
        const db = supabase.schema("synapsis" as any);
        const { data, error } = await db
            .from("syn_actions")
            .insert({
                deal_token: log.dealToken,
                action_type: log.actionType,
                target_action: log.targetAction || null,
                outcome: log.outcome,
                checklist_id: log.checklistId || null,
                evidence: log.evidence,
                note: log.note || null,
                initiated_by: log.initiatedBy || "syn_auto",
                acknowledged_by_admin: false,
            })
            .select("id")
            .single();
        if (error) {
            console.error("[syn/audit] insert failed:", error.message);
            return null;
        }
        return (data?.id as string) || null;
    } catch (e) {
        console.error("[syn/audit] threw:", e);
        return null;
    }
}

export function evidenceFromOutcome(o: VerifyOutcome): Record<string, unknown> {
    return {
        checklistId: o.checklistId,
        targetAction: o.targetAction,
        passed: o.passed,
        blockedBy: o.blockedBy,
        ranAtMs: o.ranAtMs,
        results: o.results.map(r => ({
            ruleId: r.ruleId,
            severity: r.severity,
            passed: r.passed,
            evidence: r.evidence,
        })),
    };
}
