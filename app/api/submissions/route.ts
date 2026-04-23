import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "submissions.json");

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

async function readSubmissions(): Promise<Submission[]> {
    try {
        const raw = await readFile(DATA_FILE, "utf8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function writeSubmissions(subs: Submission[]) {
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(subs, null, 2));
}

// GET /api/submissions → all submissions
export async function GET() {
    const subs = await readSubmissions();
    return NextResponse.json(subs);
}

// POST /api/submissions → create submission
export async function POST(req: NextRequest) {
    const body = await req.json();
    const subs = await readSubmissions();
    const sub: Submission = {
        id: body.id || Date.now(),
        name: body.name,
        company: body.company || "",
        need: body.need || "",
        budget: body.budget || "",
        message: body.message || "",
        date: body.date || new Date().toISOString().slice(0, 10),
        status: body.status || "new",
    };
    subs.unshift(sub);
    await writeSubmissions(subs);
    return NextResponse.json(sub);
}

// PATCH /api/submissions → update status
export async function PATCH(req: NextRequest) {
    const { id, ...updates } = await req.json();
    const subs = await readSubmissions();
    const idx = subs.findIndex(s => s.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    subs[idx] = { ...subs[idx], ...updates };
    await writeSubmissions(subs);
    return NextResponse.json(subs[idx]);
}

// DELETE /api/submissions?id=xxx
export async function DELETE(req: NextRequest) {
    const id = Number(req.nextUrl.searchParams.get("id"));
    const subs = await readSubmissions();
    const filtered = subs.filter(s => s.id !== id);
    await writeSubmissions(filtered);
    return NextResponse.json({ ok: true });
}
