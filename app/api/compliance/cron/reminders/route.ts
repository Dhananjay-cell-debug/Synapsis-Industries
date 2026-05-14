// ─── COMPLIANCE REMINDERS CRON ─────────────────────────────────────────────
// GET /api/compliance/cron/reminders
//
// Auth: EITHER a Bearer CRON_SECRET (Vercel Cron sends this) OR a logged-in
// admin session (so it can be triggered/tested manually from the dashboard).
//
// Behavior: finds compliance_tasks whose T-7/T-3/T-1 window opened and emails
// Dhananjay. Idempotent — each tier is marked sent so it never re-spams.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { runReminderSweep } from "@/lib/compliance/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
    // ─── auth: cron secret OR admin session ───────────────────────────────
    const cronSecret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization") || "";
    const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;

    let isAdminSession = false;
    if (!isCron) {
        const session = await getServerSession(authOptions);
        isAdminSession = isAdmin(session?.user?.email);
    }

    if (!isCron && !isAdminSession) {
        return NextResponse.json({ error: "forbidden — cron secret or admin session required" }, { status: 401 });
    }

    try {
        const report = await runReminderSweep();
        return NextResponse.json({
            ok: true,
            triggeredBy: isCron ? "cron" : "admin",
            ...report,
        });
    } catch (e) {
        console.error("[compliance/cron/reminders] error:", e);
        return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : "reminder sweep failed" },
            { status: 500 }
        );
    }
}
