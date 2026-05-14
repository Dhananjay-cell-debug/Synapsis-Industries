// ─── CLIENT-FACING RAISED LIST ───────────────────────────────────────────
// GET /api/syn/raised/[token]
//   → { items: [{id, kind, status, title, has_unread_admin_response, ...}] }
// GET /api/syn/raised/[token]?id=<itemId>
//   → single item with all responses, marks client_response unread = false

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
    const id = req.nextUrl.searchParams.get("id");
    // Explicit .schema("synapsis") on every call — the global db.schema config
    // is unreliable for SELECT in some supabase-js builds.
    const db = supabase.schema("synapsis" as any);

    if (id) {
        const { data: item } = await db
            .from("raised_items")
            .select("*")
            .eq("id", id)
            .eq("deal_token", params.token)
            .maybeSingle();
        if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

        const { data: responses } = await db
            .from("raised_responses")
            .select("id, from_role, body, kind, created_at")
            .eq("item_id", id)
            .order("created_at", { ascending: true });

        if (item.has_unread_admin_response) {
            await db
                .from("raised_items")
                .update({ has_unread_admin_response: false })
                .eq("id", id);
        }

        return NextResponse.json({ item, responses: responses || [] });
    }

    const { data: items, error: listErr } = await db
        .from("raised_items")
        .select("id, kind, status, title, description, created_at, updated_at, has_unread_admin_response, phase")
        .eq("deal_token", params.token)
        .order("created_at", { ascending: false });
    if (listErr) {
        return NextResponse.json({ error: "query_failed", detail: listErr.message }, { status: 500 });
    }

    const unreadCount = (items || []).filter(i => i.has_unread_admin_response).length;
    const counts = {
        doubts: (items || []).filter(i => i.kind === "doubt").length,
        issues: (items || []).filter(i => i.kind === "issue").length,
        unread: unreadCount,
    };

    return NextResponse.json({ items: items || [], counts });
}
