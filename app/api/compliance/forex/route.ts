// ─── COMPLIANCE — FOREX / FIRC TRACKER ─────────────────────────────────────
// GET    /api/compliance/forex → all international inward remittances
// POST   /api/compliance/forex → create row
// PATCH  /api/compliance/forex → update FIRC status / reference
// DELETE /api/compliance/forex?id=… → delete
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const n = (v: unknown): number =>
    typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0);

const PROVIDERS = new Set(["stripe", "razorpay_intl", "wise", "direct_wire", "paypal", "other"]);
const CURRENCIES = new Set(["USD", "EUR", "GBP", "SGD", "AUD", "CAD", "AED", "other"]);

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const { data, error } = await supabase
        .from("forex_inward")
        .select("*")
        .order("payment_date", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];
    const totalInr = rows.reduce((s, r) => s + n(r.inr_amount_paise), 0);
    const fircPending = rows.filter((r) => r.firc_status === "pending" || r.firc_status === "requested").length;
    return NextResponse.json({ rows, totalInrPaise: totalInr, fircPendingCount: fircPending });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const {
        provider, payment_date, foreign_currency, foreign_amount_minor,
        inr_amount_paise, fx_rate, purpose_code, notes,
    } = body;

    if (!provider || !PROVIDERS.has(provider)) {
        return NextResponse.json({ error: "valid provider required" }, { status: 400 });
    }
    if (!foreign_currency || !CURRENCIES.has(foreign_currency)) {
        return NextResponse.json({ error: "valid foreign_currency required" }, { status: 400 });
    }
    if (!payment_date) {
        return NextResponse.json({ error: "payment_date required" }, { status: 400 });
    }
    if (typeof foreign_amount_minor !== "number" || typeof inr_amount_paise !== "number" || typeof fx_rate !== "number") {
        return NextResponse.json({ error: "foreign_amount_minor, inr_amount_paise, fx_rate must be numbers" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("forex_inward")
        .insert({
            provider,
            payment_date,
            foreign_currency,
            foreign_amount_minor,
            inr_amount_paise,
            fx_rate,
            purpose_code: purpose_code || "P0802",
            notes: notes ?? null,
        })
        .select("*")
        .single();
    if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
    }
    return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { id, firc_status, firc_reference, firc_received_at } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (firc_status) updates.firc_status = firc_status;
    if (firc_reference !== undefined) updates.firc_reference = firc_reference;
    if (firc_received_at !== undefined) updates.firc_received_at = firc_received_at;
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "no updatable fields" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("forex_inward")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
    if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "update failed" }, { status: 500 });
    }
    return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await supabase.from("forex_inward").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
