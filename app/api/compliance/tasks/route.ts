// ─── COMPLIANCE — TASKS / DEADLINES ────────────────────────────────────────
// GET   /api/compliance/tasks → { all, upcoming, overdue }
// PATCH /api/compliance/tasks → { id, action: 'complete'|'reopen', notes? }
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { upcomingTasks, overdueTasks, completeTask } from "@/lib/compliance/deadline-engine";
import type { ComplianceTask } from "@/lib/compliance/types";

export const runtime = "nodejs";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    try {
        const [allRes, upcoming, overdue] = await Promise.all([
            supabase.from("compliance_tasks").select("*").order("due_date", { ascending: true }),
            upcomingTasks(400, 100),
            overdueTasks(),
        ]);
        if (allRes.error) {
            return NextResponse.json({ error: allRes.error.message }, { status: 500 });
        }
        return NextResponse.json({
            all: (allRes.data ?? []) as ComplianceTask[],
            upcoming,
            overdue,
        });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "tasks fetch failed" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { id, action, notes } = body as { id?: string; action?: string; notes?: string };
    if (!id || !action) {
        return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }
    try {
        if (action === "complete") {
            const task = await completeTask(id, notes);
            return NextResponse.json(task);
        }
        if (action === "reopen") {
            const { data, error } = await supabase
                .from("compliance_tasks")
                .update({ status: "pending", completed_at: null, completed_notes: null })
                .eq("id", id)
                .select("*")
                .single();
            if (error || !data) {
                return NextResponse.json({ error: error?.message ?? "reopen failed" }, { status: 500 });
            }
            return NextResponse.json(data);
        }
        return NextResponse.json({ error: `unknown action "${action}"` }, { status: 400 });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "task update failed" },
            { status: 500 }
        );
    }
}
