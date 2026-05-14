// ─── SYN ADMIN CHAT — DEEPSEEK STRATEGY CONSOLE ────────────────────────────
// Mirrors /api/syn/chat/[token] but for the admin (Dhananjay), no deal token.
// Sessions are stored against a sentinel deal_token "__admin__" keyed by
// admin email so multiple admins (future) don't bleed into each other.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { buildAdminSynSystemPrompt } from "@/lib/syn/intelligence";
import { callSynStream } from "@/lib/syn/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenFor(email: string) { return `__admin__:${email.toLowerCase()}`; }

// ─── GET — latest admin session + messages ────────────────────────────────
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }
    const dealToken = tokenFor(session!.user!.email!);

    const sessionIdParam = req.nextUrl.searchParams.get("sessionId");
    if (!sessionIdParam) {
        const { data: latest } = await supabase
            .from("syn_sessions")
            .select("id, created_at, updated_at, title")
            .eq("deal_token", dealToken)
            .eq("actor", "admin")
            .order("updated_at", { ascending: false })
            .limit(1);
        const sess = latest?.[0];
        if (!sess) return Response.json({ session: null, messages: [] });

        const { data: msgs } = await supabase
            .from("syn_messages")
            .select("id, role, content, created_at")
            .eq("session_id", sess.id)
            .order("created_at", { ascending: true });

        return Response.json({ session: sess, messages: msgs || [] });
    }

    const { data: msgs } = await supabase
        .from("syn_messages")
        .select("id, role, content, created_at")
        .eq("session_id", sessionIdParam)
        .order("created_at", { ascending: true });
    return Response.json({ sessionId: sessionIdParam, messages: msgs || [] });
}

// ─── POST — stream new turn ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }

    const adminEmail = session!.user!.email!;
    const adminName = session!.user!.name || "Dhananjay";
    const dealToken = tokenFor(adminEmail);

    const body = await req.json().catch(() => ({}));
    const { message, sessionId: incomingSessionId } = body as { message?: string; sessionId?: string };
    if (!message || typeof message !== "string" || !message.trim()) {
        return new Response(JSON.stringify({ error: "message required" }), { status: 400 });
    }

    const systemPrompt = buildAdminSynSystemPrompt({ adminEmail, adminName });

    // Ensure session
    let sessionRowId = incomingSessionId;
    if (!sessionRowId) {
        const { data: created, error } = await supabase
            .from("syn_sessions")
            .insert({
                deal_token: dealToken,
                actor: "admin",
                title: message.slice(0, 60),
            })
            .select("id")
            .single();
        if (error || !created) {
            return new Response(JSON.stringify({ error: "session_create_failed", detail: error?.message }), { status: 500 });
        }
        sessionRowId = created.id;
    }

    await supabase.from("syn_messages").insert({
        session_id: sessionRowId,
        deal_token: dealToken,
        role: "user",
        content: message.trim(),
    });

    const { data: history } = await supabase
        .from("syn_messages")
        .select("role, content")
        .eq("session_id", sessionRowId)
        .order("created_at", { ascending: false })
        .limit(20);
    const ordered = (history || []).reverse();

    let llm;
    try {
        llm = await callSynStream(
            [
                { role: "system", content: systemPrompt },
                ...ordered.map(m => ({ role: m.role, content: m.content })),
            ],
            { temperature: 0.5, maxTokens: 1500 },
        );
    } catch (e: any) {
        return new Response(JSON.stringify({
            error: "no_providers_available",
            detail: (e?.details || [String(e?.message || e)]).slice(-2).join(" | "),
        }), { status: 503 });
    }
    const dsResponse = llm.response;
    const usedModel = llm.model;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let accumulated = "";

    const stream = new ReadableStream({
        async start(controller) {
            controller.enqueue(encoder.encode(`event: session\ndata: ${JSON.stringify({ sessionId: sessionRowId })}\n\n`));
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
                        } catch { /* ignore */ }
                    }
                }
            } catch (e) {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`));
            }

            try {
                await supabase.from("syn_messages").insert({
                    session_id: sessionRowId,
                    deal_token: dealToken,
                    role: "assistant",
                    content: accumulated || "(no response)",
                    model: usedModel,
                });
                await supabase.from("syn_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionRowId);
            } catch (e) {
                console.error("[admin-chat] persist failed:", e);
            }

            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ sessionId: sessionRowId })}\n\n`));
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
