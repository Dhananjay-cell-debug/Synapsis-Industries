// ─── SYN MANUAL VERIFY ENDPOINT ────────────────────────────────────────────
// Admin-only. Runs a named checklist against a deal and returns the
// VerifyOutcome. Records the action to syn_actions for audit trail.
//
// POST /api/syn/verify/[token]/[checklistId]
//   → { outcome: VerifyOutcome, auditId: string | null }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { findDealByToken } from "@/lib/phases/dealStore";
import { getChecklist } from "@/lib/syn/checklists";
import { buildVerifyCtx, runChecklist } from "@/lib/syn/verification";
import { recordSynAction, evidenceFromOutcome } from "@/lib/syn/audit";

export const runtime = "nodejs";

export async function POST(
    req: NextRequest,
    { params }: { params: { token: string; checklistId: string } },
) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }

    const { token, checklistId } = params;
    const checklist = getChecklist(checklistId);
    if (!checklist) {
        return NextResponse.json({ error: `Unknown checklist: ${checklistId}` }, { status: 404 });
    }

    const deal = await findDealByToken(token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const ctx = await buildVerifyCtx(deal);
    const outcome = await runChecklist(checklist, deal, ctx);

    const auditId = await recordSynAction({
        dealToken: token,
        actionType: "verify",
        targetAction: checklist.targetAction,
        outcome: outcome.passed ? "success" : "blocked",
        checklistId: checklist.id,
        evidence: evidenceFromOutcome(outcome),
        initiatedBy: "admin_manual",
        note: `Manual verify by ${session!.user!.email}`,
    });

    return NextResponse.json({ outcome, auditId });
}

// Convenience GET — lists eligible checklist ids for this deal's current phase.
export async function GET(
    req: NextRequest,
    { params }: { params: { token: string; checklistId: string } },
) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }

    const deal = await findDealByToken(params.token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const checklist = getChecklist(params.checklistId);
    if (!checklist) {
        return NextResponse.json({ error: `Unknown checklist: ${params.checklistId}` }, { status: 404 });
    }
    return NextResponse.json({
        checklist: {
            id: checklist.id,
            targetAction: checklist.targetAction,
            description: checklist.description,
            ruleCount: checklist.rules.length,
            rules: checklist.rules.map(r => ({ id: r.id, description: r.description, severity: r.severity })),
        },
        deal: {
            token: deal.token,
            name: deal.name,
            phase: deal.phase,
        },
    });
}
