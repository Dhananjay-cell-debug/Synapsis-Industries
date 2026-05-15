// ─── GSTR-1 PREP + JSON ────────────────────────────────────────────────────
// GET /api/compliance/gstr1?fy=FY2026-27&quarter=Q1
//   → { prep, json } JSON response for UI display.
// GET /api/compliance/gstr1?fy=FY2026-27&quarter=Q1&download=1
//   → triggers JSON file download (Content-Disposition).
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { buildGSTR1, type Quarter } from "@/lib/compliance/gstr1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_QUARTERS = new Set<Quarter>(["Q1", "Q2", "Q3", "Q4"]);

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }

    const url = req.nextUrl;
    const fy = url.searchParams.get("fy");
    const quarter = url.searchParams.get("quarter") as Quarter | null;
    const download = url.searchParams.get("download") === "1";

    if (!fy || !/^FY\d{4}-\d{2}$/.test(fy)) {
        return NextResponse.json({ error: "fy required, format FY2026-27" }, { status: 400 });
    }
    if (!quarter || !VALID_QUARTERS.has(quarter)) {
        return NextResponse.json({ error: "quarter required (Q1|Q2|Q3|Q4)" }, { status: 400 });
    }

    try {
        const { prep, json } = await buildGSTR1(fy, quarter);

        if (download) {
            // Pretty JSON for human-readable, but the offline utility accepts compact too.
            const body = JSON.stringify(json, null, 2);
            const filename = `gstr1_${fy}_${quarter}.json`;
            return new NextResponse(body, {
                status: 200,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Cache-Control": "no-store",
                },
            });
        }
        return NextResponse.json({ prep, json });
    } catch (e) {
        console.error("[gstr1] error:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "gstr-1 build failed" },
            { status: 500 }
        );
    }
}
