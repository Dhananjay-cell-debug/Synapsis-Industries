# Current State Audit

This audit is based on local code inspection on 2026-05-12.

## Confirmed Razorpay Account State From User Screenshot

- International card payments request is successful.
- Payment Gateway international card payments are active.
- Payment Pages, Payment Links, and Invoices international card payments are active.
- Dashboard shows `Transaction Size Enabled: INR 50,000` for both Payment Gateway and Payment Pages/Links/Invoices.
- This INR 50,000 is an account/product transaction limit, not a transaction currently running in Synapsis.
- Screenshot confirms cards. It does not prove ACH, SEPA, CHAPS, SWIFT, Trustly, Giropay, Sofort are active.

## Code Paths That Already Exist

### Razorpay Order Creation

File: `app/api/razorpay/order/route.ts`

- Creates Razorpay orders through the existing Razorpay SDK client.
- Rejects deals configured as `paymentProvider === "stripe"`.
- Resolves Razorpay currency:
  - explicit `deal.currency === "USD"` -> `USD`
  - `acceptInternationalCards` false -> `INR`
  - no `clientCountry` -> `INR`
  - `clientCountry` is `IN` or `INDIA` -> `INR`
  - otherwise -> `USD`
- Computes amount from `paymentAmountFor(deal.totalPrice, phase)`.
- Sends Razorpay `amount` in minor units using `amountMajor * 100`.
- Stores pending payment row with `currency`, `provider: "razorpay"`, `method: "razorpay"`.

Critical interpretation:

- For USD deals, `deal.totalPrice` is treated as dollars.
- For INR deals, `deal.totalPrice` is treated as rupees.
- There is no INR-to-USD conversion engine.

### Payment Gate

File: `components/ui/PaymentGate.tsx`

- Accepts `paymentProvider`, `currency`, `acceptInternationalCards`, and `clientCountry`.
- Routes `paymentProvider === "stripe"` to `StripeCheckout`.
- Routes Razorpay deals to `RazorpayCheckout`.
- Resolves domestic/international Razorpay currency with the same duplicated logic as the order route.

### Razorpay Checkout Component

File: `components/ui/RazorpayCheckout.tsx`

- Accepts `currency?: "INR" | "USD"`.
- Shows USD formatting and international copy when `currency === "USD"`.
- Calls `/api/razorpay/order`.
- Opens Razorpay Checkout with the returned `currency`.
- Calls `/api/razorpay/verify`.
- Hides domestic NEFT UI for international/USD payments.

### Verify Route

File: `app/api/razorpay/verify/route.ts`

- Verifies Razorpay checkout callback HMAC.
- Finds the pending payment by `razorpay_order_id`.
- Recomputes expected amount from `deal.totalPrice` and phase.
- Compares expected minor amount against the stored payment row.
- Marks payment paid, records transaction, runs phase transition, updates legacy deal payment state, and queues invoice generation.

Important limitation:

- The verification path validates minor units for the deal currency but does not verify FX conversion or settlement currency.

### Webhook Route

File: `app/api/razorpay/webhook/route.ts`

- Verifies webhook signature.
- Resolves the payment row from Razorpay order/payment ids.
- Marks payment paid idempotently.
- Runs phase transition, invoice generation, and notification paths.

### Payment Storage

File: `lib/payments/db.ts`

- Types support:
  - `PaymentCurrency = "INR" | "USD"`
  - `PaymentProvider = "razorpay" | "stripe" | "manual"`
- Payment rows include:
  - legacy `amount_paise`
  - canonical `amount_minor`
  - `minor_per_major`
  - `currency`
  - `provider`
  - Razorpay/Stripe ids
- Existing pending rows are reused idempotently.

Important gap:

- If an existing pending row is reused, the update path refreshes provider-specific ids and receipt, but does not update `currency`, `provider`, `amount_minor`, `minor_per_major`, or `amount_paise`.
- If a deal changes from INR to USD after a pending row exists, stale payment rows can survive unless explicitly handled.

### Invoices And Email

Files:

- `lib/invoice/generate.ts`
- `lib/email/payment-notifications.ts`

Current behavior:

- INR/USD formatting exists.
- Razorpay USD is labelled as international.
- Stripe USD is also labelled as international.

Known limits:

- Only INR/USD are supported.
- No FX snapshot fields exist.
- No settlement amount/currency fields exist.
- Invoice table migration adds a `currency` column, but `createInvoice` currently relies mainly on metadata/defaults.

### Deal Model And Storage

Files:

- `app/api/deals/route.ts`
- `lib/phases/dealStore.ts`

Deal fields already exist:

- `currency?: "INR" | "USD"`
- `paymentProvider?: "razorpay" | "stripe"`
- `acceptInternationalCards?: boolean`
- `clientCountry?: string`

These are mapped between Supabase snake_case and app camelCase.

## Biggest Confirmed Gap

The phase-specific client tabs bypass `PaymentGate`:

- `components/phases/IgnitionView.tsx`
- `components/phases/BuildView.tsx`
- `components/phases/HandoverView.tsx`

They call `RazorpayCheckout` directly and do not pass:

- `currency`
- `acceptInternationalCards`
- `clientCountry`
- `paymentProvider`

Impact:

- Phase 3 advance, Phase 4 milestone, and Phase 6 final payment can default to INR even when the deal should be USD international.
- This is the top implementation fix before real-money international testing.

## Admin Configuration Gap

The backend supports deal fields for currency/country/provider, but code search did not confirm a complete admin UI for setting these fields during blueprint/deal setup.

Required admin capability:

- Mark client as Indian or international.
- Select quote currency.
- Select payment provider/path.
- Enable Razorpay international cards for the deal.
- Persist these values before the first payment order is created.

## Stale Documentation

`PAYMENT_INFRASTRUCTURE.md` is stale. It still describes the system as INR-locked and does not reflect the current INR/USD Razorpay/Stripe-aware code.

