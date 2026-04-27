// ─── AUDIT PRIMITIVE ──────────────────────────────────────────────────────────
// Every state mutation on a deal runs through this. Append-only. Immutable.
//
// Usage: in any API route that mutates a deal, build an AuditEntry via
// makeAuditEntry(...) and append it via appendAudit(existingArr, entry).

import type { AuditEntry, Actor } from "./schema";

// Node >= 19 has global crypto. Fallback to Math.random-based id for safety.
function uuid(): string {
    try {
        return globalThis.crypto?.randomUUID?.() ?? fallbackId();
    } catch {
        return fallbackId();
    }
}
function fallbackId(): string {
    return (
        Math.random().toString(36).slice(2, 10) +
        Date.now().toString(36)
    );
}

export function makeAuditEntry(params: {
    actor: Actor;
    actorEmail?: string;
    action: string;
    phaseBefore?: number;
    phaseAfter?: number;
    note?: string;
    data?: Record<string, unknown>;
}): AuditEntry {
    return {
        id: uuid(),
        timestamp: Date.now(),
        ...params,
    };
}

export function appendAudit(
    existing: AuditEntry[] | undefined,
    entry: AuditEntry
): AuditEntry[] {
    return [...(existing || []), entry];
}

// Format an audit entry for human-readable display (admin timeline UI)
export function describeAudit(entry: AuditEntry): string {
    const when = new Date(entry.timestamp).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
    const who = entry.actor === "admin"
        ? (entry.actorEmail || "admin")
        : entry.actor;
    const phaseDelta = (entry.phaseBefore !== undefined && entry.phaseAfter !== undefined && entry.phaseBefore !== entry.phaseAfter)
        ? ` · Phase ${entry.phaseBefore} → ${entry.phaseAfter}`
        : "";
    const noteStr = entry.note ? ` — ${entry.note}` : "";
    return `${when} · ${who} · ${entry.action}${phaseDelta}${noteStr}`;
}
