// ─── COMPLIANCE CALENDAR VIEW ──────────────────────────────────────────────
// All statutory deadlines. Filter, mark complete / reopen.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, AlertTriangle, CalendarClock } from "lucide-react";
import {
    COMPLIANCE, Card, ViewHeader, SectionLabel, Badge, Button,
    formatDate, daysUntil, LoadingBlock, ErrorBlock, EmptyState,
} from "../ui";
import { cn } from "@/lib/utils";
import type { ComplianceTask } from "@/lib/compliance/types";

type Filter = "all" | "upcoming" | "overdue" | "completed";

export default function CalendarView() {
    const [tasks, setTasks] = useState<ComplianceTask[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("upcoming");
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = () => {
        setError(null);
        fetch("/api/compliance/tasks")
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
                return r.json();
            })
            .then((d) => setTasks(d.all))
            .catch((e) => setError(e.message));
    };
    useEffect(load, []);

    const act = async (id: string, action: "complete" | "reopen") => {
        setBusyId(id);
        try {
            const r = await fetch("/api/compliance/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action }),
            });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            const updated: ComplianceTask = await r.json();
            setTasks((prev) => prev?.map((t) => (t.id === id ? updated : t)) ?? null);
        } catch (e) {
            alert(`Action failed: ${e instanceof Error ? e.message : e}`);
        } finally {
            setBusyId(null);
        }
    };

    const filtered = useMemo(() => {
        if (!tasks) return [];
        const todayIso = new Date().toISOString().slice(0, 10);
        const list = tasks.filter((t) => {
            if (filter === "all") return true;
            if (filter === "completed") return t.status === "completed";
            if (filter === "overdue") return t.status !== "completed" && t.due_date < todayIso;
            // upcoming
            return t.status !== "completed" && t.due_date >= todayIso;
        });
        return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
    }, [tasks, filter]);

    const counts = useMemo(() => {
        const todayIso = new Date().toISOString().slice(0, 10);
        const c = { all: 0, upcoming: 0, overdue: 0, completed: 0 };
        for (const t of tasks ?? []) {
            c.all++;
            if (t.status === "completed") c.completed++;
            else if (t.due_date < todayIso) c.overdue++;
            else c.upcoming++;
        }
        return c;
    }, [tasks]);

    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!tasks) return <LoadingBlock label="Loading calendar" />;

    return (
        <div>
            <ViewHeader
                eyebrow="Statutory deadlines"
                title="Compliance Calendar"
                subtitle="Every GST, income-tax and registration deadline. Reminders fire T-7 / T-3 / T-1. Mark filed once you submit on the portal."
            />

            {/* filter tabs */}
            <div className="flex gap-1.5 p-1 rounded-xl mb-5 w-fit" style={{ background: "#F0F2F4" }}>
                {(["upcoming", "overdue", "completed", "all"] as Filter[]).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn("px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all flex items-center gap-1.5")}
                        style={filter === f
                            ? { background: "#fff", color: COMPLIANCE.ink, boxShadow: "0 1px 3px rgba(10,15,30,0.10)" }
                            : { color: COMPLIANCE.muted }}
                    >
                        {f}
                        <span
                            className="text-[10px] rounded-full px-1.5 py-0.5"
                            style={{
                                background: filter === f ? COMPLIANCE.accentSoft : "transparent",
                                color: filter === f ? COMPLIANCE.accent : COMPLIANCE.muted,
                            }}
                        >
                            {counts[f]}
                        </span>
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<CalendarClock size={20} />}
                        title={`Nothing ${filter}`}
                        hint={filter === "overdue" ? "All deadlines on track — nothing slipped." : "Tasks auto-seed per fiscal year. GST returns appear once GSTIN activates."}
                    />
                </Card>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {filtered.map((t) => {
                        const d = daysUntil(t.due_date);
                        const isDone = t.status === "completed";
                        const isOverdue = !isDone && d !== null && d < 0;
                        return (
                            <Card key={t.id} padded={false}>
                                <div className="flex items-center gap-4 px-5 py-4">
                                    {/* severity dot */}
                                    <div
                                        className="w-1.5 h-10 rounded-full shrink-0"
                                        style={{
                                            background: isDone ? "#0E8A50"
                                                : isOverdue ? "#C23B3B"
                                                : t.severity === "critical" ? COMPLIANCE.accent
                                                : COMPLIANCE.hairline,
                                        }}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className={cn("text-sm font-semibold", isDone && "line-through")} style={{ color: isDone ? COMPLIANCE.muted : COMPLIANCE.ink }}>
                                                {t.title}
                                            </p>
                                            <Badge tone={t.severity === "critical" ? "accent" : t.severity === "informational" ? "neutral" : "neutral"}>
                                                {t.kind}
                                            </Badge>
                                            {isOverdue && <Badge tone="danger"><AlertTriangle size={9} /> overdue</Badge>}
                                        </div>
                                        {t.description && (
                                            <p className="text-[12px] mt-1 leading-relaxed line-clamp-2" style={{ color: COMPLIANCE.muted }}>
                                                {t.description}
                                            </p>
                                        )}
                                        <p className="text-[11px] mt-1 font-medium" style={{ color: COMPLIANCE.body }}>
                                            Due {formatDate(t.due_date)}
                                            {t.period ? ` · ${t.period}` : ""}
                                            {isDone && t.completed_at ? ` · filed ${formatDate(t.completed_at)}` : ""}
                                        </p>
                                    </div>
                                    {/* countdown + action */}
                                    <div className="flex items-center gap-3 shrink-0">
                                        {!isDone && (
                                            <Badge tone={isOverdue ? "danger" : d !== null && d <= 14 ? "warn" : "neutral"}>
                                                {d === null ? "—" : d < 0 ? `${-d}d late` : d === 0 ? "today" : `${d}d left`}
                                            </Badge>
                                        )}
                                        {isDone ? (
                                            <Button variant="ghost" size="sm" disabled={busyId === t.id} onClick={() => act(t.id, "reopen")}>
                                                <RotateCcw size={13} /> Reopen
                                            </Button>
                                        ) : (
                                            <Button variant="outline" size="sm" disabled={busyId === t.id} onClick={() => act(t.id, "complete")}>
                                                <CheckCircle2 size={13} /> Mark filed
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
