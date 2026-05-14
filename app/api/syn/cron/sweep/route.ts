// ─── SYN AUTONOMOUS SWEEP CRON ─────────────────────────────────────────────
// GET /api/syn/cron/sweep
//
// Auth: Bearer token CRON_SECRET. Vercel Cron sends this header automatically
// when configured via vercel.json.
//
// Behavior: walks all active deals (phase 0-6, not killed), runs synSweep
// per deal, returns aggregate report. No-ops if global kill-switch is on
// (SYN_GLOBAL_KILL_SWITCH=1).

import { NextRequest, NextResponse } from "next/server";
import { readAllDeals } from "@/lib/phases/dealStore";
import { synSweep, type SweepReport } from "@/lib/syn/orchestrator";
import { recordSynAction } from "@/lib/syn/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${expected}`) {
        return NextResponse.json({ error: "forbidden" }, { status: 401 });
    }

    if (process.env.SYN_GLOBAL_KILL_SWITCH === "1") {
        await recordSynAction({
            dealToken: null,
            actionType: "verify",
            outcome: "blocked",
            evidence: { reason: "global_kill_switch" },
            note: "Sweep skipped — SYN_GLOBAL_KILL_SWITCH=1",
            initiatedBy: "syn_auto",
        });
        return NextResponse.json({ ok: true, skipped: true, reason: "global_kill_switch" });
    }

    const deals = await readAllDeals();
    const candidates = deals.filter(d => {
        const phase = d.phase ?? 0;
        if (phase < 0 || phase > 6) return false;
        if (d.status === "expired") return false;
        return true;
    });

    const reports: SweepReport[] = [];
    for (const deal of candidates) {
        try {
            const r = await synSweep(deal);
            if (r.checklistsRun > 0) reports.push(r);
        } catch (e) {
            console.error(`[cron/sweep] sweep failed for ${deal.token}:`, e);
        }
    }

    const fired = reports.flatMap(r => r.transitionsFired.map(a => `${r.dealToken}:${a}`));
    const blocked = reports.flatMap(r => r.blocked.map(b => `${r.dealToken}:${b.checklistId}`));

    return NextResponse.json({
        ok: true,
        sweptDeals: candidates.length,
        reportsWithActivity: reports.length,
        transitionsFired: fired,
        blockedCount: blocked.length,
        timestamp: new Date().toISOString(),
    });
}
