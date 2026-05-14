// ─── ADMIN LIST OF RAISED ITEMS ──────────────────────────────────────────
// GET /api/admin/raised?kind=doubt|issue|all&status=open|all
// Returns enriched items with the most recent response.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const kind = req.nextUrl.searchParams.get("kind") || "all";
    const status = req.nextUrl.searchParams.get("status") || "all";

    let q = supabase
        .from("raised_items")
        .select("*")
        .order("created_at", { ascending: false });

    if (kind === "doubt" || kind === "issue") q = q.eq("kind", kind);
    if (status !== "all") q = q.eq("status", status);

    const { data: items, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const counts = {
        doubts: (items || []).filter(i => i.kind === "doubt").length,
        issues: (items || []).filter(i => i.kind === "issue").length,
        open:   (items || []).filter(i => i.status === "open").length,
        resolved: (items || []).filter(i => i.status === "resolved").length,
    };

    return NextResponse.json({ items: items || [], counts });
}
