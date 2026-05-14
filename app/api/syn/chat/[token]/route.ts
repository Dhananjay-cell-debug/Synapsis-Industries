// ─── SYN CHAT — DEEPSEEK POWERED CLIENT CONCIERGE ─────────────────────────
// POST /api/syn/chat/[token]
//   body: { sessionId?, message, attachments? }
//   → streams plain-text tokens (SSE-style), final event includes sessionId.
//
// GET  /api/syn/chat/[token]?sessionId=...
//   → returns persisted messages for the session (or latest session for token).
//
// Auth: token must match an existing deal. We trust the portal token for v1.

import { NextRequest } from "next/server";
import { readAllDeals } from "@/lib/phases/dealStore";
import { supabase } from "@/lib/supabase";
import { buildSynSystemPrompt, type ClientContext } from "@/lib/syn/intelligence";
import { callSynStream } from "@/lib/syn/providers";
import { buildDealSnapshot } from "@/lib/syn/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET — load message history ───────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
        const { data: latest } = await supabase
            .from("syn_sessions")
            .select("id, created_at, updated_at, phase, title")
            .eq("deal_token", params.token)
            .eq("actor", "client")
            .order("updated_at", { ascending: false })
            .limit(1);
        const session = latest?.[0];
        if (!session) return Response.json({ session: null, messages: [] });

        const { data: msgs } = await supabase
            .from("syn_messages")
            .select("id, role, content, attachments, created_at")
            .eq("session_id", session.id)
            .order("created_at", { ascending: true });

        return Response.json({ session, messages: msgs || [] });
    }

    const { data: msgs } = await supabase
        .from("syn_messages")
        .select("id, role, content, attachments, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

    return Response.json({ sessionId, messages: msgs || [] });
}

// ─── POST — send a new user message, stream assistant reply ───────────────
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
    const { token } = params;
    const body = await req.json().catch(() => ({}));
    const { message, sessionId: incomingSessionId, attachments } = body as {
        message: string; sessionId?: string; attachments?: unknown;
    };

    if (!message || typeof message !== "string" || !message.trim()) {
        return new Response(JSON.stringify({ error: "message required" }), { status: 400 });
    }

    // ─── Resolve client context from the deal store ───────────────────────
    const deals = await readAllDeals();
    const deal = deals.find(d => d.token === token);
    if (!deal) return new Response(JSON.stringify({ error: "Deal not found" }), { status: 404 });

    // Live snapshot — pulled fresh every request. Syn's authoritative state.
    // If snapshot build fails, we degrade gracefully to basic context only —
    // Syn still works, just without live deal awareness for this turn.
    let snapshot;
    try { snapshot = await buildDealSnapshot(token) || undefined; }
    catch (e) { console.error("[syn/chat] snapshot build failed:", e); snapshot = undefined; }

    const ctx: ClientContext = {
        name: (deal as any).name,
        company: (deal as any).company,
        email: (deal as any).email,
        need: (deal as any).need,
        budget: (deal as any).budget,
        phase: (deal as any).phase ?? 1,
        status: (deal as any).status,
        totalPrice: (deal as any).totalPrice,
        portalToken: token,
        snapshot,
    };
    const systemPrompt = buildSynSystemPrompt(ctx);

    // ─── Ensure session exists ────────────────────────────────────────────
    let sessionId = incomingSessionId;
    if (!sessionId) {
        const { data: created, error: sErr } = await supabase
            .from("syn_sessions")
            .insert({
                deal_token: token,
                actor: "client",
                phase: ctx.phase,
                title: message.slice(0, 60),
            })
            .select("id")
            .single();
        if (sErr || !created) {
            return new Response(JSON.stringify({ error: "session_create_failed", detail: sErr?.message }), { status: 500 });
        }
        sessionId = created.id;
    }

    // ─── Persist user message ─────────────────────────────────────────────
    await supabase.from("syn_messages").insert({
        session_id: sessionId,
        deal_token: token,
        role: "user",
        content: message.trim(),
        attachments: attachments ?? null,
    });

    // ─── Load conversation history (last 20 turns to keep context window sane) ──
    const { data: history } = await supabase
        .from("syn_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(20);
    const ordered = (history || []).reverse();

    // ─── Call LLM through multi-provider waterfall ────────────────────────
    let llm;
    try {
        llm = await callSynStream([
            { role: "system", content: systemPrompt },
            ...ordered.map(m => ({ role: m.role, content: m.content })),
        ]);
    } catch (e: any) {
        return new Response(JSON.stringify({
            error: "no_providers_available",
            detail: (e?.details || [String(e?.message || e)]).slice(-2).join(" | "),
        }), { status: 503 });
    }
    const dsResponse = llm.response;
    const usedModel = llm.model;

    // ─── Stream tokens back to client, accumulate, then persist assistant turn ──
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let accumulated = "";
    let inTokensIn: number | null = null;
    let inTokensOut: number | null = null;

    const stream = new ReadableStream({
        async start(controller) {
            // First event: sessionId
            controller.enqueue(encoder.encode(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`));

            const reader = dsResponse.body!.getReader();
            let buf = "";
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split("\n");
                    buf = lines.pop() || "";
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith("data:")) continue;
                        const payload = trimmed.slice(5).trim();
                        if (payload === "[DONE]") continue;
                        try {
                            const parsed = JSON.parse(payload);
                            const delta = parsed?.choices?.[0]?.delta?.content;
                            if (typeof delta === "string" && delta.length > 0) {
                                accumulated += delta;
                                controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ delta })}\n\n`));
                            }
                            if (parsed?.usage) {
                                inTokensIn = parsed.usage.prompt_tokens ?? null;
                                inTokensOut = parsed.usage.completion_tokens ?? null;
                            }
                        } catch { /* ignore malformed SSE chunks */ }
                    }
                }
            } catch (e) {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`));
            }

            // Persist assistant turn
            try {
                await supabase.from("syn_messages").insert({
                    session_id: sessionId,
                    deal_token: token,
                    role: "assistant",
                    content: accumulated || "(no response)",
                    model: usedModel,
                    tokens_in: inTokensIn,
                    tokens_out: inTokensOut,
                });
                await supabase.from("syn_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
            } catch (e) {
                console.error("[syn] persist assistant turn failed:", e);
            }

            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ sessionId })}\n\n`));
            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
