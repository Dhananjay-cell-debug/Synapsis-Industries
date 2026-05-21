// ─── SYN VOICE TTS PROXY ───────────────────────────────────────────────────
// Proxies sentence text from the voice panel to the Python SYN VOICE engine
// (FastAPI, agent/voice/synvc/serve.py) which returns a WAV in Dhananjay's
// approved cloned voice (the D3_v4_pureloud master).
//
// The engine runs wherever SYN_VOICE_TTS_URL points:
//   - local dev / desktop : http://127.0.0.1:8123
//   - production          : a GPU host URL (Modal/RunPod/etc.)
// If SYN_VOICE_TTS_URL is unset, returns 503 and the panel falls back to the
// browser OS voice — so the site never breaks when the engine is offline.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV_ENGINE = process.env.SYN_VOICE_TTS_URL || "";  // optional static override
const ENV_TOKEN = process.env.SYN_VOICE_TOKEN || "";
const TIMEOUT_MS = Number(process.env.SYN_VOICE_TIMEOUT_MS || 60000);

// Resolve the live engine: static env override wins; else the registry row the
// Kaggle kernel self-registers. Cached briefly so we don't hit the DB per sentence.
let _cache: { url: string; token: string; at: number } | null = null;
const CACHE_MS = 10000;

async function resolveEngine(): Promise<{ url: string; token: string } | null> {
    if (ENV_ENGINE) return { url: ENV_ENGINE, token: ENV_TOKEN };
    if (_cache && Date.now() - _cache.at < CACHE_MS) {
        return _cache.url ? { url: _cache.url, token: _cache.token } : null;
    }
    const { data } = await supabase
        .from("voice_engine")
        .select("url, token")
        .eq("id", "default")
        .maybeSingle();
    _cache = { url: data?.url || "", token: data?.token || "", at: Date.now() };
    return data?.url ? { url: data.url, token: data.token || "" } : null;
}

export async function POST(req: NextRequest) {
    const engine = await resolveEngine();
    if (!engine) {
        // No engine live — tell the client to use its fallback voice.
        return new Response(JSON.stringify({ error: "voice_engine_unconfigured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
        });
    }

    let body: { text?: string; gain_db?: number };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "bad_json" }), { status: 400 });
    }
    const text = (body.text || "").trim();
    if (!text) return new Response(null, { status: 204 });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const upstream = await fetch(`${engine.url.replace(/\/$/, "")}/tts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(engine.token ? { "x-syn-token": engine.token } : {}),
            },
            body: JSON.stringify({ text, gain_db: body.gain_db }),
            signal: ctrl.signal,
        });

        if (!upstream.ok || !upstream.body) {
            const detail = await upstream.text().catch(() => "");
            return new Response(
                JSON.stringify({ error: "engine_error", status: upstream.status, detail: detail.slice(0, 200) }),
                { status: 502, headers: { "Content-Type": "application/json" } },
            );
        }

        // Stream the WAV straight through to the browser.
        return new Response(upstream.body, {
            status: 200,
            headers: {
                "Content-Type": upstream.headers.get("Content-Type") || "audio/wav",
                "Cache-Control": "no-store",
            },
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const aborted = msg.includes("abort");
        return new Response(JSON.stringify({ error: aborted ? "engine_timeout" : "engine_unreachable", detail: msg.slice(0, 160) }), {
            status: 504,
            headers: { "Content-Type": "application/json" },
        });
    } finally {
        clearTimeout(timer);
    }
}
