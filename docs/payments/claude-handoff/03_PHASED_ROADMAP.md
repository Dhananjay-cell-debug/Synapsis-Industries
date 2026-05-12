# Phased Roadmap

## Phase 0 - Do Not Break Domestic Payments

Goal: protect current Indian payment flow while international work continues.

Tasks:

- Confirm INR Razorpay order creation still works.
- Confirm manual NEFT remains INR-only.
- Confirm existing paid/pending rows are not mutated incorrectly.
- Add regression tests around INR order creation and verify.

Acceptance:

- Indian deal with default fields creates INR Razorpay order.
- Manual NEFT still submits INR proof.
- Existing payment phase logic still advances correctly.

## Phase 1 - Centralize Currency Resolution

Goal: remove duplicated currency decision logic.

Tasks:

- Create one shared server-safe helper for Razorpay currency/path resolution.
- Use it in `app/api/razorpay/order/route.ts`.
- Use an equivalent or imported client-safe helper in `components/ui/PaymentGate.tsx`.
- Define exact behavior for missing `clientCountry`.

Acceptance:

- Same deal fields always resolve to the same currency on UI and API.
- Missing country defaults conservatively to INR unless `currency === "USD"` is explicit.

## Phase 2 - Fix Phase Tab Payment Bypass

Goal: make real client payment screens use the correct domestic/international path.

Tasks:

- Update `IgnitionView`, `BuildView`, and `HandoverView` deal types to include:
  - `currency`
  - `paymentProvider`
  - `acceptInternationalCards`
  - `clientCountry`
- Prefer replacing direct `RazorpayCheckout` usage with `PaymentGate`.
- If keeping `RazorpayCheckout`, pass resolved props explicitly.
- Keep Stripe behavior intact for explicitly Stripe-configured deals.

Acceptance:

- Phase 3 advance for USD international deal creates USD order.
- Phase 4 milestone for USD international deal creates USD order.
- Phase 6 final payment for USD international deal creates USD order.
- INR deals still create INR orders.

## Phase 3 - Admin Payment Profile UI

Goal: let Synapsis intentionally configure the payment path before the client pays.

Tasks:

- Add admin controls to set:
  - client country
  - quote currency
  - payment provider/path
  - international cards flag
- Add clear admin copy:
  - INR domestic for Indian clients.
  - USD international for foreign clients.
  - Local payment methods/bank transfers only after dashboard activation is confirmed.
- Persist fields through `PATCH /api/deals`.

Acceptance:

- Admin can configure a deal as Indian INR Razorpay.
- Admin can configure a deal as international USD Razorpay.
- Client payment page reflects the selected path.

## Phase 4 - Payment Row Safety

Goal: prevent stale pending rows from causing wrong-currency payments.

Tasks:

- In `upsertPendingPayment`, if a pending row exists but currency/provider/amount has changed, update all canonical fields or create a fresh pending row according to a deliberate rule.
- Add tests for changing a deal from INR to USD before payment.
- Record metadata for quote currency and charge currency.

Acceptance:

- No pending INR row can be reused for a USD order.
- No pending USD row can be reused for an INR order.
- Amount/currency mismatch is caught before checkout opens.

## Phase 5 - Verification And Reconciliation

Goal: make real payment checks reliable.

Tasks:

- Verify order callback and webhook both handle USD Razorpay.
- Confirm invoice currency column is populated correctly, not only metadata.
- Confirm emails show correct currency/method.
- Add a reconciliation checklist for Razorpay Dashboard:
  - payment id
  - order id
  - currency
  - amount
  - method
  - settlement status
  - fees/taxes

Acceptance:

- Synapsis payment row, invoice, email, and Razorpay dashboard all agree on amount and currency.
- Admin has a reliable checklist for confirming foreign payments.

## Phase 6 - Additional Currencies Later

Goal: safely expand beyond USD after USD is production-proven.

Tasks:

- Extend DB constraints from `INR/USD` to selected currencies.
- Add minor-unit map per currency.
- Update UI formatting.
- Update Razorpay order creation to use correct minor units.
- Add tests per currency.

Acceptance:

- EUR/GBP/CAD/AUD/SGD can be quoted and charged without breaking INR/USD.
- Zero-decimal and three-decimal currencies are not added until minor-unit support is correct.

## Phase 7 - PayPal Future Thread

Goal: revisit PayPal as an optional international fallback after Razorpay is stable.

This is planning-only until Phase 0-5 are complete and verified.

Tasks:

- Read `08_PAYPAL_FUTURE_THREAD.md`.
- Decide whether PayPal should be used through Razorpay Checkout or direct PayPal APIs.
- Confirm PayPal account legal/KYC type before onboarding.
- Map settlement, refund, dispute, and reconciliation behavior.
- Plan schema/UI changes without implementing them prematurely.

Acceptance:

- PayPal has a clear feasibility plan.
- The plan explains whether PayPal is worth adding for Synapsis.
- No PayPal implementation starts until Razorpay international is proven end-to-end.
