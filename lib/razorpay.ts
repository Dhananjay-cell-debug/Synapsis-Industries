// ─── RAZORPAY SERVER CLIENT ─────────────────────────────────────────────────
// Singleton server-side Razorpay SDK instance. Only imported inside API routes
// (never in client components — key secret must NEVER ship to browser).
//
// Bulletproof rules:
// • All amounts handled in PAISE (integer) on the server. Convert at boundaries only.
// • HMAC verification is timing-safe.
// • Webhook secret validated; in production a placeholder secret throws (handled in route).

import Razorpay from "razorpay";
import crypto from "crypto";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
    console.warn("[razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET — payment routes will fail until set in .env.local");
}

declare global {
    // eslint-disable-next-line no-var
    var __synapsisRazorpay: Razorpay | undefined;
}

export const razorpay: Razorpay =
    globalThis.__synapsisRazorpay ??
    new Razorpay({
        key_id: keyId || "rzp_test_placeholder",
        key_secret: keySecret || "placeholder",
    });

if (process.env.NODE_ENV !== "production") {
    globalThis.__synapsisRazorpay = razorpay;
}

// ─── Mode detection ────────────────────────────────────────────────────────
export const isLiveMode = (): boolean => Boolean(keyId && keyId.startsWith("rzp_live_"));
export const isTestMode = (): boolean => Boolean(keyId && keyId.startsWith("rzp_test_"));

// ─── Signature helpers ─────────────────────────────────────────────────────

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
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
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
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

// ─── Amount helpers ────────────────────────────────────────────────────────
// Razorpay expects amount in the smallest currency unit (paise for INR).
// 1 INR = 100 paise. Always Math.round to avoid float drift.

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);
export const paiseToRupees = (paise: number): number => Math.round(paise) / 100;
export const formatINR = (paise: number): string =>
    `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
