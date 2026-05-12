# Claude Phase Prompts

Use these prompts one at a time. Do not give Claude every phase as an implementation command in one shot.

## Prompt 1 - Audit Confirmation

```text
You are working on Synapsis Industries payments. Read docs/payments/claude-handoff/* first.

Task: verify the current payment architecture against the codebase. Do not edit files yet.

Confirm or correct:
- Razorpay order path supports INR/USD.
- PaymentGate supports provider/currency routing.
- Phase tabs bypass PaymentGate.
- Payment rows support INR/USD/provider fields.
- Existing pending row update can preserve stale currency/amount.
- Admin UI coverage for payment profile is incomplete or missing.

Return a concise audit with file paths and exact recommended implementation order.
```

## Prompt 2 - Centralize Currency Routing

```text
Implement Phase 1 from docs/payments/claude-handoff/03_PHASED_ROADMAP.md.

Scope:
- Centralize Razorpay currency/path resolution.
- Replace duplicated logic in app/api/razorpay/order/route.ts and components/ui/PaymentGate.tsx.
- Keep behavior identical unless a bug is clearly documented.
- Add focused tests if the repo has a test setup; otherwise add a small pure helper that can be tested later.

Do not change checkout UI design. Do not add new currencies yet.
```

## Prompt 3 - Fix Phase Tabs

```text
Implement Phase 2 from docs/payments/claude-handoff/03_PHASED_ROADMAP.md.

Scope:
- Update IgnitionView, BuildView, and HandoverView so Phase 3, Phase 4, and Phase 6 payments use the same domestic/international routing as PaymentGate.
- Prefer PaymentGate over direct RazorpayCheckout if it fits cleanly.
- Preserve existing phase behavior and paid-state behavior.
- Do not break Indian INR payments.
- Do not invent a new provider.

Acceptance:
- USD international deal creates USD Razorpay order from each payment phase.
- INR domestic deal still creates INR Razorpay order.
```

## Prompt 4 - Pending Row Safety

```text
Implement Phase 4 from docs/payments/claude-handoff/03_PHASED_ROADMAP.md.

Scope:
- Make upsertPendingPayment safe when a pending row exists but currency/provider/amount changed.
- Prevent reuse of stale INR pending row for USD order and stale USD row for INR order.
- Keep idempotency for same deal/phase/currency/amount.
- Add focused tests or a clear manual verification script.

Do not touch Stripe behavior except where shared payment row safety requires it.
```

## Prompt 5 - Admin Payment Profile

```text
Implement Phase 3 from docs/payments/claude-handoff/03_PHASED_ROADMAP.md.

Scope:
- Add admin UI controls to configure clientCountry, currency, paymentProvider, and acceptInternationalCards for a deal.
- Make labels unambiguous: INR means rupees, USD means dollars.
- Add warning if international path is selected but client country is missing.
- Persist through existing PATCH /api/deals.

Do not add non-USD foreign currencies yet.
```

## Prompt 6 - Verification And Test Pass

```text
Implement Phase 5 from docs/payments/claude-handoff/03_PHASED_ROADMAP.md and execute docs/payments/claude-handoff/04_TEST_MATRIX.md as far as possible locally.

Scope:
- Confirm verify/webhook/invoice/email all preserve USD Razorpay metadata.
- Ensure invoice DB currency is set correctly if the schema supports it.
- Run typecheck.
- Provide a deployment readiness checklist.

Do not run live real-money tests without explicit owner approval.
```

## Prompt 7 - PayPal Future Planning

```text
Razorpay domestic and international card flows are now stable. Read docs/payments/claude-handoff/08_PAYPAL_FUTURE_THREAD.md.

Task: create a PayPal feasibility plan for Synapsis. Do not implement code yet.

Cover:
- whether PayPal should be added through Razorpay Checkout or direct PayPal APIs
- legal/KYC account type decisions
- settlement, refund, dispute, and reconciliation implications
- required schema changes
- required UI changes
- safest implementation order
- what should remain out of scope

Important:
- PayPal should be optional, not the primary payment foundation.
- Do not disturb Razorpay domestic or Razorpay international flows.
- Return a plan with file references to the existing payment architecture.
```
