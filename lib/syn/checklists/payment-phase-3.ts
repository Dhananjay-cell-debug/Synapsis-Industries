// ─── PRECONDITIONS: PHASE 3 ADVANCE PAYMENT ────────────────────────────────
// Run by Syn co-pilot on Razorpay/Stripe webhook arrival. Confirms it is safe
// to fire t3_advancePaid. The webhook itself already fires the transition;
// Syn's role here is to verify the captured amount/currency matches what was
// scoped, and that no anomalous state exists.

import type { Checklist } from "../verification";
import { ruleDealExists, ruleKillSwitchOff, rulePhaseEquals } from "./common";
import { paymentAmountFor } from "@/lib/phases/constants";

export const paymentPhase3: Checklist = {
    id: "payment-phase-3",
    targetAction: "t3_advancePaid",
    description: "Verify preconditions for capturing the phase-3 advance payment via Syn.",
    rules: [
        ruleDealExists,
        ruleKillSwitchOff,
        rulePhaseEquals(3),
        {
            id: "blueprint.approved",
            description: "Blueprint is approved (totalPrice set)",
            severity: "blocker",
            check: (deal) => ({
                passed: !!deal.totalPrice && deal.totalPrice > 0,
                evidence: deal.totalPrice ? `totalPrice=₹${deal.totalPrice}` : "totalPrice unset — blueprint not approved",
            }),
        },
        {
            id: "amount.matches",
            description: "Captured amount >= expected phase-3 amount from blueprint",
            severity: "blocker",
            check: (deal, ctx) => {
                const expected = paymentAmountFor(deal.totalPrice || 0, 3);
                const captured = ctx.paymentRows
                    .filter(p => p.phase === 3 && p.status === "paid")
                    .reduce((s, p) => s + (p.amount_minor ?? p.amount_paise), 0) / 100;
                return {
                    passed: captured >= expected,
                    evidence: `expected=${expected}, captured=${captured}`,
                    data: { expected, captured },
                };
            },
        },
    ],
};
