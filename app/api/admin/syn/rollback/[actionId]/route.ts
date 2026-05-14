// ─── ADMIN — SYN ROLLBACK ──────────────────────────────────────────────────
// POST /api/admin/syn/rollback/[actionId]
//
// Reverses a Syn-fired transition within the 5-minute rollback window.
// Uses forcePhaseJump back to phaseBefore with a compliance audit note.
// Idempotent — a second rollback of the same action is a no-op.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { findDealByToken, mutateDeal } from "@/lib/phases/dealStore";
import { forcePhaseJump } from "@/lib/phases/transitions";
import { recordSynAction } from "@/lib/syn/audit";

export const runtime = "nodejs";

const ROLLBACK_WINDOW_MS = 5 * 60 * 1000;

export async function POST(
    req: NextRequest,
    { params }: { params: { actionId: string } },
) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const adminEmail = session!.user!.email!;

    const db = supabase.schema("synapsis" as any);
    const { data: action, error } = await db
        .from("syn_actions")
        .select("*")
        .eq("id", params.actionId)
        .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });

    // Guard 1 — must be a fired transition
    if (action.action_type !== "transition.fired") {
        return NextResponse.json({ error: `Cannot roll back action of type "${action.action_type}"` }, { status: 400 });
    }
    // Guard 2 — within 5-minute window
    const ageMs = Date.now() - new Date(action.created_at).getTime();
    if (ageMs > ROLLBACK_WINDOW_MS) {
        return NextResponse.json({
            error: `Rollback window expired (${Math.round(ageMs / 60000)} min elapsed, limit 5 min). Use admin god-mode jump if you really need to reverse this.`,
        }, { status: 400 });
    }
    // Guard 3 — not already rolled back
    if ((action.evidence as any)?.rolledBack === true) {
        return NextResponse.json({ error: "Already rolled back", idempotent: true }, { status: 400 });
    }
    if (!action.deal_token) {
        return NextResponse.json({ error: "Action has no deal_token" }, { status: 400 });
    }

    const phaseBefore = (action.evidence as any)?.phaseBefore;
    const phaseAfter = (action.evidence as any)?.phaseAfter;
    if (typeof phaseBefore !== "number") {
        return NextResponse.json({ error: "Action evidence missing phaseBefore — cannot determine rollback target" }, { status: 400 });
    }

    const deal = await findDealByToken(action.deal_token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    // Guard 4 — deal must still be at phaseAfter (no further movement since)
    if (typeof phaseAfter === "number" && deal.phase !== phaseAfter) {
        return NextResponse.json({
            error: `Deal moved on (now phase ${deal.phase}, action put it at ${phaseAfter}). Rollback unsafe — handle manually.`,
        }, { status: 409 });
    }

    const jump = forcePhaseJump(deal, {
        adminEmail,
        toPhase: phaseBefore,
        note: `Syn rollback by ${adminEmail}: reversing ${action.target_action} (action ${params.actionId})`,
    });
    if (jump.ok !== true) {
        const reason = (jump as { ok: false; reason: string }).reason;
        return NextResponse.json({ error: `forcePhaseJump refused: ${reason}` }, { status: 400 });
    }

    const persisted = await mutateDeal(action.deal_token, () => jump.deal);
    if (!persisted) return NextResponse.json({ error: "Persistence failed" }, { status: 500 });

    // Mark the original action rolled back
    await db
        .from("syn_actions")
        .update({ evidence: { ...(action.evidence as object), rolledBack: true, rolledBackAt: new Date().toISOString(), rolledBackBy: adminEmail } })
        .eq("id", params.actionId);

    // Record the rollback itself
    const rollbackId = await recordSynAction({
        dealToken: action.deal_token,
        actionType: "rollback",
        targetAction: action.target_action || undefined,
        outcome: "success",
        checklistId: action.checklist_id || undefined,
        evidence: { reversedActionId: params.actionId, fromPhase: phaseAfter, toPhase: phaseBefore },
        note: `Rolled back by ${adminEmail}`,
        initiatedBy: "admin_manual",
    });

    return NextResponse.json({
        ok: true,
        rollbackId,
        deal: { token: persisted.token, phase: persisted.phase },
    });
}
