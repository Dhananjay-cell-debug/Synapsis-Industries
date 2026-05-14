// ─── COMPLIANCE REMINDERS ──────────────────────────────────────────────────
// Finds compliance_tasks whose T-7 / T-3 / T-1 reminder window has opened and
// emails Dhananjay a branded alert. Marks the tier sent so it never re-spams.
// Driven by the daily cron at /api/compliance/cron/reminders.

import "server-only";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import type { ComplianceTask } from "./types";

export type ReminderTier = "t7" | "t3" | "t1";

export interface DueReminder {
    task: ComplianceTask;
    tiersToMark: ReminderTier[];   // every due+unsent tier (marked together so no backlog spam)
    sendTier: ReminderTier;        // the most urgent — the one we actually email about
}

export interface ReminderSweepReport {
    checked: number;
    sent: number;
    skipped: number;
    errors: string[];
    timestamp: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://synapsis-industries.vercel.app";

const TIER_META: Record<ReminderTier, { window: string; tone: string }> = {
    t7: { window: "in 7 days", tone: "#11B8EA" },
    t3: { window: "in 3 days", tone: "#D98E0C" },
    t1: { window: "tomorrow", tone: "#C23B3B" },
};

function getTransporter() {
    return nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
}

function daysUntil(dueDateIso: string): number {
    const due = new Date(dueDateIso + "T00:00:00Z").getTime();
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return Math.floor((due - todayUtc) / 86_400_000);
}

// ─── Find what's due ───────────────────────────────────────────────────────

export async function findDueReminders(now: Date = new Date()): Promise<DueReminder[]> {
    const { data, error } = await supabase
        .from("compliance_tasks")
        .select("*")
        .in("status", ["pending", "in_progress"]);
    if (error) throw new Error(`findDueReminders: ${error.message}`);

    const nowMs = now.getTime();
    const due: DueReminder[] = [];

    for (const t of (data ?? []) as ComplianceTask[]) {
        const tiers: ReminderTier[] = [];
        if (t.remind_at_t7 && !t.reminded_t7_sent && new Date(t.remind_at_t7).getTime() <= nowMs) tiers.push("t7");
        if (t.remind_at_t3 && !t.reminded_t3_sent && new Date(t.remind_at_t3).getTime() <= nowMs) tiers.push("t3");
        if (t.remind_at_t1 && !t.reminded_t1_sent && new Date(t.remind_at_t1).getTime() <= nowMs) tiers.push("t1");
        if (tiers.length > 0) {
            // [t7, t3, t1] is least→most urgent; last entry is the one we email about
            due.push({ task: t, tiersToMark: tiers, sendTier: tiers[tiers.length - 1] });
        }
    }
    return due;
}

// ─── Email builder ─────────────────────────────────────────────────────────

function buildEmailHtml(task: ComplianceTask, tier: ReminderTier): string {
    const meta = TIER_META[tier];
    const d = daysUntil(task.due_date);
    const countdown = d < 0 ? `${-d} day(s) overdue` : d === 0 ? "due today" : d === 1 ? "due tomorrow" : `due in ${d} days`;
    const dueStr = new Date(task.due_date + "T00:00:00Z").toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });

    return `
<!doctype html>
<html><head><meta charset="utf-8"/><title>Compliance reminder</title></head>
<body style="margin:0;padding:0;background:#0A0F1E;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F1E;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0D1526;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#0C97C4 0%,#3B6AE8 100%);padding:24px 32px;">
    <p style="margin:0;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:0.3em;text-transform:uppercase;">Synapsis Compliance OS</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:600;">Deadline ${meta.window}</h1>
  </td></tr>
  <tr><td style="padding:32px;color:#fff;">
    <p style="margin:0 0 16px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">
      Ek compliance deadline aa rahi hai. Yeh sirf reminder hai — system ne sab data ready rakha hai, tujhe bas portal pe submit karna hai.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(12,151,196,0.08);border:1px solid rgba(12,151,196,0.25);border-radius:12px;padding:20px;margin:0 0 16px;">
    <tr><td>
      <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">${task.kind}</p>
      <p style="margin:0;color:#fff;font-size:18px;font-weight:600;">${task.title}</p>
      <p style="margin:10px 0 0;color:${meta.tone};font-size:13px;font-weight:600;">${dueStr} · ${countdown}</p>
    </td></tr></table>
    ${task.description ? `<p style="margin:0 0 8px;color:rgba(255,255,255,0.55);font-size:12px;line-height:1.7;">${task.description}</p>` : ""}
    <p style="margin:24px 0 0;">
      <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#0C97C4;color:#fff;padding:12px 26px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">
        Open Compliance OS →
      </a>
    </p>
    <p style="margin:14px 0 0;color:rgba(255,255,255,0.4);font-size:11px;line-height:1.6;">
      Dashboard kholo → sidebar mein "Compliance OS" → guided tutorial tujhe har click pe le jaayega.
    </p>
  </td></tr>
  <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;line-height:1.6;">
      Automated reminder from Synapsis Compliance OS. T-7 / T-3 / T-1 schedule.<br/>
      Synapsis Industries · Self-file compliance system.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ─── Send one reminder ─────────────────────────────────────────────────────

export async function sendComplianceReminder(task: ComplianceTask, tier: ReminderTier): Promise<void> {
    const to = process.env.ADMIN_EMAIL || "dhananjaychitmila@gmail.com";
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not configured");
    }
    const meta = TIER_META[tier];
    const transporter = getTransporter();
    await transporter.sendMail({
        from: `"Synapsis Compliance" <${process.env.GMAIL_USER}>`,
        to,
        subject: `[Synapsis Compliance] ${task.title} — due ${meta.window}`,
        html: buildEmailHtml(task, tier),
    });
}

// ─── Mark tiers sent ───────────────────────────────────────────────────────

export async function markRemindersSent(taskId: string, tiers: ReminderTier[]): Promise<void> {
    const updates: Record<string, boolean> = {};
    for (const tier of tiers) updates[`reminded_${tier}_sent`] = true;
    const { error } = await supabase.from("compliance_tasks").update(updates).eq("id", taskId);
    if (error) throw new Error(`markRemindersSent: ${error.message}`);
}

// ─── Full sweep — find → send → mark ───────────────────────────────────────

export async function runReminderSweep(now: Date = new Date()): Promise<ReminderSweepReport> {
    const due = await findDueReminders(now);
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const r of due) {
        try {
            await sendComplianceReminder(r.task, r.sendTier);
            await markRemindersSent(r.task.id, r.tiersToMark);
            sent++;
        } catch (e) {
            // If email failed, do NOT mark sent — it will retry next run.
            errors.push(`${r.task.kind}/${r.task.period ?? "—"}: ${e instanceof Error ? e.message : String(e)}`);
            skipped++;
        }
    }

    return {
        checked: due.length,
        sent,
        skipped,
        errors,
        timestamp: new Date().toISOString(),
    };
}
