# Target Architecture

## Business Rule

Synapsis should not force every client into USD.

Professional payment posture:

- Indian client: quote and collect in INR through domestic Razorpay.
- International client: quote in a supported foreign currency through Razorpay international.
- Start with USD. Add other currencies only after schema/UI/test coverage is ready.
- Keep settlement and accounting separate from quote/charge currency.

## Currency Mental Model

There are three different currencies. Do not collapse them into one field.

1. Quote currency
   - The currency Synapsis quotes to the client.
   - Current code uses `deal.currency`.

2. Charge currency
   - The currency sent to Razorpay order creation.
   - Current Razorpay path supports `INR` and `USD`.

3. Settlement currency
   - What lands in the merchant bank account after Razorpay settlement.
   - This must be verified from Razorpay Dashboard/settlement reports.
   - Do not infer it from `deal.currency`.

## Recommended Currency Rollout

Phase 1 production-safe support:

- INR for Indian clients.
- USD for international clients.

Phase 2 shortlist, after USD is stable:

- EUR
- GBP
- CAD
- AUD
- SGD

Keep AED/JPY later unless real client demand appears. JPY is zero-decimal and needs special minor-unit handling.

## Flow Diagram

```text
Admin creates/approves deal
        |
        v
Admin sets payment profile
  - clientCountry
  - currency
  - paymentProvider
  - acceptInternationalCards
        |
        v
Client enters payment phase
        |
        v
PaymentGate decides path
  - Indian + Razorpay -> INR Razorpay order
  - International + Razorpay -> USD Razorpay order
  - Explicit Stripe deal -> Stripe checkout
        |
        v
Gateway callback/webhook
        |
        v
Server verifies signature and amount
        |
        v
Payment row marked paid
        |
        v
Phase transition + invoice + notification
        |
        v
Admin reconciles Razorpay transaction and settlement
```

## Required Domain Model

The current model is close but incomplete.

Current:

```ts
currency: "INR" | "USD"
paymentProvider: "razorpay" | "stripe"
acceptInternationalCards: boolean
clientCountry?: string
```

Recommended next model:

```ts
quoteCurrency: "INR" | "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "SGD"
chargeCurrency: same as quoteCurrency for now
settlementCurrency?: "INR" | "USD" | "EUR" | "GBP" | ...
paymentProvider: "razorpay" | "stripe" | "manual"
paymentRail: "domestic_card_upi_netbanking" | "international_card" | "local_payment_method" | "bank_transfer" | "manual_neft"
clientCountry: ISO country code
fxRate?: number
fxSource?: string
fxCapturedAt?: string
```

Do not add all of this in one risky patch. Add only what the phase needs.

## Razorpay Product Reality

From current evidence:

- International cards are confirmed active.
- Local payment methods require separate activation/request if not already activated.
- International bank transfer/local currency accounts may require additional dashboard activation, purpose code, invoice/address compliance, and settlement checks.
- Razorpay supports many currencies, but the app currently supports only INR/USD.

## Limit Handling

The Dashboard INR 50,000 setting is a per-transaction account/product limit. It affects whether a payment of that size can be accepted. It is not a Synapsis transaction.

Implementation should:

- Warn admin before creating a quote where any phase amount exceeds the active Razorpay limit.
- Keep limit data configurable, not hard-coded permanently.
- For large deals, either split phases within allowed limit or request a Razorpay limit increase with sample invoice.

