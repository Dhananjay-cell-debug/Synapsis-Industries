// ─── SYN #PANIC PROTOCOL ───────────────────────────────────────────────────
// When a client types "#panic" in chat, Syn freezes all auto-actions for that
// deal, alerts the admin loudly, and replies with a calm holding message.
// This is the client-side emergency brake on the autonomous pilot.

import { mutateDeal } from "@/lib/phases/dealStore";
import { recordSynAction } from "./audit";
import type { Deal } from "@/app/api/deals/route";

export function isPanicMessage(message: string): boolean {
    // Matches "#panic" as a standalone token, case-insensitive.
    return /(^|\s)#panic(\s|$|[.!?])/i.test(message);
}

export interface PanicResult {
    engaged: boolean;
    reply: string;
}

export async function handlePanic(deal: Deal, rawMessage: string): Promise<PanicResult> {
    const ks = {
        active: true,
        engagedAt: Date.now(),
        engagedByEmail: `client:${deal.token}`,
        reason: `#panic triggered by client. Message: "${rawMessage.slice(0, 200)}"`,
    };

    let engaged = false;
    try {
        const updated = await mutateDeal(deal.token, (d) => ({ ...d, synKillSwitch: ks } as any));
        engaged = !!updated;
    } catch (e) {
        console.error("[panic] kill-switch engage failed:", e);
    }

    await recordSynAction({
        dealToken: deal.token,
        actionType: "kill_switch.engage",
        outcome: engaged ? "success" : "error",
        evidence: { trigger: "#panic", message: rawMessage.slice(0, 500) },
        note: `#panic protocol — Syn auto-actions frozen for ${deal.name}`,
        initiatedBy: "system_event",
    });

    // Loud admin alert — email best-effort
    await alertAdminPanic(deal, rawMessage).catch(e => console.error("[panic] admin alert failed:", e));

    const reply = engaged
        ? `I've heard you — Syn is now in safe mode for your project. Every automated action is frozen. Dhananjay has been alerted directly and will step in personally. Nothing will move on your project until he does. You can tell me here exactly what's wrong, and it goes straight to him with full context.`
        : `I've flagged this as urgent and alerted Dhananjay directly. Tell me here what's going wrong — it reaches him with full context. (Note: I couldn't confirm the auto-freeze took effect — Dhananjay will verify manually.)`;

    return { engaged, reply };
}

async function alertAdminPanic(deal: Deal, rawMessage: string): Promise<void> {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.ADMIN_EMAIL) return;
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
        from: `Syn (URGENT) <${process.env.GMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `🚨 #PANIC — ${deal.name} (${deal.company || "—"}) triggered the emergency brake`,
        html: `
            <h2 style="color:#ef4444">Client triggered #panic</h2>
            <p><strong>Client:</strong> ${deal.name} — ${deal.company || "no company"}</p>
            <p><strong>Phase:</strong> ${deal.phase}</p>
            <p><strong>Deal token:</strong> ${deal.token}</p>
            <p><strong>Their message:</strong></p>
            <blockquote style="border-left:3px solid #ef4444;padding-left:12px;color:#444">${rawMessage.slice(0, 1000)}</blockquote>
            <p>Syn auto-actions are now <strong>frozen</strong> for this deal. Open it: <a href="https://synapsis-industries.vercel.app/dashboard">/dashboard</a></p>
        `,
    });
}
