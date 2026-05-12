# PayPal Future Thread

Status: future planning only. Do not implement during the Razorpay international stabilization pass.

## Why This Exists

Synapsis may later add PayPal as an optional international payment method after Razorpay domestic and Razorpay international card flows are stable.

This file exists so the PayPal work is not forgotten after the Razorpay phases finish.

## Strategic Position

PayPal should be treated as an optional international fallback, not the primary Synapsis payment foundation.

Primary path:

- Indian clients: Razorpay domestic INR.
- International clients: Razorpay international cards, starting with USD.

Future optional path:

- International clients who prefer PayPal or whose cards fail can use PayPal if the business, KYC, settlement, refund, and reconciliation model is approved.

## Do Not Do Yet

- Do not add PayPal provider code during the Razorpay stabilization work.
- Do not add PayPal UI before the core international Razorpay path is proven.
- Do not select the PayPal legal account type casually.
- Do not assume PayPal settlement behaves like Razorpay bank settlement.
- Do not add direct PayPal APIs unless Razorpay-hosted PayPal is proven insufficient.

## Decision Required Before PayPal Work

Before implementation, Synapsis must decide:

- Is PayPal account type `Individual seller / Sole Proprietorship` or `Company` based on actual legal/KYC structure?
- Are we using PayPal through Razorpay Checkout, or direct PayPal integration?
- Which countries/currencies are worth supporting?
- Where does PayPal money settle: PayPal wallet, bank account, or Razorpay-managed flow?
- Who reconciles PayPal wallet transactions, fees, refunds, and disputes?
- What invoice wording and export/compliance docs are required?

## Recommended Architecture Later

Do not build a separate payment system.

Extend the existing provider model:

```text
PaymentGate
  -> Razorpay domestic INR
  -> Razorpay international USD cards
  -> future PayPal optional rail
       -> verify/webhook
       -> payment row
       -> invoice
       -> phase transition
       -> reconciliation
```

Possible provider values later:

- `razorpay`
- `stripe`
- `manual`
- `paypal`
- or `razorpay_paypal` if PayPal is used only inside Razorpay Checkout

Choose this only after confirming the actual integration path.

## Data Model Notes

Future fields may be needed:

- `paymentProvider`
- `paymentRail`
- `paypalOrderId`
- `paypalCaptureId`
- `paypalPayerId`
- `paypalSettlementCurrency`
- `paypalFeeMinor`
- `paypalRefundId`
- `paypalDisputeId`
- `settlementStatus`

Do not add these fields until the exact PayPal integration path is chosen.

## Trigger Conditions

Start PayPal planning only after:

- Phase tabs route international payments correctly.
- Pending payment rows cannot reuse stale currency/amount data.
- Admin can intentionally configure domestic vs international deal payment profile.
- Razorpay USD live/test flow has been verified end-to-end.
- Reconciliation checklist exists for Razorpay transactions.

PayPal becomes worth doing when:

- International card failures are noticeable.
- US/EU clients ask for PayPal.
- Synapsis wants a buyer-trust fallback for foreign clients.
- The accounting process can handle PayPal wallet settlement, fees, refunds, and disputes.

## First Future PayPal Prompt

```text
Razorpay domestic and international card flows are now stable. Read docs/payments/claude-handoff/08_PAYPAL_FUTURE_THREAD.md.

Do not implement yet.

Create a PayPal feasibility audit for Synapsis:
- whether PayPal should be added through Razorpay Checkout or direct PayPal APIs
- account/KYC decisions needed
- settlement/refund/reconciliation implications
- required schema changes
- required UI changes
- safest implementation order
- what should remain out of scope

Return a plan only, with file references where the current payment system would be extended.
```

