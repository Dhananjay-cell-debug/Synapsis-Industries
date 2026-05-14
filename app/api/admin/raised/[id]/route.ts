// ─── ADMIN — single raised item + respond/resolve ─────────────────────────
// GET    /api/admin/raised/[id]   → item + all responses
// POST   /api/admin/raised/[id]   → body: { kind: 'ack'|'progress'|'resolution'|'reply', body, customMessage? }
//                                    Adds a response. On 'ack' the body is
//                                    auto-templated if omitted. On 'resolution'
//                                    the item is closed + email + portal flag.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const ACK_TEMPLATE = (name: string, kind: "doubt" | "issue") =>
    `Hi ${name.split(" ")[0] || "there"},\n\n` +
    `Thank you for taking the time to surface this ${kind}. ` +
    `We've received it and the team is reviewing it now. ` +
    `You'll see an update inside your portal the moment we have something concrete to share, and you'll receive an email confirmation when it's resolved.\n\n` +
    `Appreciate the detail — that's what lets us move fast.\n\n` +
    `— Synapsis Industries`;

const RESOLUTION_TEMPLATE = (name: string, summary: string) =>
    `Hi ${name.split(" ")[0] || "there"},\n\n` +
    `${summary.trim()}\n\n` +
    `We're grateful for clients like you who take the time to flag what matters. ` +
    `Anything else feels off, the same channel works — Raise Doubt or Raise Issue, ` +
    `and we'll be on it.\n\n` +
    `— Synapsis Industries`;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: item } = await supabase
        .from("raised_items")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();
    if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const { data: responses } = await supabase
        .from("raised_responses")
        .select("*")
        .eq("item_id", params.id)
        .order("created_at", { ascending: true });

    return NextResponse.json({ item, responses: responses || [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { kind, body: customBody } = payload as {
        kind: "ack" | "progress" | "resolution" | "reply";
        body?: string;
    };

    if (!kind || !["ack", "progress", "resolution", "reply"].includes(kind)) {
        return NextResponse.json({ error: "kind invalid" }, { status: 400 });
    }

    const { data: item } = await supabase
        .from("raised_items")
        .select("*")
        .eq("id", params.id)
        .maybeSingle();
    if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let body = (customBody || "").trim();
    if (kind === "ack" && !body) body = ACK_TEMPLATE(item.client_name || "", item.kind);
    if (kind === "resolution" && !body) {
        body = RESOLUTION_TEMPLATE(item.client_name || "", "We've fixed the situation you raised. Everything you flagged should now be in order — please give it a check on your end.");
    }
    if (!body) return NextResponse.json({ error: "body required for this kind" }, { status: 400 });

    // ─── Insert response ──────────────────────────────────────────────────
    const { error: respErr } = await supabase
        .from("raised_responses")
        .insert({
            item_id: params.id,
            from_role: "admin",
            actor_email: session?.user?.email || null,
            body,
            kind,
        });
    if (respErr) return NextResponse.json({ error: respErr.message }, { status: 500 });

    // ─── Update item status + flags ───────────────────────────────────────
    const nowIso = new Date().toISOString();
    const patch: any = { has_unread_admin_response: true };
    if (kind === "ack" && item.status === "open") {
        patch.status = "acknowledged";
        patch.acknowledged_at = nowIso;
    }
    if (kind === "progress" && item.status !== "resolved") {
        patch.status = "in_progress";
    }
    if (kind === "resolution") {
        patch.status = "resolved";
        patch.resolved_at = nowIso;
    }
    await supabase.from("raised_items").update(patch).eq("id", params.id);

    // ─── Resolution email to client ───────────────────────────────────────
    if (kind === "resolution" && item.client_email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
            });
            await transporter.sendMail({
                from: `"Synapsis Industries" <${process.env.GMAIL_USER}>`,
                to: item.client_email,
                subject: `Resolved — your ${item.kind} has been addressed`,
                html: resolutionEmailHtml({ item, body }),
            });
        } catch (e) {
            console.error("[admin/raised] resolution email failed:", e);
        }
    }

    return NextResponse.json({ ok: true });
}

function resolutionEmailHtml({ item, body }: { item: any; body: string }) {
    return `
    <!doctype html><html><body style="margin:0;padding:0;background:#0A0F1E;font-family:Inter,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F1E;padding:40px 16px;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#0D1526;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#11B8EA 0%,#3B6AE8 100%);padding:24px 32px;">
            <p style="margin:0;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:0.3em;text-transform:uppercase;">Synapsis Industries</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:600;">Resolved — your ${item.kind} has been addressed</h1>
          </td></tr>
          <tr><td style="padding:32px;color:#fff;">
            <p style="margin:0 0 16px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;white-space:pre-line;">${escapeHtml(body)}</p>
            <p style="margin:0;color:rgba(255,255,255,0.45);font-size:12px;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
              Original ${item.kind}: <em>${escapeHtml((item.title || item.description || "").slice(0, 120))}</em>
            </p>
            <p style="margin:24px 0 0;">
              <a href="https://synapsis-industries.vercel.app/client/${item.deal_token}" style="display:inline-block;background:#11B8EA;color:#0A0F1E;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">Open your portal</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    </body></html>`;
}

function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
