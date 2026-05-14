// ─── RAISE ISSUE — formal issue with screen + voice recording ────────────
// POST /api/syn/raise-issue/[token]
// multipart/form-data:
//   description (string, ≤800 chars)
//   title (optional string)
//   screen (optional Blob — webm video)
//   voice  (optional Blob — webm audio)
//
// Files land in Supabase storage bucket 'syn-recordings'. Row goes to
// synapsis.raised_items with kind='issue'.

import { NextRequest, NextResponse } from "next/server";
import { readAllDeals } from "@/lib/phases/dealStore";
import { supabase } from "@/lib/supabase";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
// Issue uploads can be large — bump body limit (Next 14 reads from route config).
export const maxDuration = 60;

const BUCKET = "syn-recordings";
const MAX_DESC = 800;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB safety cap

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
    const { token } = params;

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "multipart_required" }, { status: 400 });

    const description = String(form.get("description") || "").trim();
    const title = String(form.get("title") || "").trim();
    if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });
    if (description.length > MAX_DESC) {
        return NextResponse.json({ error: `description over ${MAX_DESC} chars` }, { status: 400 });
    }

    const deals = await readAllDeals();
    const deal = deals.find(d => d.token === token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    const d: any = deal;

    const screen = form.get("screen") as File | null;
    const voice = form.get("voice") as File | null;

    const uploadOne = async (file: File | null, kind: "screen" | "voice"): Promise<string | null> => {
        if (!file || !(file instanceof File) || file.size === 0) return null;
        if (file.size > MAX_FILE_BYTES) {
            throw new Error(`${kind} recording exceeds 50 MB`);
        }
        const ext = (file.type.split("/")[1] || "webm").split(";")[0];
        const safeExt = ["webm", "mp4", "ogg", "wav", "mp3", "m4a"].includes(ext) ? ext : "webm";
        const path = `${token}/${Date.now()}-${kind}.${safeExt}`;
        const buf = Buffer.from(await file.arrayBuffer());
        const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
            contentType: file.type || (kind === "screen" ? "video/webm" : "audio/webm"),
            upsert: false,
        });
        if (error) throw new Error(`upload ${kind} failed: ${error.message}`);
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
        return signed?.signedUrl || null;
    };

    let screenUrl: string | null = null;
    let voiceUrl: string | null = null;
    try {
        screenUrl = await uploadOne(screen, "screen");
        voiceUrl = await uploadOne(voice, "voice");
    } catch (e: any) {
        return NextResponse.json({ error: "upload_failed", detail: String(e?.message || e) }, { status: 500 });
    }

    const { data: inserted, error: insErr } = await supabase
        .from("raised_items")
        .insert({
            deal_token: token,
            kind: "issue",
            status: "open",
            title: title?.slice(0, 120) || description.slice(0, 80),
            description,
            screen_recording_url: screenUrl,
            voice_recording_url: voiceUrl,
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

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.ADMIN_EMAIL) {
        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
            });
            await transporter.sendMail({
                from: `"Synapsis Industries" <${process.env.GMAIL_USER}>`,
                to: process.env.ADMIN_EMAIL,
                subject: `[Synapsis · Issue Raised] ${d.name} — ${d.company || "no co."}`,
                html: issueEmailHtml({
                    deal: d, description, id: inserted.id, screenUrl, voiceUrl,
                }),
            });
        } catch (e) {
            console.error("[raise-issue] email send failed:", e);
        }
    }

    return NextResponse.json({
        ok: true, id: inserted.id, createdAt: inserted.created_at,
        screenUrl, voiceUrl,
    });
}

function issueEmailHtml({
    deal, description, id, screenUrl, voiceUrl,
}: {
    deal: any; description: string; id: string; screenUrl: string | null; voiceUrl: string | null;
}) {
    return `
    <div style="font-family:Inter,Arial,sans-serif;background:#0A0F1E;color:#fff;padding:32px;border-radius:16px;max-width:600px;margin:0 auto;">
      <p style="color:#EF4444;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 8px;">Issue Raised</p>
      <h1 style="font-size:24px;margin:0;color:#fff;">${escapeHtml(deal.name)}</h1>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:4px 0 24px;">${escapeHtml(deal.company || "No company")} · Phase ${deal.phase ?? "—"}</p>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:16px;">
        <p style="color:rgba(255,255,255,0.3);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 12px;">Description</p>
        <p style="color:rgba(255,255,255,0.85);font-size:14px;line-height:1.7;margin:0;white-space:pre-line;">${escapeHtml(description)}</p>
      </div>
      ${screenUrl ? `<p style="margin:12px 0;"><a href="${screenUrl}" style="color:#11B8EA;font-size:13px;">📹 View screen recording</a></p>` : ""}
      ${voiceUrl ? `<p style="margin:12px 0;"><a href="${voiceUrl}" style="color:#11B8EA;font-size:13px;">🎙️ Listen to voice note</a></p>` : ""}
      <p style="margin:24px 0 0;"><a href="https://synapsis-industries.vercel.app/dashboard?raised=${id}" style="display:inline-block;background:#11B8EA;color:#0A0F1E;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">Review in Mission Control</a></p>
    </div>`;
}

function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
