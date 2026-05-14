// ─── ADMIN — SYN KILL SWITCH ───────────────────────────────────────────────
// POST /api/admin/syn/kill-switch
//   body: { dealToken?: string, active: boolean, reason?: string }
//
// dealToken absent → toggle global (env-driven on the server, but we surface
// the deal-level toggle here for predictable per-deal behavior).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { mutateDeal } from "@/lib/phases/dealStore";
import { recordSynAction } from "@/lib/syn/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const adminEmail = session!.user!.email!;
    const body = await req.json().catch(() => ({}));
    const { dealToken, active, reason } = body as { dealToken?: string; active?: boolean; reason?: string };

    if (typeof active !== "boolean") {
        return NextResponse.json({ error: "active (boolean) required" }, { status: 400 });
    }
    if (!dealToken) {
        return NextResponse.json({
            error: "Global kill-switch is controlled via Vercel env var SYN_GLOBAL_KILL_SWITCH=1. Set it in the dashboard, redeploy.",
        }, { status: 400 });
    }

    const ks = active
        ? { active: true, engagedAt: Date.now(), engagedByEmail: adminEmail, reason: reason || "Manually engaged" }
        : null;

    const updated = await mutateDeal(dealToken, (d) => ({ ...d, synKillSwitch: ks } as any));
    if (!updated) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    await recordSynAction({
        dealToken,
        actionType: active ? "kill_switch.engage" : "kill_switch.release",
        outcome: "info",
        evidence: { active, reason },
        note: `${active ? "Engaged" : "Released"} by ${adminEmail}`,
        initiatedBy: "admin_manual",
    });

    return NextResponse.json({ ok: true, killSwitch: ks });
}
