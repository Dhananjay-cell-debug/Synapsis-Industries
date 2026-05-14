// ─── DEADLINE ENGINE — DB layer for compliance tasks ───────────────────────
// Server-only. Seeds compliance_tasks from the pure planner, and exposes the
// read API (upcoming / overdue). Pure calendar logic lives in deadline-planner.ts.

import 'server-only';
import { supabase } from '@/lib/supabase';
import type { ComplianceTask } from './types';
import {
    type FYBounds,
    type SchemeConfig,
    planFYTasks,
    computeRemindAt,
    fyBoundsForDate,
    fyBoundsFromLabel,
} from './deadline-planner';

// Re-export planner surface so callers can import everything from one place.
export {
    type FYBounds,
    type PlannedTask,
    type SchemeConfig,
    planFYTasks,
    computeRemindAt,
    fyBoundsForDate,
    fyBoundsFromLabel,
} from './deadline-planner';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── DB seeder ───────────────────────────────────────────────────────────

export interface SeedResult {
    fy: string;
    upserted: number;
    errors: string[];
}

/**
 * Insert all planned tasks for the FY. Uses (kind, period) unique constraint
 * to make this idempotent. Run on app boot or via cron monthly.
 */
export async function seedFYTasks(fy: FYBounds, scheme: SchemeConfig): Promise<SeedResult> {
    const plan = planFYTasks(fy, scheme);
    const errors: string[] = [];
    let upserted = 0;

    for (const t of plan) {
        const reminders = computeRemindAt(t.due_date);
        const { error } = await supabase
            .from('compliance_tasks')
            .upsert({
                kind: t.kind,
                title: t.title,
                description: t.description,
                period: t.period,
                due_date: t.due_date,
                severity: t.severity,
                status: 'pending',
                remind_at_t7: reminders.t7,
                remind_at_t3: reminders.t3,
                remind_at_t1: reminders.t1,
                auto_generated: true,
            }, {
                onConflict: 'kind,period',
                ignoreDuplicates: true,
            });
        if (error) {
            errors.push(`${t.kind}/${t.period}: ${error.message}`);
        } else {
            upserted++;
        }
    }

    return { fy: fy.fy_label, upserted, errors };
}

/** Convenience: seed the current FY. */
export async function seedCurrentFY(scheme: SchemeConfig): Promise<SeedResult> {
    return seedFYTasks(fyBoundsForDate(), scheme);
}

// ─── Read API ────────────────────────────────────────────────────────────

export async function upcomingTasks(
    withinDays: number = 30,
    limit: number = 20
): Promise<ComplianceTask[]> {
    const today = new Date();
    const cutoff = new Date(today.getTime() + withinDays * DAY_MS);
    const { data, error } = await supabase
        .from('compliance_tasks')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .lte('due_date', cutoff.toISOString().slice(0, 10))
        .order('due_date', { ascending: true })
        .limit(limit);
    if (error) throw new Error(`upcomingTasks: ${error.message}`);
    return (data ?? []) as ComplianceTask[];
}

export async function overdueTasks(): Promise<ComplianceTask[]> {
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('compliance_tasks')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .lt('due_date', todayIso)
        .order('due_date', { ascending: true });
    if (error) throw new Error(`overdueTasks: ${error.message}`);
    return (data ?? []) as ComplianceTask[];
}

/** Mark a task complete, optionally linking the resulting filing record. */
export async function completeTask(
    taskId: string,
    notes?: string,
    relatedFilingId?: string
): Promise<ComplianceTask> {
    const { data, error } = await supabase
        .from('compliance_tasks')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_notes: notes ?? null,
            related_filing_id: relatedFilingId ?? null,
        })
        .eq('id', taskId)
        .select('*')
        .single();
    if (error || !data) throw new Error(`completeTask: ${error?.message ?? 'no row'}`);
    return data as ComplianceTask;
}

/** Flip pending tasks whose due_date has passed to 'overdue'. Run via cron. */
export async function markOverdueTasks(): Promise<number> {
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('compliance_tasks')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('due_date', todayIso)
        .select('id');
    if (error) throw new Error(`markOverdueTasks: ${error.message}`);
    return (data ?? []).length;
}
