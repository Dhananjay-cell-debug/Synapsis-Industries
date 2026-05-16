// ─── EXPENSES — AI PARSE ───────────────────────────────────────────────────
// POST /api/compliance/expenses/parse
//   body: { text: string }
//   → { expenses: ExpenseDraft[], provider, model }
// Admin only. Uses multi-provider waterfall (OpenRouter / Groq / Cerebras / Nvidia).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { parseExpenseText } from "@/lib/compliance/expense-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text || text.trim().length < 5) {
        return NextResponse.json({ error: "text required (paste at least a few words)" }, { status: 400 });
    }

    try {
        const result = await parseExpenseText(text);
        return NextResponse.json(result);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "parse failed";
        const details = (e as { details?: string[] })?.details;
        console.error("[expenses/parse]", msg, details);
        return NextResponse.json({ error: msg, details }, { status: 500 });
    }
}
