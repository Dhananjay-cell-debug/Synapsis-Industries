// ─── GSTR-3B SUMMARY ───────────────────────────────────────────────────────
// GET /api/compliance/gstr3b?year=2026&month=5
//   → { summary } — section-by-section values for manual portal entry.
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { buildGSTR3B } from "@/lib/compliance/gstr3b";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }

    const url = req.nextUrl;
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));

    if (!Number.isInteger(year) || year < 2026 || year > 2050) {
        return NextResponse.json({ error: "year required (2026-2050)" }, { status: 400 });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        return NextResponse.json({ error: "month required (1-12)" }, { status: 400 });
    }

    try {
        const summary = await buildGSTR3B(year, month);
        return NextResponse.json({ summary });
    } catch (e) {
        console.error("[gstr3b] error:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "gstr-3b build failed" },
            { status: 500 }
        );
    }
}
