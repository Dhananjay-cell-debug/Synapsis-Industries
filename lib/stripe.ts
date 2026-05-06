// ─── STRIPE SERVER CLIENT ───────────────────────────────────────────────────
// Singleton server-side Stripe SDK. Only imported inside API routes
// (never in client components — secret key must NEVER ship to browser).
//
// Bulletproof rules mirror lib/razorpay.ts:
// • Lazy init guarded — STRIPE_SECRET_KEY missing → throws on first call
// • Webhook HMAC uses Stripe SDK (constructEvent) — handles raw body + tolerance
// • All amounts in CENTS (USD smallest unit) on the server
// • Module-level access to env via getter so HMR + Vercel cold-start work

import Stripe from "stripe";
import crypto from "crypto";

declare global {
    // eslint-disable-next-line no-var
    var __synapsisStripe: Stripe | undefined;
}

function getStripeKey(): string | undefined {
    return process.env.STRIPE_SECRET_KEY;
}

/**
 * Lazy-initialized Stripe instance. Throws clearly if STRIPE_SECRET_KEY is unset
 * so foreign-client routes fail loudly rather than silently no-op.
 */
export function getStripe(): Stripe {
    if (globalThis.__synapsisStripe) return globalThis.__synapsisStripe;
    const key = getStripeKey();
    if (!key) {
        throw new Error(
            "[stripe] STRIPE_SECRET_KEY not configured — foreign-client flow disabled. " +
            "Set the env var in .env.local and Vercel production."
        );
    }
    const client = new Stripe(key, {
        // Pin API version for predictable behavior across SDK upgrades
        apiVersion: "2025-09-30.clover" as Stripe.LatestApiVersion,
        typescript: true,
        appInfo: {
            name: "Synapsis Industries Portal",
            url: "https://synapsis-industries.vercel.app",
        },
    });
    if (process.env.NODE_ENV !== "production") {
        globalThis.__synapsisStripe = client;
    }
    return client;
}

// ─── Mode detection ────────────────────────────────────────────────────────
export const isStripeLive = (): boolean => {
    const k = getStripeKey();
    return Boolean(k && k.startsWith("sk_live_"));
};
export const isStripeTest = (): boolean => {
    const k = getStripeKey();
    return Boolean(k && k.startsWith("sk_test_"));
};
export const isStripeConfigured = (): boolean => Boolean(getStripeKey());

// ─── Webhook signature verification ────────────────────────────────────────
/**
 * Verify Stripe webhook signature using the SDK's constructEvent.
 * Pass the RAW body string and the stripe-signature header.
 * Throws if invalid; returns the typed Event if OK.
 */
export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        throw new Error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured");
    }
    return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

// ─── Amount helpers ────────────────────────────────────────────────────────
// Stripe expects amount in the smallest currency unit (cents for USD, paise for INR).
// 1 USD = 100 cents. Always Math.round to avoid float drift.

export const dollarsToCents = (dollars: number): number => Math.round(dollars * 100);
export const centsToDollars = (cents: number): number => Math.round(cents) / 100;
export const formatUSD = (cents: number): string =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Generic minor-unit helpers (for invoices/UI that handle both currencies)
export const minorToMajor = (minor: number, perMajor = 100): number => Math.round(minor) / perMajor;
export const majorToMinor = (major: number, perMajor = 100): number => Math.round(major * perMajor);

// ─── Idempotency key helper ────────────────────────────────────────────────
/**
 * Deterministic idempotency key — same (token, phase) reuses the same key,
 * so a retry of an interrupted request hits the same Stripe session.
 * Includes a salt to allow rotation if needed.
 */
export function stripeIdempotencyKey(token: string, phase: number, salt = "v1"): string {
    return crypto.createHash("sha256").update(`${salt}:${token}:${phase}`).digest("hex").slice(0, 32);
}
