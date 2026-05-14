// ─── COMPLIANCE — EXPENSES ─────────────────────────────────────────────────
// GET    /api/compliance/expenses → { expenses, categories, totals }
// POST   /api/compliance/expenses → create expense
// DELETE /api/compliance/expenses?id=… → delete expense
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import {
    listExpenses,
    listExpenseCategories,
    createExpense,
    deleteExpense,
    expenseTotalsForFY,
    type NewExpenseInput,
} from "@/lib/compliance/expenses";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    try {
        const fyLabel = req.nextUrl.searchParams.get("fy") || undefined;
        const [expenses, categories, totals] = await Promise.all([
            listExpenses({ limit: 200 }),
            listExpenseCategories(),
            expenseTotalsForFY(fyLabel),
        ]);
        return NextResponse.json({ expenses, categories, totals });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "expenses fetch failed" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as Partial<NewExpenseInput>;

    if (!body.expense_date || !body.vendor || !body.amount_paise) {
        return NextResponse.json(
            { error: "expense_date, vendor and amount_paise are required" },
            { status: 400 }
        );
    }
    if (typeof body.amount_paise !== "number" || body.amount_paise <= 0) {
        return NextResponse.json({ error: "amount_paise must be a positive number" }, { status: 400 });
    }

    try {
        const { expense, deduped } = await createExpense(body as NewExpenseInput);
        return NextResponse.json({ expense, deduped });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "expense create failed" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
        await deleteExpense(id);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "expense delete failed" },
            { status: 500 }
        );
    }
}
