import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export interface Submission {
    id: number;
    name: string;
    company: string;
    need: string;
    budget: string;
    message: string;
    date: string;
    status: string;
}

// GET /api/submissions → all submissions
export async function GET() {
    const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[submissions] GET error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const submissions: Submission[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        company: row.company || "",
        need: row.need || "",
        budget: row.budget || "",
        message: row.message || "",
        date: row.date,
        status: row.status,
    }));

    return NextResponse.json(submissions);
}

// POST /api/submissions → create submission
export async function POST(req: NextRequest) {
    const body = await req.json();
    const date = body.date || new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from("submissions")
        .insert({
            name: body.name,
            company: body.company || "",
            need: body.need || "",
            budget: body.budget || "",
            message: body.message || "",
            date,
            status: body.status || "new",
        })
        .select()
        .single();

    if (error) {
        console.error("[submissions] POST error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const submission: Submission = {
        id: data.id,
        name: data.name,
        company: data.company || "",
        need: data.need || "",
        budget: data.budget || "",
        message: data.message || "",
        date: data.date,
        status: data.status,
    };

    return NextResponse.json(submission);
}

// PATCH /api/submissions → update status
export async function PATCH(req: NextRequest) {
    const { id, ...updates } = await req.json();

    const { data, error } = await supabase
        .from("submissions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("[submissions] PATCH error:", error.message);
        if (error.code === "PGRST116") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const submission: Submission = {
        id: data.id,
        name: data.name,
        company: data.company || "",
        need: data.need || "",
        budget: data.budget || "",
        message: data.message || "",
        date: data.date,
        status: data.status,
    };

    return NextResponse.json(submission);
}

// DELETE /api/submissions?id=xxx
export async function DELETE(req: NextRequest) {
    const id = Number(req.nextUrl.searchParams.get("id"));

    const { error } = await supabase
        .from("submissions")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("[submissions] DELETE error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
