// ─── COMPLIANCE — DEDUCTIONS (Chapter VI-A tracker) ────────────────────────
// GET    /api/compliance/deductions?fy=FY2026-27 → { deductions, bySection }
// POST   /api/compliance/deductions → create
// DELETE /api/compliance/deductions?id=… → delete
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { fyBoundsForDate } from "@/lib/compliance/deadline-planner";
import { DEDUCTION_LIMITS } from "@/lib/compliance/constants";

export const runtime = "nodejs";

const n = (v: unknown): number =>
    typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0);

const VALID_SECTIONS = new Set([
    "80C", "80CCD(1B)", "80CCD(2)", "80D", "80D-parents",
    "80E", "80EE", "80EEA", "80G", "80TTA", "80TTB", "24(b)", "other",
]);

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const fyLabel = req.nextUrl.searchParams.get("fy") || fyBoundsForDate().fy_label;
    const { data, error } = await supabase
        .from("deductions")
        .select("*")
        .eq("fiscal_year", fyLabel)
        .order("section", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const bySection: Record<string, { claimed_paise: number; limit_paise: number }> = {};
    for (const d of data ?? []) {
        const sec = d.section as string;
        const limitRupees = (DEDUCTION_LIMITS as Record<string, number>)[sec];
        if (!bySection[sec]) {
            bySection[sec] = {
                claimed_paise: 0,
                limit_paise: limitRupees && limitRupees !== Infinity ? limitRupees * 100 : 0,
            };
        }
        bySection[sec].claimed_paise += n(d.amount_paise);
    }

    return NextResponse.json({ fy_label: fyLabel, deductions: data ?? [], bySection });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { fiscal_year, section, sub_category, amount_paise, target_amount_paise, invested_at, notes } = body;

    if (!section || !VALID_SECTIONS.has(section)) {
        return NextResponse.json({ error: "valid section required (e.g. 80C, 80D)" }, { status: 400 });
    }
    if (typeof amount_paise !== "number" || amount_paise <= 0) {
        return NextResponse.json({ error: "amount_paise must be a positive number" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("deductions")
        .insert({
            fiscal_year: fiscal_year || fyBoundsForDate().fy_label,
            section,
            sub_category: sub_category ?? null,
            amount_paise,
            target_amount_paise: target_amount_paise ?? null,
            invested_at: invested_at ?? null,
            notes: notes ?? null,
        })
        .select("*")
        .single();
    if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
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
    const { error } = await supabase.from("deductions").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
