// ─── ADMIN — LIST MANUAL NEFT PROOFS ───────────────────────────────────────
// GET /api/admin/payments/manual              → all pending_review proofs
// GET /api/admin/payments/manual?status=all   → all (any status)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
    }

    const status = req.nextUrl.searchParams.get("status");
    let q = supabase.from("manual_payment_proofs").select("*").order("submitted_at", { ascending: false });
    if (status && status !== "all") q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ proofs: data || [] });
}
