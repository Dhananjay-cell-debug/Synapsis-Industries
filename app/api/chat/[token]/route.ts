// ─── PER-PHASE CHAT THREADS ─────────────────────────────────────────────────
// Unified chat endpoint. Messages are tagged by phase number — client and admin
// UIs filter to the current phase's thread. Legacy deal.messages[] is still
// readable but new posts land in deal.chatMessages[].
//
// Routes:
//   GET    /api/chat/:token?phase=3&since=1712345678  → messages for a phase
//   POST   /api/chat/:token                            → post a message
//   PATCH  /api/chat/:token                            → mark messages read
//
// Auth: admin session → posts as "admin". No session but valid token → "client".

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { readAllDeals, writeAllDeals } from "@/lib/phases/dealStore";
import type { ChatMessage } from "@/lib/phases/schema";

function uuid(): string {
    try {
        return globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    } catch {
        return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    }
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    const { token } = params;
    const phaseParam = req.nextUrl.searchParams.get("phase");
    const sinceParam = req.nextUrl.searchParams.get("since");

    const deals = await readAllDeals();
    const deal = deals.find(d => d.token === token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    let messages = deal.chatMessages || [];

    if (phaseParam) {
        const phase = Number(phaseParam);
        messages = messages.filter(m => m.phase === phase);
    }
    if (sinceParam) {
        const since = Number(sinceParam);
        messages = messages.filter(m => m.timestamp > since);
    }

    // Unread count for badge UI
    const session = await getServerSession(authOptions);
    const admin = isAdmin(session?.user?.email);
    const unreadCount = (deal.chatMessages || []).filter(m =>
        admin ? (m.from === "client" && !m.readByAdmin) : (m.from === "admin" && !m.readByClient)
    ).length;

    return NextResponse.json({
        messages,
        unreadCount,
        currentPhase: deal.phase,
    });
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    const { token } = params;
    const body = await req.json();
    const { text, phase, imageUrl } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
        return NextResponse.json({ error: "Message text required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const admin = isAdmin(session?.user?.email);
    const from: "admin" | "client" = admin ? "admin" : "client";

    const deals = await readAllDeals();
    const idx = deals.findIndex(d => d.token === token);
    if (idx === -1) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    const deal = deals[idx];

    const msgPhase = Number(phase) || deal.phase || 1;

    const msg: ChatMessage = {
        id: uuid(),
        phase: msgPhase,
        from,
        text: text.trim(),
        imageUrl: imageUrl || undefined,
        timestamp: Date.now(),
        readByAdmin: admin ? true : false,
        readByClient: admin ? false : true,
    };

    deals[idx] = {
        ...deal,
        chatMessages: [...(deal.chatMessages || []), msg],
        lastInteractionAt: Date.now(),
    };
    await writeAllDeals(deals);

    return NextResponse.json({ ok: true, message: msg });
}

// ─── PATCH — mark messages read ─────────────────────────────────────────────

export async function PATCH(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    const { token } = params;
    const body = await req.json();
    const { phase, messageIds } = body;

    const session = await getServerSession(authOptions);
    const admin = isAdmin(session?.user?.email);

    const deals = await readAllDeals();
    const idx = deals.findIndex(d => d.token === token);
    if (idx === -1) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    const deal = deals[idx];

    const messages = (deal.chatMessages || []).map(m => {
        const inScope = phase ? m.phase === Number(phase) : true;
        const matches = messageIds ? messageIds.includes(m.id) : inScope;
        if (!matches) return m;
        // Only mark the "other side"'s messages as read
        if (admin && m.from === "client") return { ...m, readByAdmin: true };
        if (!admin && m.from === "admin") return { ...m, readByClient: true };
        return m;
    });

    deals[idx] = { ...deal, chatMessages: messages };
    await writeAllDeals(deals);

    return NextResponse.json({ ok: true });
}
