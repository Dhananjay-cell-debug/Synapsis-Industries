// ─── SYN VERIFICATION ENGINE ───────────────────────────────────────────────
// Deterministic checklist runner. No LLM judgment — every rule is hand-coded
// TypeScript. The LLM may orchestrate calls to this engine, but it cannot
// override a rule's outcome.
//
// Contract:
//   const outcome = await runChecklist(checklist, deal, ctx);
//   if (outcome.passed) { /* safe to fire transition */ }
//
// Short-circuits on the first blocker fail. Warnings collected but don't
// block. Each rule result carries an `evidence` string for the audit trail.

import type { Deal } from "@/app/api/deals/route";
import type { PaymentRow, ManualProofRow } from "@/lib/payments/db";
import { listPaymentsForDeal, listPendingManualProofs } from "@/lib/payments/db";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────

export type Severity = "blocker" | "warning";

export interface VerifyCtx {
    paymentRows: PaymentRow[];
    pendingProofs: ManualProofRow[];
    openRaisedIssues: { id: string; phase: number | null }[];
    nowMs: number;
    // Extension points for future rules
    extras?: Record<string, unknown>;
}

export interface CheckResult {
    passed: boolean;
    evidence: string;
    data?: unknown;
}

export interface CheckRule {
    id: string;
    description: string;
    severity: Severity;
    check: (deal: Deal, ctx: VerifyCtx) => CheckResult | Promise<CheckResult>;
}

export interface Checklist {
    id: string;                          // stable identifier — used as URL slug
    targetAction: string;                // which transition this gates
    description: string;
    rules: CheckRule[];
}

export interface RuleRunResult {
    ruleId: string;
    description: string;
    severity: Severity;
    passed: boolean;
    evidence: string;
    data?: unknown;
}

export interface VerifyOutcome {
    checklistId: string;
    targetAction: string;
    passed: boolean;                     // true only if all blockers passed
    results: RuleRunResult[];
    blockedBy: string | null;            // first failed blocker id (or null)
    warnings: RuleRunResult[];           // any warnings (passed or not, all collected)
    ranAtMs: number;
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function buildVerifyCtx(deal: Deal): Promise<VerifyCtx> {
    const [payments, proofs, issues] = await Promise.all([
        safeListPayments(deal.token),
        safeListProofs(),
        safeListOpenIssues(deal.token),
    ]);
    return {
        paymentRows: payments,
        pendingProofs: proofs.filter(p => p.deal_token === deal.token),
        openRaisedIssues: issues,
        nowMs: Date.now(),
    };
}

export async function runChecklist(
    checklist: Checklist,
    deal: Deal,
    ctx: VerifyCtx,
): Promise<VerifyOutcome> {
    const results: RuleRunResult[] = [];
    let blockedBy: string | null = null;

    for (const rule of checklist.rules) {
        let result: CheckResult;
        try {
            result = await rule.check(deal, ctx);
        } catch (e) {
            result = { passed: false, evidence: `Rule threw: ${String((e as Error)?.message || e)}` };
        }
        const run: RuleRunResult = {
            ruleId: rule.id,
            description: rule.description,
            severity: rule.severity,
            passed: result.passed,
            evidence: result.evidence,
            data: result.data,
        };
        results.push(run);

        if (rule.severity === "blocker" && !result.passed) {
            blockedBy = rule.id;
            break;          // short-circuit
        }
    }

    return {
        checklistId: checklist.id,
        targetAction: checklist.targetAction,
        passed: blockedBy === null,
        results,
        blockedBy,
        warnings: results.filter(r => r.severity === "warning"),
        ranAtMs: Date.now(),
    };
}

// ─── Internals ────────────────────────────────────────────────────────────

async function safeListPayments(token: string): Promise<PaymentRow[]> {
    try { return await listPaymentsForDeal(token); }
    catch { return []; }
}
async function safeListProofs(): Promise<ManualProofRow[]> {
    try { return await listPendingManualProofs(); }
    catch { return []; }
}
async function safeListOpenIssues(token: string): Promise<{ id: string; phase: number | null }[]> {
    try {
        const db = supabase.schema("synapsis" as any);
        const { data } = await db
            .from("raised_items")
            .select("id, phase")
            .eq("deal_token", token)
            .eq("kind", "issue")
            .eq("status", "open");
        return (data || []).map(r => ({ id: r.id as string, phase: (r.phase as number | null) ?? null }));
    } catch { return []; }
}

// ─── Helper: format outcome for audit/log/chat ────────────────────────────

export function formatOutcomeShort(o: VerifyOutcome): string {
    if (o.passed) return `✅ ${o.checklistId} passed (${o.results.length} rules)`;
    const blocker = o.results.find(r => r.ruleId === o.blockedBy);
    return `❌ ${o.checklistId} blocked by ${o.blockedBy}: ${blocker?.evidence || "(no evidence)"}`;
}
