// ─── ADMIN NOTIFICATIONS FEED ───────────────────────────────────────────────
// Derives a unified notification list from existing deal state — no separate
// notifications table needed in V1. Pulls signals from:
//   - new submissions (status=pending, recent)
//   - unread client chat messages
//   - blueprint client decisions (changes_requested / approved / declined)
//   - paid payment captures (within last 24h)
//   - ghosted clients (lastInteractionAt > 7d ago)
//   - questionnaire submissions
//   - revision requests

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { readAllDeals } from "@/lib/phases/dealStore";
import { GHOST_ALERT_DAYS, GHOST_WARNING_DAYS } from "@/lib/phases/constants";
import type { Notification } from "@/lib/phases/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
    }

    const deals = await readAllDeals();
    const notifications: Notification[] = [];
    const now = Date.now();

    for (const deal of deals) {
        // 1. New submission (Phase 0, pending, < 24h old)
        if (deal.status === "pending" && now - deal.createdAt < DAY_MS) {
            notifications.push({
                id: `inbox.${deal.token}`,
                kind: "inbox.new",
                dealToken: deal.token,
                clientName: deal.name,
                phase: 0,
                title: `New inquiry — ${deal.name}`,
                body: `${deal.company} · ${deal.need} · ${deal.budget}`,
                createdAt: deal.createdAt,
                urgent: now - deal.createdAt > 12 * 60 * 60 * 1000, // urgent after 12h
            });
        }

        // 2. Unread client chat
        const unreadFromClient = (deal.chatMessages || []).filter(m => m.from === "client" && !m.readByAdmin);
        if (unreadFromClient.length > 0) {
            const latest = unreadFromClient[unreadFromClient.length - 1];
            notifications.push({
                id: `chat.${deal.token}.${latest.id}`,
                kind: "chat.new",
                dealToken: deal.token,
                clientName: deal.name,
                phase: deal.phase,
                title: `${deal.name} sent ${unreadFromClient.length} message${unreadFromClient.length > 1 ? "s" : ""}`,
                body: latest.text.slice(0, 120),
                createdAt: latest.timestamp,
                urgent: false,
            });
        }

        // 3. Blueprint state changes (phase 2)
        const bp = deal.phaseData?.phase2?.blueprint;
        if (bp?.status === "changes_requested" && bp.clientFeedback) {
            notifications.push({
                id: `bp.changes.${deal.token}.v${bp.version}`,
                kind: "blueprint.changes_requested",
                dealToken: deal.token,
                clientName: deal.name,
                phase: 2,
                title: `${deal.name} requested blueprint changes`,
                body: bp.clientFeedback.slice(0, 120),
                createdAt: now, // server-derived; stable enough for V1
                urgent: true,
            });
        }
        if (bp?.status === "approved" && bp.approvedAt && now - bp.approvedAt < DAY_MS) {
            notifications.push({
                id: `bp.approved.${deal.token}.v${bp.version}`,
                kind: "blueprint.approved",
                dealToken: deal.token,
                clientName: deal.name,
                phase: 2,
                title: `Blueprint approved by ${deal.name}`,
                body: `Project total: ₹${bp.investmentTotal.toLocaleString("en-IN")}`,
                createdAt: bp.approvedAt,
                urgent: false,
            });
        }

        // 4. Recent payments captured
        for (const p of deal.payments || []) {
            if (p.status === "paid" && p.paidAt && now - p.paidAt < DAY_MS) {
                notifications.push({
                    id: `pay.${deal.token}.p${p.phase}`,
                    kind: "payment.captured",
                    dealToken: deal.token,
                    clientName: deal.name,
                    phase: p.phase,
                    title: `Payment received — ${deal.name}`,
                    body: `Phase ${p.phase} · ₹${p.amount.toLocaleString("en-IN")} (${p.percentage}%)`,
                    createdAt: p.paidAt,
                    urgent: false,
                });
            }
        }

        // 5. Ghosting alerts (active deals only)
        if (["elected", "proceeding", "active"].includes(deal.status) && deal.lastInteractionAt) {
            const stale = (now - deal.lastInteractionAt) / DAY_MS;
            if (stale >= GHOST_ALERT_DAYS) {
                notifications.push({
                    id: `ghost.red.${deal.token}`,
                    kind: "client.ghosted",
                    dealToken: deal.token,
                    clientName: deal.name,
                    phase: deal.phase,
                    title: `🔴 ${deal.name} has gone silent`,
                    body: `${Math.floor(stale)}d since last response — Phase ${deal.phase}`,
                    createdAt: deal.lastInteractionAt,
                    urgent: true,
                });
            } else if (stale >= GHOST_WARNING_DAYS) {
                notifications.push({
                    id: `ghost.yellow.${deal.token}`,
                    kind: "client.ghosted",
                    dealToken: deal.token,
                    clientName: deal.name,
                    phase: deal.phase,
                    title: `🟡 ${deal.name} — reminder due`,
                    body: `${Math.floor(stale)}d since last response — Phase ${deal.phase}`,
                    createdAt: deal.lastInteractionAt,
                    urgent: false,
                });
            }
        }

        // 6. Questionnaire submitted (Phase 1)
        if (deal.questionnaireSubmittedAt && now - deal.questionnaireSubmittedAt < DAY_MS) {
            notifications.push({
                id: `q.submitted.${deal.token}`,
                kind: "questionnaire.submitted",
                dealToken: deal.token,
                clientName: deal.name,
                phase: 1,
                title: `${deal.name} submitted Discovery Q`,
                body: "Review answers and schedule the kickoff call",
                createdAt: deal.questionnaireSubmittedAt,
                urgent: false,
            });
        }

        // 7. Revision requested (Phase 5)
        const revs = deal.phaseData?.phase5?.revisionRounds || [];
        const openRev = revs.find(r => !r.resolvedAt);
        if (openRev && now - openRev.submittedAt < DAY_MS * 3) {
            notifications.push({
                id: `rev.${deal.token}.${openRev.id}`,
                kind: "revision.requested",
                dealToken: deal.token,
                clientName: deal.name,
                phase: 5,
                title: `${deal.name} requested revision (round ${openRev.roundNumber})`,
                body: openRev.feedback.slice(0, 120),
                createdAt: openRev.submittedAt,
                urgent: false,
            });
        }
    }

    // Sort: urgent first, then most recent
    notifications.sort((a, b) => {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        return b.createdAt - a.createdAt;
    });

    return NextResponse.json({
        notifications,
        unreadCount: notifications.length,
        urgentCount: notifications.filter(n => n.urgent).length,
    });
}
