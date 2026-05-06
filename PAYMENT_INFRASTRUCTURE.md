# Synapsis Payment Infrastructure

> Bulletproof payment system for Synapsis Industries.
> Razorpay (LIVE INR) + Manual NEFT/RTGS fallback. Supabase-backed.
> 30/30/40 milestone split across Phases 3 / 4 / 6.

---

## What's built

### Backend
- `lib/supabase.ts` — service-role server client (synapsis schema)
- `lib/razorpay.ts` — SDK + HMAC + paise math
- `lib/synapsis-config.ts` — business identity, bank details (env-fed)
- `lib/payments/db.ts` — all DB helpers (payments, transactions, invoices, manual proofs)
- `lib/deals/store.ts` — atomic JSON file writes for deal record (per-token in-process locks + tmp+rename)
- `lib/invoice/generate.ts` — PDF rendering (pdf-lib, no native deps)
- `lib/email/payment-notifications.ts` — branded transactional emails

### API routes
- `POST /api/razorpay/order`           → idempotent order creation
- `POST /api/razorpay/verify`          → client callback signature verify (bug fixed)
- `POST /api/razorpay/webhook`         → server-to-server source of truth, returns 200 for non-retryable
- `POST /api/payments/manual/submit`   → client submits NEFT proof
- `GET  /api/admin/payments/manual`    → list pending proofs
- `POST /api/admin/payments/manual/[proofId]/verify` → verify NEFT
- `POST /api/admin/payments/manual/[proofId]/reject` → reject NEFT
- `GET  /api/admin/payments/reconcile` → diff Razorpay ↔ DB
- `POST /api/admin/payments/reconcile` → recover missed webhooks
- `GET  /api/invoices/[invoiceNumber]/pdf` → serve invoice PDF

### Frontend
- `components/ui/RazorpayCheckout.tsx` — tier-aware UI (₹1L UPI cap, NEFT for big amounts)
- `components/ui/ManualPaymentForm.tsx` — NEFT instructions + UTR/proof submission

### Database (Supabase project VELT, schema `synapsis`)
- `synapsis.payments`                  — per-phase payment row, UNIQUE constraints prevent double-pay
- `synapsis.platform_transactions`     — IMMUTABLE audit log (DB triggers block UPDATE/DELETE)
- `synapsis.invoices`                  — sequential gap-aware invoice numbers, PDF blob inline
- `synapsis.manual_payment_proofs`     — NEFT submissions with admin-verify workflow
- Storage bucket `manual-payment-proofs` — private, 10MB cap, image/PDF only
- RPC `synapsis.next_invoice_number()` — atomic sequence-backed numbering

---

## Bulletproof properties (verify before LIVE)

| # | Property | How it's enforced |
|---|---|---|
| 1 | Atomicity | Webhook flow: insert tx → update payment → update deal (atomic per file via tmp+rename) |
| 2 | Idempotency | UNIQUE INDEX on `(deal_token, phase)` for pending+paid. UNIQUE on `razorpay_event_id` |
| 3 | Auditability | `platform_transactions` append-only (trigger blocks mutation). Every event logged with source + actor |
| 4 | Defence-in-depth | Client HMAC + Webhook HMAC + amount cross-check against `deal.totalPrice × percentage` |
| 5 | Graceful degradation | Webhook returns 200 for non-retryable. Reconciliation route catches missed webhooks |
| 6 | Reconciliation | `/api/admin/payments/reconcile` diffs RP orders vs DB, can recover |
| 7 | Money math | All amounts BIGINT paise. `rupeesToPaise` Math.round. Server recomputes, never trusts client |
| 8 | Secret hygiene | `RAZORPAY_KEY_SECRET` server-only. Production guard logs CRITICAL if placeholders detected |
| 9 | Dispute readiness | Sequential invoice numbers, immutable PDFs in DB, audit log |
| 10 | Compliance | "GSTIN: Not Applicable" line on invoice. Udyam + PAN-last4 shown. TDS-receivable column ready |

---

## Setup — what you need to do

### 1. Install new deps

```bash
cd "C:/DHANANJAY/claude code/claude app/portfolio D/VARK PORTFOLIO"
npm install @supabase/supabase-js pdf-lib
```

### 2. Fill `.env.local`

Copy `.env.example` to `.env.local`. Fill these:

**Razorpay (LIVE):**
```
RAZORPAY_KEY_ID=rzp_live_SbqWKkBEjszuEz
RAZORPAY_KEY_SECRET=<paste from Razorpay dashboard>
RAZORPAY_WEBHOOK_SECRET=<set in Razorpay dashboard, paste here>
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_SbqWKkBEjszuEz
```

**Supabase (project VELT, ID `uslmejdctlglropgqzmc`):**
```
SUPABASE_URL=https://uslmejdctlglropgqzmc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Project Settings → API → service_role secret>
NEXT_PUBLIC_SUPABASE_URL=https://uslmejdctlglropgqzmc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase dashboard → anon public>
```

**Synapsis business details (public-safe values for invoice display):**
```
NEXT_PUBLIC_SYNAPSIS_PAN_LAST4=XXXX                 # last 4 of your PAN
NEXT_PUBLIC_SYNAPSIS_UDYAM=UDYAM-XX-XX-XXXXXXX      # full Udyam reg number
NEXT_PUBLIC_SYNAPSIS_BANK_NAME=HDFC Bank            # your savings bank
NEXT_PUBLIC_SYNAPSIS_BANK_BRANCH=Mumbai             # branch
NEXT_PUBLIC_SYNAPSIS_IFSC=HDFC0000123               # IFSC
NEXT_PUBLIC_SYNAPSIS_ACCOUNT_LAST4=XXXX             # last 4 of account
NEXT_PUBLIC_SYNAPSIS_UPI=                           # optional UPI ID
NEXT_PUBLIC_SYNAPSIS_ADDR1=                         # registered address line 1
NEXT_PUBLIC_SYNAPSIS_CITY=Mumbai
NEXT_PUBLIC_SYNAPSIS_STATE=Maharashtra
NEXT_PUBLIC_SYNAPSIS_PIN=400001
```

### 3. Configure Razorpay webhook

In Razorpay Dashboard → Webhooks → Add new webhook:

- **URL:** `https://<your-deployed-domain>/api/razorpay/webhook`
  (For local testing use ngrok tunnel — `ngrok http 3001` then paste URL)
- **Events:** `payment.captured`, `payment.failed`, `order.paid`
- **Secret:** generate a strong random string, paste back into `RAZORPAY_WEBHOOK_SECRET`

### 4. Migrate existing `data/deals.json` (optional, one-time)

If you have any existing deals with payment data:

```bash
npx tsx scripts/migrate-deals-to-supabase.ts
```

### 5. Deploy + Vercel env

```bash
# Vercel — use CLI (not dashboard) to avoid trailing \n bug:
printf "%s" "rzp_live_SbqWKkBEjszuEz" | npx vercel env add RAZORPAY_KEY_ID production
printf "%s" "<your_secret>"            | npx vercel env add RAZORPAY_KEY_SECRET production
printf "%s" "<webhook_secret>"         | npx vercel env add RAZORPAY_WEBHOOK_SECRET production
# repeat for SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, all NEXT_PUBLIC_SYNAPSIS_*

npx vercel --prod
```

---

## How a payment flows (real money path)

**Razorpay path (≤ ₹5L typical):**
1. Client hits Pay → `POST /api/razorpay/order`
2. Server: load deal, recompute `amount = totalPrice × percentage` in paise, idempotently upsert pending row in `synapsis.payments`, log `payment.order.created` in `platform_transactions`, create Razorpay order
3. Returns `{ orderId, amount, keyId }` — client opens Razorpay checkout
4. Client pays → Razorpay returns `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
5. Client → `POST /api/razorpay/verify` → HMAC verify, amount cross-check, mark paid, run pure phase transition, write deal to JSON, fire side effects
6. Razorpay → `POST /api/razorpay/webhook` (server-to-server, may arrive before/after #5) → idempotency check on `razorpay_event_id` and payment status, no double-process
7. Side effects: invoice PDF generated + persisted, email to client (with PDF attachment) + admin

**Manual NEFT path (≥ ₹5L typical):**
1. Client expands NEFT panel → sees Synapsis bank details + reference code
2. Client transfers via their bank, gets UTR
3. Client → `POST /api/payments/manual/submit` (multipart with UTR + screenshot)
4. Server: validates amount, uploads screenshot to Supabase Storage, creates `pending_admin_verify` payment row + `manual_payment_proofs` entry
5. Admin alert email fires
6. Admin → `POST /api/admin/payments/manual/[proofId]/verify` (with adminNote ≥10 chars)
7. Server: marks paid, runs SAME transition, generates invoice, emails client

**Failure recovery (reconciliation):**
1. Admin → `GET /api/admin/payments/reconcile?days=30` → diff report
2. Sees `missed_webhook` entries (RP shows paid, DB doesn't)
3. Admin → `POST /api/admin/payments/reconcile` with `{ orderIds: [...] }` → re-fires the capture flow

---

## Tests to run before LIVE

- [ ] Sign in as admin, ensure `ADMIN_EMAIL` in env matches Google email
- [ ] Create a test deal (Phase 0–2 manually until Phase 3 unlocks)
- [ ] Set `deal.totalPrice = 100` (₹100 deal — just to test plumbing cheaply)
- [ ] Click Pay → real Razorpay LIVE checkout opens → pay ₹30 (30% advance)
- [ ] Verify: invoice email arrives with PDF, deal advances Phase 3 state, `synapsis.payments` shows `paid`
- [ ] Refresh and try to pay again → should refuse "already paid"
- [ ] Submit a manual NEFT proof for a different test deal → admin verify flow
- [ ] Run reconciliation → should report all OK
- [ ] Manually disable webhook in Razorpay, do another payment → reconciliation should flag missed webhook → recover

---

## Known limitations / V2 candidates

- **Client email:** payment confirmation email only sends if `deal.questionnaire.email` is set. V2 = collect email at Phase 0 form / Phase 1 questionnaire.
- **Multi-signature invoice:** Currently system-generated, no admin signature. V2 = upload signature, embed in PDF.
- **TDS deducted by client:** column ready (`payments.tds_received_paise`) but no admin UI yet to enter it. V2 = inline edit in admin payment row.
- **Deal record migration:** `data/deals.json` still source of truth for non-payment deal state. Concurrency improved via tmp+rename + per-token lock, but full Supabase migration recommended once paid clients > 3.
- **GSTIN:** When turnover crosses ₹20L, set `SYNAPSIS_CONFIG.gstin` and the invoice template auto-shows it. CGST/SGST/IGST split logic NOT YET implemented — will need addition when threshold hit.
- **Multi-currency:** Hard-locked to INR. To add USD/EUR for international clients, extend `currency` column + `formatCurrency` helpers.

---

## Compliance notes (read once)

- **No GSTIN today** — invoices show "Not Applicable (Sole Proprietor — below ₹20L)". Legally fine.
- **Sequential invoice numbers** — gap-aware via Postgres SEQUENCE. Indian Income Tax accepts this format.
- **Udyam + PAN last-4** displayed — establishes business identity on invoice.
- **TDS receivable** — Track when client deducts 10% under Section 194J. Filed via Form 26AS in your ITR. Admin must enter `tds_received_paise` before invoice marked complete for clean accounting.
- **Audit log** — `platform_transactions` is your defense in any tax/dispute scenario. Every event has actor + source + timestamp + Razorpay refs.
- **Savings account** — operationally working but NOT recommended past ₹3-5L cumulative deposits in a financial year. Convert to current account before scaling.
