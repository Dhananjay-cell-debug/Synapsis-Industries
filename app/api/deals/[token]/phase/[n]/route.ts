// ─── UNIFIED PHASE API ──────────────────────────────────────────────────────
// Single endpoint. Both admin and client portals hit this for any phase-related
// mutation. The action name maps to a transition function in lib/phases/transitions.ts.
// Non-transition mutations (draft saves, UI state) use the PATCH path.
//
// Routes:
//   GET    /api/deals/:token/phase/:n        → phase-n data + deal snapshot
//   POST   /api/deals/:token/phase/:n        → dispatch transition action
//   PATCH  /api/deals/:token/phase/:n        → non-transition phase patch (draft saves)
//
// Admin actions require session.user.email === ADMIN_EMAIL. Client actions
// are authenticated only by deal token possession (V1 security model).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { readAllDeals, writeAllDeals } from "@/lib/phases/dealStore";
import {
    t0to1_elect,
    t0_reject,
    t0_clientRecovery,
    t1to2_goDecision,
    t2_sendBlueprint,
    t2to3_approveBlueprint,
    t2_requestChanges,
    t2_decline,
    t3_submitAsset,
    t3to4_confirmAssets,
    t4to5_submitFinal,
    t5to6_finalApprove,
    t5_submitRevision,
    t6_finalPaid,
    t6_markDeployed,
    t6_uploadHandover,
    t6to7_tryAdvance,
    forcePhaseJump,
    canTransition,
} from "@/lib/phases/transitions";
import { makeAuditEntry, appendAudit } from "@/lib/phases/audit";
import type { Deal } from "@/app/api/deals/route";
import type { Blueprint } from "@/lib/phases/schema";

// ─── Action dispatch map ───────────────────────────────────────────────────
// Adds a layer of admin-vs-client auth per action name.

type ActionName =
    | "elect" | "reject" | "clientRecovery"
    | "goDecision"
    | "sendBlueprint" | "approveBlueprint" | "requestChanges" | "declineBlueprint"
    | "submitAsset" | "confirmAssets"
    | "submitFinal"
    | "finalApprove" | "submitRevision"
    | "finalPaid" | "markDeployed" | "uploadHandover" | "tryAdvanceToOrbit"
    | "forcePhaseJump";

const ADMIN_ONLY_ACTIONS = new Set<ActionName>([
    "elect", "reject", "goDecision",
    "sendBlueprint", "confirmAssets",
    "submitFinal", "finalPaid", "markDeployed", "uploadHandover", "tryAdvanceToOrbit",
    "forcePhaseJump",
]);

const CLIENT_ONLY_ACTIONS = new Set<ActionName>([
    "clientRecovery", "approveBlueprint", "requestChanges", "declineBlueprint",
    "submitAsset", "finalApprove", "submitRevision",
]);

// ─── GET — read phase data ──────────────────────────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: { token: string; n: string } }
) {
    const { token, n } = params;
    const phaseNum = Number(n);
    if (isNaN(phaseNum) || phaseNum < 0 || phaseNum > 7) {
        return NextResponse.json({ error: "Invalid phase number" }, { status: 400 });
    }

    const deals = await readAllDeals();
    const deal = deals.find(d => d.token === token);
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const phaseKey = phaseNum === 0 ? null : `phase${phaseNum}` as keyof NonNullable<Deal["phaseData"]>;
    const phaseData = phaseKey ? deal.phaseData?.[phaseKey] : null;

    // Precondition lookup — UI uses this to enable/disable action buttons
    const availableTransitions = Object.fromEntries(
        [
            "elect", "goDecision", "sendBlueprint", "confirmAssets",
            "submitFinal", "markDeployed", "uploadHandover", "tryAdvanceToOrbit",
        ].map(name => [name, canTransition(deal, name)])
    );

    return NextResponse.json({
        deal,
        phase: phaseNum,
        phaseData,
        availableTransitions,
    });
}

// ─── POST — dispatch transition action ─────────────────────────────────────

export async function POST(
    req: NextRequest,
    { params }: { params: { token: string; n: string } }
) {
    const { token } = params;
    const body = await req.json();
    const action = body.action as ActionName;
    const ctx = body.ctx || {};

    if (!action) {
        return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    // Auth gate
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const admin = isAdmin(userEmail);

    if (ADMIN_ONLY_ACTIONS.has(action) && !admin) {
        return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
    }
    // Client-only actions require NO auth but must have valid token (checked below)

    const deals = await readAllDeals();
    const idx = deals.findIndex(d => d.token === token);
    if (idx === -1) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    const deal = deals[idx];

    // Inject admin email into ctx for transitions that need attribution
    const fullCtx = { ...ctx, adminEmail: admin ? userEmail! : ctx.adminEmail };

    // Dispatch
    let result;
    switch (action) {
        case "elect":             result = t0to1_elect(deal, fullCtx); break;
        case "reject":            result = t0_reject(deal, fullCtx); break;
        case "clientRecovery":    result = t0_clientRecovery(deal, fullCtx); break;
        case "goDecision":        result = t1to2_goDecision(deal, fullCtx); break;
        case "sendBlueprint":     result = t2_sendBlueprint(deal, fullCtx); break;
        case "approveBlueprint":  result = t2to3_approveBlueprint(deal); break;
        case "requestChanges":    result = t2_requestChanges(deal, fullCtx); break;
        case "declineBlueprint":  result = t2_decline(deal, fullCtx); break;
        case "submitAsset":       result = t3_submitAsset(deal, fullCtx); break;
        case "confirmAssets":     result = t3to4_confirmAssets(deal, fullCtx); break;
        case "submitFinal":       result = t4to5_submitFinal(deal, fullCtx); break;
        case "finalApprove":      result = t5to6_finalApprove(deal); break;
        case "submitRevision":    result = t5_submitRevision(deal, fullCtx); break;
        case "finalPaid":         result = t6_finalPaid(deal, fullCtx); break;
        case "markDeployed":      result = t6_markDeployed(deal, fullCtx); break;
        case "uploadHandover":    result = t6_uploadHandover(deal, fullCtx); break;
        case "tryAdvanceToOrbit": result = t6to7_tryAdvance(deal); break;
        case "forcePhaseJump":    result = forcePhaseJump(deal, fullCtx); break;
        default:
            return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (!result.ok) {
        return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    deals[idx] = { ...result.deal, lastInteractionAt: Date.now() };
    await writeAllDeals(deals);

    return NextResponse.json({ ok: true, deal: deals[idx], audit: result.audit });
}

// ─── PATCH — non-transition phase-data patch (draft saves, editor updates) ──
//
// Use when the mutation does not advance phase or fire a state machine event.
// Examples:
//   - admin editing blueprint draft before sending
//   - admin adding sprint report to phase 4
//   - client saving partial questionnaire answers
//
// Body shape: { phaseDataPatch: Partial<PhaseKData>, auditAction?: string, note?: string }

export async function PATCH(
    req: NextRequest,
    { params }: { params: { token: string; n: string } }
) {
    const { token, n } = params;
    const phaseNum = Number(n);
    if (isNaN(phaseNum) || phaseNum < 1 || phaseNum > 7) {
        return NextResponse.json({ error: "Invalid phase number (PATCH only allowed on phases 1-7)" }, { status: 400 });
    }

    const body = await req.json();
    const { phaseDataPatch, auditAction, note, blueprintDraft } = body;

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const admin = isAdmin(userEmail);

    const deals = await readAllDeals();
    const idx = deals.findIndex(d => d.token === token);
    if (idx === -1) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    const deal = deals[idx];

    const phaseKey = `phase${phaseNum}` as keyof NonNullable<Deal["phaseData"]>;
    const existing = (deal.phaseData?.[phaseKey] as Record<string, unknown>) || {};

    // Special handling: blueprintDraft goes inside phase2.blueprint with status:"draft"
    let newPhaseData = { ...existing, ...(phaseDataPatch || {}) };
    if (phaseNum === 2 && blueprintDraft) {
        const bp: Blueprint = {
            ...(existing as { blueprint?: Blueprint }).blueprint,
            ...blueprintDraft,
            version: ((existing as { blueprint?: Blueprint }).blueprint?.version) || 1,
            status: "draft",
        };
        newPhaseData = { ...newPhaseData, blueprint: bp };
    }

    const updatedDeal: Deal = {
        ...deal,
        phaseData: {
            ...(deal.phaseData || {}),
            [phaseKey]: newPhaseData,
        },
        lastInteractionAt: Date.now(),
    };

    // Audit the patch (low-weight — "draft.save", "note.add", etc.)
    if (auditAction) {
        const entry = makeAuditEntry({
            actor: admin ? "admin" : "client",
            actorEmail: admin ? userEmail || undefined : undefined,
            action: auditAction,
            phaseBefore: deal.phase,
            phaseAfter: deal.phase,
            note,
        });
        updatedDeal.audit = appendAudit(deal.audit, entry);
    }

    deals[idx] = updatedDeal;
    await writeAllDeals(deals);

    return NextResponse.json({ ok: true, deal: updatedDeal });
}
