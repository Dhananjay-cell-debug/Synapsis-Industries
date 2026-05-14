// ─── SYN VERIFY — LIST AVAILABLE CHECKLISTS FOR A DEAL ─────────────────────
// GET /api/syn/verify/[token]
//   → { dealPhase, checklists: [{id, targetAction, description, ruleCount}] }
//
// Admin-only. Returns the checklists relevant to the deal's current phase so
// the admin UI can render a "Run Syn verification" picker.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { findDealByToken } from "@/lib/phases/dealStore";
import { relevantChecklistsForDeal, listChecklistIds, getChecklist } from "@/lib/syn/checklists";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const deal = await findDealByToken(params.token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const relevant = relevantChecklistsForDeal(deal.phase ?? 0);
    const all = listChecklistIds().map(id => {
        const c = getChecklist(id)!;
        return { id: c.id, targetAction: c.targetAction, description: c.description, ruleCount: c.rules.length };
    });

    return NextResponse.json({
        deal: { token: deal.token, name: deal.name, phase: deal.phase },
        relevant: relevant.map(c => ({
            id: c.id,
            targetAction: c.targetAction,
            description: c.description,
            ruleCount: c.rules.length,
        })),
        all,
    });
}
