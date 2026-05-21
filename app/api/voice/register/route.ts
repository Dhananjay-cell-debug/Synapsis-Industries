// ─── SYN VOICE ENGINE REGISTER ─────────────────────────────────────────────
// The Kaggle GPU kernel POSTs its current cloudflared tunnel URL here on boot.
// We store it in synapsis.voice_engine so /api/voice/tts always finds the live
// engine — no manual Vercel env re-paste when the Kaggle session restarts.
//
// Auth: shared secret in `x-register-secret` header, compared to
// SYN_VOICE_REGISTER_SECRET. If the secret isn't configured, registration is
// disabled (503) so a misconfig can't let randoms repoint the engine.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.SYN_VOICE_REGISTER_SECRET || "";

export async function POST(req: NextRequest) {
    if (!SECRET) {
        return Response.json({ error: "registration_disabled" }, { status: 503 });
    }
    if (req.headers.get("x-register-secret") !== SECRET) {
        return Response.json({ error: "forbidden" }, { status: 403 });
    }

    let body: { url?: string; token?: string; device?: string };
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: "bad_json" }, { status: 400 });
    }
    const url = (body.url || "").trim();
    if (!/^https?:\/\/.+/.test(url)) {
        return Response.json({ error: "bad_url" }, { status: 400 });
    }

    const { error } = await supabase
        .from("voice_engine")
        .upsert(
            { id: "default", url, token: body.token ?? null, device: body.device ?? null, updated_at: new Date().toISOString() },
            { onConflict: "id" },
        );

    if (error) {
        return Response.json({ error: "db_error", detail: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, url });
}
