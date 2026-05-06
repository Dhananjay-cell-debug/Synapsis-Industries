import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import type { PhaseData, AuditEntry, ChatMessage } from "@/lib/phases/schema";

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
    totalPrice?: number;
    currency?: "INR" | "USD";
    paymentProvider?: "razorpay" | "stripe";
    acceptInternationalCards?: boolean;
    clientCountry?: string;
    payments?: DealPayment[];
    projectDays?: number;
    customQuestions?: string[];
    interestChatHistory?: { role: "user" | "assistant"; content: string }[];
    phaseData?: PhaseData;
    audit?: AuditEntry[];
    chatMessages?: ChatMessage[];
    clientId?: string;
    lastInteractionAt?: number;
}

// Helper: DB row → Deal interface
function rowToDeal(row: any): Deal {
    return {
        token: row.token,
        submissionId: row.submission_id,
        name: row.name,
        company: row.company || "",
        need: row.need || "",
        budget: row.budget || "",
        message: row.message || "",
        createdAt: new Date(row.created_at).getTime(),
        status: row.status,
        phase: row.phase,
        electedAt: row.elected_at ? new Date(row.elected_at).getTime() : undefined,
        rejectedAt: row.rejected_at ? new Date(row.rejected_at).getTime() : undefined,
        rejectionNote: row.rejection_note || undefined,
        extendedUntil: row.extended_until ? new Date(row.extended_until).getTime() : undefined,
        clientNote: row.client_note || undefined,
        questionnaire: row.questionnaire || undefined,
        questionnaireSubmittedAt: row.questionnaire_submitted_at ? new Date(row.questionnaire_submitted_at).getTime() : undefined,
        messages: row.messages || undefined,
        totalPrice: row.total_price ? Number(row.total_price) : undefined,
        currency: row.currency || "INR",
        paymentProvider: row.payment_provider || "razorpay",
        acceptInternationalCards: row.accept_international_cards || false,
        clientCountry: row.client_country || undefined,
        payments: row.payments || undefined,
        projectDays: row.project_days || undefined,
        customQuestions: row.custom_questions || undefined,
        interestChatHistory: row.interest_chat_history || undefined,
        phaseData: row.phase_data || undefined,
        audit: row.audit || undefined,
        chatMessages: row.chat_messages || undefined,
        clientId: row.client_id || undefined,
        lastInteractionAt: row.last_interaction_at ? new Date(row.last_interaction_at).getTime() : undefined,
    };
}

// Ensure a submission record exists in Supabase when a deal is created
async function ensureSubmissionSupabase(deal: { submissionId: number; name: string; company: string; need: string; budget: string; message: string; createdAt: number }) {
    try {
        const { data: existing } = await supabase
            .from("submissions")
            .select("id")
            .eq("id", deal.submissionId)
            .limit(1);

        if (!existing || existing.length === 0) {
            await supabase.from("submissions").insert({
                id: deal.submissionId,
                name: deal.name,
                company: deal.company,
                need: deal.need,
                budget: deal.budget,
                message: deal.message,
                date: new Date(deal.createdAt).toISOString().slice(0, 10),
                status: "new",
            });
        }
    } catch { /* non-blocking */ }
}

// GET /api/deals?token=xxx → single deal
// GET /api/deals → all deals (admin)
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");
    const { data: rows, error } = await supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[deals] GET error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (token) {
        const row = rows?.find(r => r.token === token);
        if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const deal = rowToDeal(row);

        // "pending" deals expire after 48h (or extended_until)
        // "interested" deals never expire — admin is actively reviewing
        if (deal.status === "pending") {
            const expiry = deal.extendedUntil || (deal.createdAt + 48 * 60 * 60 * 1000);
            if (Date.now() > expiry) {
                await supabase
                    .from("deals")
                    .update({ status: "expired" })
                    .eq("token", token);
                deal.status = "expired";
            }
        }
        return NextResponse.json(deal);
    }

    const deals: Deal[] = (rows || []).map(rowToDeal);
    return NextResponse.json(deals);
}

// POST /api/deals → create deal, returns token
export async function POST(req: NextRequest) {
    const body = await req.json();
    const token = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    const now = new Date();

    const { data, error } = await supabase
        .from("deals")
        .insert({
            token,
            submission_id: body.submissionId,
            name: body.name,
            company: body.company,
            need: body.need,
            budget: body.budget,
            message: body.message,
            status: "pending",
            phase: 0,
            client_id: body.clientEmail || null,
        })
        .select()
        .single();

    if (error) {
        console.error("[deals] POST error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ensure a submission record exists so admin inbox shows it
    await ensureSubmissionSupabase({
        submissionId: body.submissionId,
        name: body.name,
        company: body.company,
        need: body.need,
        budget: body.budget,
        message: body.message,
        createdAt: Date.now(),
    });

    const deal = rowToDeal(data);
    return NextResponse.json({ token, deal });
}

// PATCH /api/deals → update deal
export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { token, appendMessage, setQuestionnaire, ...updates } = body;

    // Fetch current deal
    const { data: existing, error: fetchErr } = await supabase
        .from("deals")
        .select("*")
        .eq("token", token)
        .single();

    if (fetchErr || !existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Build updates object
    const dbUpdates: Record<string, any> = { ...updates };

    if (appendMessage) {
        const currentMessages = existing.messages || [];
        dbUpdates.messages = [...currentMessages, appendMessage];
    }

    if (setQuestionnaire !== undefined) {
        dbUpdates.questionnaire = setQuestionnaire;
        dbUpdates.questionnaire_submitted_at = new Date().toISOString();
    }

    // Convert camelCase to snake_case for DB
    const snakeUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(dbUpdates)) {
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        snakeUpdates[snakeKey] = value;
    }

    const { data, error } = await supabase
        .from("deals")
        .update(snakeUpdates)
        .eq("token", token)
        .select()
        .single();

    if (error) {
        console.error("[deals] PATCH error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget election email when admin elects a client
    if (body.status === "elected" && data.client_id && /\S+@\S+\.\S+/.test(data.client_id)) {
        (async () => {
            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
                });
                const portalUrl = `https://synapsis-industries.vercel.app/client/${data.token}`;
                await transporter.sendMail({
                    from: `"Synapsis Industries" <${process.env.GMAIL_USER}>`,
                    to: data.client_id,
                    subject: "You've been selected — Synapsis Industries",
                    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0A0F1E;color:#fff;padding:40px;border-radius:16px"><h2 style="font-family:serif;font-size:32px;margin-bottom:8px">You're in.</h2><p style="color:#94A3B8;margin-bottom:24px">Your project request has been reviewed and you've been officially selected to move forward with Synapsis Industries.</p><a href="${portalUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#11B8EA,#3B6AE8);color:#0A0F1E;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">Enter Your Project Portal →</a><p style="color:#4B5563;font-size:12px;margin-top:32px">This is your private, secure portal. Bookmark it.</p></div>`,
                });
            } catch { /* non-blocking */ }
        })();
    }

    return NextResponse.json(rowToDeal(data));
}
