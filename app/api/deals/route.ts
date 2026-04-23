import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const SUBMISSIONS_FILE = path.join(process.cwd(), "data", "submissions.json");

async function ensureSubmission(deal: { submissionId: number; name: string; company: string; need: string; budget: string; message: string; createdAt: number }) {
    try {
        let subs: { id: number; name: string; company: string; need: string; budget: string; message: string; date: string; status: string }[] = [];
        try {
            const raw = await readFile(SUBMISSIONS_FILE, "utf8");
            subs = JSON.parse(raw);
        } catch { /* file doesn't exist yet */ }
        // Only add if not already present
        if (!subs.find(s => s.id === deal.submissionId)) {
            subs.unshift({
                id: deal.submissionId,
                name: deal.name,
                company: deal.company,
                need: deal.need,
                budget: deal.budget,
                message: deal.message,
                date: new Date(deal.createdAt).toISOString().slice(0, 10),
                status: "new",
            });
            await mkdir(path.dirname(SUBMISSIONS_FILE), { recursive: true });
            await writeFile(SUBMISSIONS_FILE, JSON.stringify(subs, null, 2));
        }
    } catch { /* non-blocking */ }
}

const DATA_FILE = path.join(process.cwd(), "data", "deals.json");

export type DealStatus = "pending" | "interested" | "elected" | "rejected" | "proceeding" | "active" | "expired";

export interface DealMessage {
    from: "client" | "admin";
    text: string;
    timestamp: number;
    imageUrl?: string;
}

export interface DealPayment {
    phase: number;
    percentage: number;
    amount: number;
    status: "pending" | "paid";
    sessionId?: string;
    paidAt?: number;
}

export interface Deal {
    token: string;
    submissionId: number;
    name: string;
    company: string;
    need: string;
    budget: string;
    message: string;
    createdAt: number;
    status: DealStatus;
    phase: number;
    electedAt?: number;
    rejectedAt?: number;
    rejectionNote?: string;
    extendedUntil?: number;
    clientNote?: string;
    questionnaire?: Record<string, string>;
    questionnaireSubmittedAt?: number;
    messages?: DealMessage[];
    totalPrice?: number;       // Set by admin (USD) — drives all payment calculations
    payments?: DealPayment[];  // Tracks 30% / 30% / 40% phase payments
    projectDays?: number;      // Total project duration in days — drives phase duration calc
    customQuestions?: string[]; // Admin-crafted per-client questions (via AI chat builder)
    interestChatHistory?: { role: "user" | "assistant"; content: string }[]; // Kimi K2 chat log
}

async function readDeals(): Promise<Deal[]> {
    try {
        const raw = await readFile(DATA_FILE, "utf8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function writeDeals(deals: Deal[]) {
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(deals, null, 2));
}

// GET /api/deals?token=xxx → single deal
// GET /api/deals → all deals (admin)
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");
    const deals = await readDeals();
    if (token) {
        const deal = deals.find(d => d.token === token);
        if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (deal.status === "pending") { // "interested" deals never expire — admin is actively reviewing
            const expiry = deal.extendedUntil || (deal.createdAt + 48 * 60 * 60 * 1000);
            if (Date.now() > expiry) {
                deal.status = "expired";
                const idx = deals.findIndex(d => d.token === token);
                deals[idx] = deal;
                await writeDeals(deals);
            }
        }
        return NextResponse.json(deal);
    }
    return NextResponse.json(deals);
}

// POST /api/deals → create deal, returns token
export async function POST(req: NextRequest) {
    const body = await req.json();
    const token = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    const deal: Deal = {
        token,
        submissionId: body.submissionId,
        name: body.name,
        company: body.company,
        need: body.need,
        budget: body.budget,
        message: body.message,
        createdAt: Date.now(),
        status: "pending",
        phase: 0,
    };
    const deals = await readDeals();
    deals.push(deal);
    await writeDeals(deals);
    // Also ensure a submission record exists so admin inbox shows it
    await ensureSubmission(deal);
    return NextResponse.json({ token, deal });
}

// PATCH /api/deals → update deal
// Special keys: appendMessage (appends to messages[]), setQuestionnaire (saves answers)
export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { token, appendMessage, setQuestionnaire, ...updates } = body;
    const deals = await readDeals();
    const idx = deals.findIndex(d => d.token === token);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (appendMessage) {
        deals[idx] = { ...deals[idx], messages: [...(deals[idx].messages || []), appendMessage] };
    }
    if (setQuestionnaire !== undefined) {
        deals[idx] = { ...deals[idx], questionnaire: setQuestionnaire, questionnaireSubmittedAt: Date.now() };
    }
    deals[idx] = { ...deals[idx], ...updates };
    await writeDeals(deals);
    return NextResponse.json(deals[idx]);
}
