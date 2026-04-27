// ─── RAZORPAY SERVER CLIENT ─────────────────────────────────────────────────
// Singleton server-side Razorpay SDK instance. Only imported inside API routes
// (never in client components — key secret must NEVER ship to browser).

import Razorpay from "razorpay";
import crypto from "crypto";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
    // In dev we allow missing keys so `next build` doesn't crash on unconfigured envs.
    // Any route that actually calls `razorpay.orders.create` will throw at runtime.
    console.warn("[razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET — payment routes will fail until set in .env.local");
}

export const razorpay = new Razorpay({
    key_id: keyId || "rzp_test_placeholder",
    key_secret: keySecret || "placeholder",
});

// ─── Signature helpers ──────────────────────────────────────────────────────

/**
 * Verify the signature Razorpay returns in the checkout success callback.
 * https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/#7-verify-signature
 */
export function verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
}): boolean {
    const { orderId, paymentId, signature } = params;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");
    return timingSafeEqual(expected, signature);
}

/**
 * Verify the signature on a Razorpay webhook POST.
 * https://razorpay.com/docs/webhooks/validate-test/
 */
export function verifyWebhookSignature(params: {
    rawBody: string;
    signature: string;
}): boolean {
    const { rawBody, signature } = params;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
    return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

// ─── Amount helpers ─────────────────────────────────────────────────────────
// Razorpay expects amount in the smallest currency unit (paise for INR).
// 1 INR = 100 paise. Always Math.round to avoid float drift.

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);
export const paiseToRupees = (paise: number): number => Math.round(paise) / 100;
