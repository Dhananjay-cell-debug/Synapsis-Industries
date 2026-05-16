// ─── EXPENSES — BULK CREATE ────────────────────────────────────────────────
// POST /api/compliance/expenses/bulk
//   body: { expenses: NewExpenseInput[] }
//   → { created: Expense[], skipped: number, errors: { index, message }[] }
// Admin only. Dedup via source_reference on existing endpoint.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { createExpense, type NewExpenseInput } from "@/lib/compliance/expenses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.expenses) ? body.expenses : null;
    if (!raw) {
        return NextResponse.json({ error: "expenses array required" }, { status: 400 });
    }
    if (raw.length === 0 || raw.length > 100) {
        return NextResponse.json({ error: "1 to 100 expenses per call" }, { status: 400 });
    }

    const created: unknown[] = [];
    let skipped = 0;
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < raw.length; i++) {
        const e = raw[i] as Partial<NewExpenseInput>;
        try {
            if (!e.expense_date || !e.vendor || !e.amount_paise) {
                errors.push({ index: i, message: "expense_date, vendor, amount_paise required" });
                continue;
            }
            const { expense, deduped } = await createExpense(e as NewExpenseInput);
            if (deduped) skipped++;
            else created.push(expense);
        } catch (err) {
            errors.push({
                index: i,
                message: err instanceof Error ? err.message : "create failed",
            });
        }
    }
    return NextResponse.json({ created, skipped, errors });
}
