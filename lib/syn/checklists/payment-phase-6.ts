// ─── PRECONDITIONS: PHASE 6 FINAL PAYMENT ──────────────────────────────────
// Same shape as payment-phase-3 but for final payment.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, rulePhaseEquals } from "./common";
import { paymentAmountFor } from "@/lib/phases/constants";

export const paymentPhase6: Checklist = {
    id: "payment-phase-6",
    targetAction: "t6_finalPaid",
    description: "Verify preconditions for capturing the phase-6 final payment.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(6),
        {
            id: "blueprint.totalPrice",
            description: "Deal has a total price (blueprint was approved)",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.totalPrice && deal.totalPrice > 0,
                evidence: deal.totalPrice ? `totalPrice=${deal.totalPrice}` : "missing",
            }),
        },
        {
            id: "amount.matches",
            description: "Captured amount >= expected phase-6 amount",
            severity: "blocker",
            check: (deal, ctx) => {
                const expected = paymentAmountFor(deal.totalPrice || 0, 6);
                const captured = ctx.paymentRows
                    .filter(p => p.phase === 6 && p.status === "paid")
                    .reduce((s, p) => s + (p.amount_minor ?? p.amount_paise), 0) / 100;
                return {
                    passed: captured >= expected,
                    evidence: `expected=${expected}, captured=${captured}`,
                };
            },
        },
    ],
};
