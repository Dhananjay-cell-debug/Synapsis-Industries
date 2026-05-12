// ─── PAYMENT CURRENCY RESOLUTION ──────────────────────────────────────────
// Single source of truth for deciding which Razorpay charge currency a deal
// should use. Server (order route) and client (PaymentGate) must agree.
//
// Rules (in order):
//   1. Explicit USD quote currency on the deal -> USD
//   2. International cards not accepted -> INR (conservative)
//   3. Missing clientCountry -> INR (conservative; admin must set country before international path)
//   4. clientCountry is IN/INDIA -> INR
//   5. Otherwise -> USD
//
// This conservative default protects domestic INR flows. USD only fires on
// explicit configuration: USD quote currency, OR (international flag + non-IN country).

export type PaymentChargeCurrency = "INR" | "USD";

export interface ResolveRazorpayCurrencyInput {
    currency?: PaymentChargeCurrency;
    acceptInternationalCards?: boolean;
    clientCountry?: string;
}

export function resolveRazorpayCurrency(params: ResolveRazorpayCurrencyInput): PaymentChargeCurrency {
    if (params.currency === "USD") return "USD";
    if (!params.acceptInternationalCards) return "INR";

    const country = (params.clientCountry || "").trim().toUpperCase();
    if (!country) return "INR";

    return country === "IN" || country === "INDIA" ? "INR" : "USD";
}
