// ─── STRIPE CHECKOUT SESSION CREATION (foreign clients, USD) ───────────────
// Mirror of /api/razorpay/order — same bulletproofing rules.
//   1. Look up deal (JSON file source of truth)
//   2. Server-side recompute amount from totalPrice × percentage (NEVER trust client)
//   3. Idempotent: reuse existing pending Stripe session if present
//   4. Create Stripe Checkout Session (multi-method: cards, ACH, SEPA, wallets, link)
//   5. Upsert pending payment row in Supabase (provider='stripe', currency='USD')
//   6. Log a platform_transactions event
//   7. Return checkout URL + sessionId to client
//
// POST body: { token: string, paymentPhase: 3 | 4 | 6 }

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, isStripeConfigured, dollarsToCents, stripeIdempotencyKey } from "@/lib/stripe";
import { PAYMENT_SPLIT, paymentAmountFor } from "@/lib/phases/constants";
import { getDeal } from "@/lib/deals/store";
import {
    upsertPendingPayment,
    getPaymentForPhase,
    recordTransaction,
} from "@/lib/payments/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    if (!isStripeConfigured()) {
        return NextResponse.json(
            { error: "Stripe not configured (foreign-client flow disabled)" },
            { status: 503 }
        );
    }

    try {
        const { token, paymentPhase } = await req.json();
        const phase = Number(paymentPhase) as 3 | 4 | 6;

        if (!token || !phase) {
            return NextResponse.json({ error: "Missing token or paymentPhase" }, { status: 400 });
        }
        const cfg = PAYMENT_SPLIT[phase];
        if (!cfg) {
            return NextResponse.json({ error: "Invalid paymentPhase — must be 3, 4, or 6" }, { status: 400 });
        }

        // ─── Load deal ─────────────────────────────────────────────────────
        const deal = await getDeal(token);
        if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

        if (!deal.totalPrice || deal.totalPrice <= 0) {
            return NextResponse.json(
                { error: "Project total not set yet — awaiting Blueprint approval" },
                { status: 400 }
            );
        }

        // ─── Server-side amount recompute (NEVER trust client) ─────────────
        // For Stripe path, deal.totalPrice is interpreted in USD (foreign deal).
        const amountDollars = paymentAmountFor(deal.totalPrice, phase);
        const amountCents = dollarsToCents(amountDollars);

        // ─── Idempotency check ─────────────────────────────────────────────
        const existing = await getPaymentForPhase(token, phase);
        if (existing?.status === "paid") {
            return NextResponse.json({ error: "This payment is already complete" }, { status: 400 });
        }
        if (existing?.status === "pending_admin_verify") {
            return NextResponse.json({
                error: "A manual payment is currently pending admin verification for this phase",
            }, { status: 400 });
        }

        const stripe = getStripe();
        const baseUrl = process.env.NEXTAUTH_URL || "https://synapsis-industries.vercel.app";
        const receipt = `deal_${token}_p${phase}_stripe`;

        // ─── Reuse or create Stripe session ────────────────────────────────
        let session: Stripe.Checkout.Session | null = null;

        if (existing?.status === "pending" && existing.stripe_session_id) {
            try {
                const fetched = await stripe.checkout.sessions.retrieve(existing.stripe_session_id);
                // Reuse only if still open + matches amount
                if (fetched.status === "open" && fetched.amount_total === amountCents) {
                    session = fetched;
                }
            } catch {
                // Fall through to create fresh
            }
        }

        if (!session) {
            session = await stripe.checkout.sessions.create({
                mode: "payment",
                // Multi-method: cards (global) + Apple/Google/Link wallets + ACH (US) + SEPA (EU).
                // Stripe auto-filters by buyer location; unsupported methods just hide.
                payment_method_types: [
                    "card",
                    "link",
                    "us_bank_account",       // ACH Direct Debit
                    "sepa_debit",            // SEPA (EU)
                    "cashapp",
                ],
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: `Synapsis Industries — ${cfg.label}`,
                                description: `${cfg.percentage}% of project total ($${deal.totalPrice.toLocaleString("en-US")} USD) · ${deal.name} · ${deal.company}`,
                            },
                            unit_amount: amountCents,
                        },
                        quantity: 1,
                    },
                ],
                customer_email: undefined,    // V2: pull from questionnaire
                client_reference_id: `${token}_p${phase}`,
                metadata: {
                    token,
                    paymentPhase: String(phase),
                    percentage: String(cfg.percentage),
                    clientName: deal.name,
                    company: deal.company,
                    phaseLabel: cfg.label,
                    totalPriceUSD: String(deal.totalPrice),
                },
                payment_intent_data: {
                    description: `Synapsis Industries — ${cfg.label} (${cfg.percentage}%) — Deal ${token}`,
                    metadata: {
                        token,
                        paymentPhase: String(phase),
                    },
                    statement_descriptor_suffix: "SYNAPSIS",
                },
                allow_promotion_codes: false,
                billing_address_collection: "required",
                automatic_tax: { enabled: false },
                success_url: `${baseUrl}/client/${token}?payment=success&phase=${phase}&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url:  `${baseUrl}/client/${token}?payment=cancelled&provider=stripe`,
                expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 23,    // 23h (Stripe max ~24h)
            }, {
                idempotencyKey: stripeIdempotencyKey(token, phase, "checkout-v1"),
            });
        }

        // ─── Upsert pending payment row in Supabase ────────────────────────
        const paymentRow = await upsertPendingPayment({
            dealToken: token,
            phase,
            totalPriceMajor: deal.totalPrice,
            currency: "USD",
            provider: "stripe",
            stripeSessionId: session.id,
            receipt,
            method: "stripe",
        });

        // ─── Audit log ─────────────────────────────────────────────────────
        await recordTransaction({
            dealToken: token,
            paymentId: paymentRow.id,
            type: "payment.stripe.session.created",
            source: "system",
            provider: "stripe",
            amountPaise: amountCents,            // generic minor-unit
            stripeSessionId: session.id,
            metadata: {
                phase,
                percentage: cfg.percentage,
                totalPriceUSD: deal.totalPrice,
                currency: "USD",
            },
        });

        return NextResponse.json({
            url: session.url,
            sessionId: session.id,
            amountCents,
            amountDollars,
            currency: "USD",
            phaseLabel: cfg.label,
            percentage: cfg.percentage,
            clientName: deal.name,
            paymentRowId: paymentRow.id,
        });
    } catch (err) {
        console.error("[stripe/checkout] error:", err);
        const msg = err instanceof Error ? err.message : "Failed to create Stripe checkout session";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
