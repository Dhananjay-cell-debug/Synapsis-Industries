// ─── RAISE DOUBT — escalate from chat to Dhananjay ───────────────────────
// POST /api/syn/raise-doubt/[token]
// body: { description, title?, chatSessionId?, includeLastTurns?: number }
// Creates a raised_items row of kind='doubt' and copies recent chat context.

import { NextRequest, NextResponse } from "next/server";
import { readAllDeals } from "@/lib/phases/dealStore";
import { supabase } from "@/lib/supabase";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
    const { token } = params;
    const body = await req.json().catch(() => ({}));
    const { description, title, chatSessionId, includeLastTurns = 8 } = body as {
        description?: string; title?: string; chatSessionId?: string; includeLastTurns?: number;
    };

    if (!description || !description.trim()) {
        return NextResponse.json({ error: "description required" }, { status: 400 });
    }

    const deals = await readAllDeals();
    const deal = deals.find(d => d.token === token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    const d: any = deal;

    // ─── Pull recent chat context for Dhananjay's review ──────────────────
    let chatContext: { role: string; content: string; at: string }[] = [];
    if (chatSessionId) {
        const { data } = await supabase
            .from("syn_messages")
            .select("role, content, created_at")
            .eq("session_id", chatSessionId)
            .order("created_at", { ascending: false })
            .limit(includeLastTurns);
        chatContext = (data || []).reverse().map(m => ({
            role: m.role, content: m.content, at: m.created_at,
        }));
    }

    const { data: inserted, error: insErr } = await supabase
        .from("raised_items")
        .insert({
            deal_token: token,
            kind: "doubt",
            status: "open",
            title: title?.slice(0, 120) || description.slice(0, 80),
            description: description.trim().slice(0, 4000),
            chat_session_id: chatSessionId || null,
            chat_context: chatContext.length ? chatContext : null,
            client_name: d.name,
            client_email: d.email,
            company: d.company,
            phase: d.phase ?? null,
        })
        .select("id, created_at")
        .single();

    if (insErr || !inserted) {
        return NextResponse.json({ error: "insert_failed", detail: insErr?.message }, { status: 500 });
    }

    // ─── Notify Dhananjay via email (best effort) ─────────────────────────
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.ADMIN_EMAIL) {
        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
            });
            await transporter.sendMail({
                from: `"Synapsis Industries" <${process.env.GMAIL_USER}>`,
                to: process.env.ADMIN_EMAIL,
                subject: `[Synapsis · Doubt Raised] ${d.name} — ${d.company || "no co."}`,
                html: doubtEmailHtml({ deal: d, description: description.trim(), id: inserted.id }),
            });
        } catch (e) {
            console.error("[raise-doubt] email send failed:", e);
        }
    }

    return NextResponse.json({ ok: true, id: inserted.id, createdAt: inserted.created_at });
}

function doubtEmailHtml({ deal, description, id }: { deal: any; description: string; id: string }) {
    return `
    <div style="font-family:Inter,Arial,sans-serif;background:#0A0F1E;color:#fff;padding:32px;border-radius:16px;max-width:600px;margin:0 auto;">
      <p style="color:#F59E0B;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 8px;">Doubt Raised via Syn</p>
      <h1 style="font-size:24px;margin:0;color:#fff;">${deal.name}</h1>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:4px 0 24px;">${deal.company || "No company"} · Phase ${deal.phase ?? "—"}</p>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:16px;">
        <p style="color:rgba(255,255,255,0.3);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 12px;">Description</p>
        <p style="color:rgba(255,255,255,0.85);font-size:14px;line-height:1.7;margin:0;white-space:pre-line;">${escapeHtml(description)}</p>
      </div>
      <p style="margin:24px 0 0;"><a href="https://synapsis-industries.vercel.app/dashboard?raised=${id}" style="display:inline-block;background:#11B8EA;color:#0A0F1E;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">Review in Mission Control</a></p>
    </div>`;
}

function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
