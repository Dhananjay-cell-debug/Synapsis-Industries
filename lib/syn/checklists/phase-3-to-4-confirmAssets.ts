// ─── PHASE 3 → 4: confirmAssets ────────────────────────────────────────────
// Auto-fires when: advance payment captured + all required assets submitted +
// no open issues + kill-switch off + payment cooldown elapsed.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, ruleNoOpenIssue, rulePhaseEquals } from "./common";
import { paymentAmountFor } from "@/lib/phases/constants";

export const phase3to4_confirmAssets: Checklist = {
    id: "phase-3-to-4-confirmAssets",
    targetAction: "confirmAssets",
    description: "Advance phase 3 → 4 by confirming asset submission, only when payment + assets are verified.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(3),
        ruleNoOpenIssue(3),
        {
            id: "advance.payment.captured",
            description: "Phase 3 advance payment row exists with status=paid AND has webhook OR admin-verified confirmation",
            severity: "blocker",
            check: (deal, ctx) => {
                const row = ctx.paymentRows.find(p => p.phase === 3 && p.status === "paid");
                if (!row) return { passed: false, evidence: "No paid payment row found for phase 3" };
                const isWebhook = row.razorpay_payment_id?.startsWith("pay_") || row.stripe_session_id?.startsWith("cs_");
                const isManualVerified = !!(row.razorpay_payment_id?.startsWith("neft_"));
                return {
                    passed: !!(isWebhook || isManualVerified),
                    evidence: isWebhook ? "Webhook-confirmed gateway payment" :
                              isManualVerified ? "Admin-verified manual NEFT payment" :
                              "Payment paid but no confirmation source",
                    data: { paymentId: row.id },
                };
            },
        },
        {
            id: "advance.amount.matches.blueprint",
            description: "Captured amount equals or exceeds the blueprint's phase-3 expected amount",
            severity: "blocker",
            check: (deal, ctx) => {
                if (!deal.totalPrice) return { passed: false, evidence: "No totalPrice on deal — blueprint not approved?" };
                const expected = paymentAmountFor(deal.totalPrice, 3);
                const captured = ctx.paymentRows
                    .filter(p => p.phase === 3 && p.status === "paid")
                    .reduce((s, p) => s + (p.amount_minor ?? p.amount_paise), 0) / 100;
                return {
                    passed: captured >= expected,
                    evidence: `Expected ${expected}, captured ${captured}`,
                    data: { expected, captured },
                };
            },
        },
        {
            id: "assets.all.required.submitted",
            description: "Every required asset in phase3.assetChecklist has been submitted",
            severity: "blocker",
            check: (deal) => {
                const checklist = deal.phaseData?.phase3?.assetChecklist || [];
                const required = checklist.filter(c => c.required);
                if (required.length === 0) {
                    return { passed: true, evidence: "No required assets — checklist empty, admin set no requirements" };
                }
                const missing = required.filter(c => !c.submitted);
                return {
                    passed: missing.length === 0,
                    evidence: missing.length === 0 ? `All ${required.length} required assets submitted` : `Missing: ${missing.map(m => m.label).join(", ")}`,
                    data: { required: required.length, submitted: required.length - missing.length, missingIds: missing.map(m => m.id) },
                };
            },
        },
        {
            id: "no.pending.manual_proof",
            description: "No pending manual NEFT proof awaiting admin verification for phase 3",
            severity: "blocker",
            check: (_, ctx) => {
                const pending = ctx.pendingProofs.filter(p => p.phase === 3);
                return {
                    passed: pending.length === 0,
                    evidence: pending.length === 0 ? "No pending proofs" : `${pending.length} pending proof(s) — admin must verify before Syn confirms assets`,
                };
            },
        },
        {
            id: "payment.cooldown.elapsed",
            description: "≥30 min since payment captured (chargeback/dispute window)",
            severity: "warning",
            check: (_, ctx) => {
                const row = ctx.paymentRows.find(p => p.phase === 3 && p.status === "paid");
                if (!row?.paid_at) return { passed: true, evidence: "No paid_at timestamp" };
                const elapsedMs = ctx.nowMs - new Date(row.paid_at).getTime();
                const minutes = Math.round(elapsedMs / 60000);
                return {
                    passed: elapsedMs >= 30 * 60 * 1000,
                    evidence: `${minutes} min since payment capture`,
                };
            },
        },
    ],
};
