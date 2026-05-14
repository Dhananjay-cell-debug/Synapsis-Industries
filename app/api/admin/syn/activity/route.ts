// ─── ADMIN — SYN ACTIVITY FEED ─────────────────────────────────────────────
// GET /api/admin/syn/activity
//   query: dealToken?, limit?=50, actionType?, unackOnly?=0|1
//   → { items: SynAction[], unreadCount: number }
//
// Powers the top-bar SynActivityButton + slide-down feed.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }

    const url = req.nextUrl;
    const dealToken = url.searchParams.get("dealToken") || undefined;
    const actionType = url.searchParams.get("actionType") || undefined;
    const unackOnly = url.searchParams.get("unackOnly") === "1";
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

    const db = supabase.schema("synapsis" as any);
    let q = db.from("syn_actions").select("*").order("created_at", { ascending: false }).limit(limit);
    if (dealToken) q = q.eq("deal_token", dealToken);
    if (actionType) q = q.eq("action_type", actionType);
    if (unackOnly) q = q.eq("acknowledged_by_admin", false);

    const [{ data: items, error }, unreadRes] = await Promise.all([
        q,
        db.from("syn_actions").select("id", { count: "exact", head: true }).eq("acknowledged_by_admin", false),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
        items: items || [],
        unreadCount: unreadRes.count ?? 0,
    });
}

// POST — bulk acknowledge actions
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) return NextResponse.json({ acknowledged: 0 });

    const db = supabase.schema("synapsis" as any);
    const { error, count } = await db
        .from("syn_actions")
        .update({
            acknowledged_by_admin: true,
            acknowledged_at: new Date().toISOString(),
            acknowledged_by_email: session!.user!.email!,
        }, { count: "exact" })
        .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ acknowledged: count || 0 });
}
