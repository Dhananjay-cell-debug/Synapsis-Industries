# Synapsis International Payments Handoff

Date: 2026-05-12
Owner: Synapsis Industries
Purpose: give Claude a verified, phase-wise brief for completing the existing Razorpay international payment infrastructure without inventing a new payment architecture.

## Read Order

1. `01_CURRENT_STATE_AUDIT.md`
2. `02_TARGET_ARCHITECTURE.md`
3. `03_PHASED_ROADMAP.md`
4. `04_TEST_MATRIX.md`
5. `05_RISKS_UNKNOWNS.md`
6. `06_CLAUDE_PROMPTS.md`
7. `08_PAYPAL_FUTURE_THREAD.md` (future planning only; do not implement during Razorpay stabilization)

## Non-Negotiables

- Keep both client paths available:
  - Indian/domestic clients: Razorpay INR domestic checkout and manual NEFT where already supported.
  - International clients: Razorpay international checkout, starting with USD.
- Do not replace the existing Synapsis payment system with a new unrelated design.
- Do not assume all currencies are ready. The code currently supports only `INR` and `USD`.
- Do not silently convert INR quotes to USD. `deal.totalPrice` is currently interpreted as the major unit of the selected deal currency.
- Do not assume settlement currency from code. Razorpay settlement depends on account/product configuration and must be verified in Dashboard/settlements.
- Do not treat the Dashboard `Transaction Size Enabled: INR 50,000` as a customer transaction. It is an account-level per-transaction limit shown by Razorpay.
- Do not implement PayPal during the Razorpay stabilization pass. Keep it as a future optional international fallback thread.

## Current Verified Summary

The repo already has a partial dual-path system:

- Razorpay order creation can create either `INR` or `USD` orders.
- Razorpay verify/webhook flows are provider-aware and currency-aware enough for INR/USD.
- Payment rows support `currency`, `provider`, `amount_minor`, and `minor_per_major`.
- Invoices and email notifications format INR/USD.
- Stripe code also exists, but the current objective is Razorpay international, not Stripe.

The largest known gap is UI coverage. The main `PaymentGate` passes currency/provider data, but phase-specific client tabs still call `RazorpayCheckout` directly without passing `currency`, `acceptInternationalCards`, or `clientCountry`, so international deals can fall back to INR in those tabs.

## Future Thread

PayPal is intentionally tracked in `08_PAYPAL_FUTURE_THREAD.md`. After Razorpay domestic/international work is complete and verified, revisit that file so PayPal does not get forgotten. Treat PayPal as an optional international fallback, not as the current foundation.

## Official Razorpay References

- International payments overview: https://razorpay.com/docs/payments/international-payments/?preferred-country=IN
- Local payment methods: https://razorpay.com/docs/payments/international-payments/local-payment-methods/?preferred-country=IN
- Local currency bank accounts and settlement notes: https://razorpay.com/docs/payments/international-payments/accept-international-payments-via-local-currency-bank-accounts/
- Transaction limits: https://razorpay.com/docs/payments/dashboard/account-settings/transaction-limits//?preferred-country=IN
