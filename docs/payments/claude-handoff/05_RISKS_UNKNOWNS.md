# Risks And Unknowns

## High-Risk Implementation Issues

### Phase Tabs Bypass `PaymentGate`

Risk:

- International deals can accidentally open INR Razorpay checkout from Phase 3, 4, or 6 tabs.

Fix priority:

- Highest.

### Existing Pending Row Can Become Stale

Risk:

- If admin changes a deal from INR to USD after a pending payment exists, `upsertPendingPayment` may keep old amount/currency fields while only updating order id/receipt.

Fix priority:

- High before real-money testing.

### `deal.totalPrice` Has Ambiguous Currency Meaning

Risk:

- Same numeric field means rupees for INR deals and dollars for USD deals.
- Admin could accidentally enter an INR amount while marking currency USD.

Fix priority:

- High. Add admin warnings and labels immediately.

### Admin UI May Not Expose Payment Profile

Risk:

- Backend fields exist, but without reliable admin UI, international deal configuration can become manual/database-only and error-prone.

Fix priority:

- High.

### Stale Payment Documentation

Risk:

- `PAYMENT_INFRASTRUCTURE.md` says INR-locked, which conflicts with current code.

Fix priority:

- Medium. Update after implementation stabilizes.

## Razorpay Account Unknowns

Need verify in Razorpay Dashboard or support:

- Are only international cards active, or are ACH/SEPA/CHAPS/SWIFT active too?
- Are Trustly, Giropay, Sofort active, requested, or unavailable?
- What is the effective international per-transaction limit?
- What currencies are active for this exact merchant account?
- What settlement currency applies for:
  - international cards
  - local payment methods
  - local currency bank transfers
  - SWIFT/international bank transfer
- What compliance documents are required for Synapsis services invoices?

## Compliance And Accounting Unknowns

Need owner/accountant confirmation:

- Correct purpose code for Synapsis services/export.
- Whether FIRS/FIRC is generated automatically for the chosen method.
- Whether non-INR settlement is available or settlement is INR-only.
- How GST/export invoicing should be represented.
- Refund/chargeback handling policy for international cards.

## Product Scope Boundary

Confirmed now:

- Make existing Razorpay international card path work correctly for Synapsis.

Not confirmed now:

- Full local bank transfer automation.
- ACH/SEPA/CHAPS/SWIFT in custom checkout.
- Supporting every currency globally.
- Building a live FX conversion engine.

## Recommended Guardrails

- Do not enable international path without explicit admin choice.
- Do not allow USD payment if deal amount label is ambiguous.
- Do not create live orders above active Razorpay transaction limit.
- Do not support non-USD currencies until minor-unit and DB constraints are updated.
- Do not trust client-provided amounts. Continue server recomputation.

