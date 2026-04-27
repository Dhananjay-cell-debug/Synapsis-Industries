// ─── useDealChat — Polling chat hook (client-side) ──────────────────────────
// 15-second interval. Fetches new messages since last poll, merges into state,
// exposes send/markRead. Used by both client portal (/client/[token]) and
// admin workspace (/admin/deal/[token]).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/phases/schema";

interface UseDealChatOpts {
    token: string;
    phase: number;
    pollMs?: number; // default 15000
    enabled?: boolean; // set false to pause polling
}

interface UseDealChatReturn {
    messages: ChatMessage[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    send: (text: string, imageUrl?: string) => Promise<void>;
    markRead: () => Promise<void>;
    refresh: () => Promise<void>;
}

export function useDealChat({ token, phase, pollMs = 15000, enabled = true }: UseDealChatOpts): UseDealChatReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastTsRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchMessages = useCallback(async (initial: boolean = false) => {
        try {
            const since = initial ? 0 : lastTsRef.current;
            const url = `/api/chat/${token}?phase=${phase}${since ? `&since=${since}` : ""}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const incoming: ChatMessage[] = data.messages || [];

            if (initial) {
                setMessages(incoming);
            } else if (incoming.length > 0) {
                setMessages(prev => {
                    const byId = new Map(prev.map(m => [m.id, m]));
                    incoming.forEach(m => byId.set(m.id, m));
                    return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
                });
            }
            if (incoming.length > 0) {
                lastTsRef.current = Math.max(lastTsRef.current, ...incoming.map(m => m.timestamp));
            }
            setUnreadCount(data.unreadCount || 0);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Chat fetch failed");
        } finally {
            setLoading(false);
        }
    }, [token, phase]);

    // Initial load + restart polling when phase changes
    useEffect(() => {
        if (!enabled) return;
        setLoading(true);
        lastTsRef.current = 0;
        setMessages([]);
        fetchMessages(true);
    }, [token, phase, enabled, fetchMessages]);

    // Poll loop
    useEffect(() => {
        if (!enabled) return;
        timerRef.current = setInterval(() => fetchMessages(false), pollMs);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [enabled, pollMs, fetchMessages]);

    const send = useCallback(async (text: string, imageUrl?: string) => {
        const res = await fetch(`/api/chat/${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, phase, imageUrl }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const { message } = await res.json();
        setMessages(prev => [...prev, message]);
        lastTsRef.current = Math.max(lastTsRef.current, message.timestamp);
    }, [token, phase]);

    const markRead = useCallback(async () => {
        await fetch(`/api/chat/${token}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phase }),
        });
        setUnreadCount(0);
    }, [token, phase]);

    return {
        messages,
        unreadCount,
        loading,
        error,
        send,
        markRead,
        refresh: () => fetchMessages(false),
    };
}
