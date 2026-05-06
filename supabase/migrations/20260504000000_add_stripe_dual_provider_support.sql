-- ─── DUAL PROVIDER SUPPORT (Razorpay + Stripe) ─────────────────────────────
-- Extends synapsis payment infra to support Stripe (foreign clients) alongside
-- existing Razorpay (domestic). Backwards-compatible — all existing rows get
-- provider='razorpay' and currency stays 'INR'.
--
-- Applied 2026-05-04.

-- ─── PAYMENTS — add provider + stripe + relax currency check ───────────────

ALTER TABLE synapsis.payments
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'razorpay'
        CHECK (provider IN ('razorpay','stripe','manual')),
    ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS amount_minor BIGINT,           -- generic minor unit (paise|cents) — mirrors amount_paise for compat
    ADD COLUMN IF NOT EXISTS minor_per_major INT NOT NULL DEFAULT 100;  -- 100 paise = 1 INR, 100 cents = 1 USD

-- Backfill amount_minor from amount_paise for existing rows (idempotent)
UPDATE synapsis.payments
SET amount_minor = amount_paise
WHERE amount_minor IS NULL;

-- Allow USD currency (existing constraint defaults to 'INR'; no check existed,
-- but we add an explicit check here)
ALTER TABLE synapsis.payments
    DROP CONSTRAINT IF EXISTS synapsis_payments_currency_check;
ALTER TABLE synapsis.payments
    ADD CONSTRAINT synapsis_payments_currency_check
    CHECK (currency IN ('INR','USD'));

-- Relax method check to allow stripe payment methods
ALTER TABLE synapsis.payments
    DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE synapsis.payments
    DROP CONSTRAINT IF EXISTS synapsis_payments_method_check;
-- The original check is unnamed; drop the column-level check via reset:
-- (Postgres auto-names; we add a permissive replacement)
ALTER TABLE synapsis.payments
    ADD CONSTRAINT synapsis_payments_method_check2
    CHECK (method IS NULL OR method IN ('razorpay','manual_neft','admin_marked','stripe'));

CREATE INDEX IF NOT EXISTS synapsis_payments_stripe_session_idx
    ON synapsis.payments(stripe_session_id);
CREATE INDEX IF NOT EXISTS synapsis_payments_stripe_pi_idx
    ON synapsis.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS synapsis_payments_provider_idx
    ON synapsis.payments(provider);

-- ─── PLATFORM TRANSACTIONS — add stripe + provider columns ─────────────────

ALTER TABLE synapsis.platform_transactions
    ADD COLUMN IF NOT EXISTS provider TEXT,
    ADD COLUMN IF NOT EXISTS stripe_event_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Idempotency on stripe events (mirrors razorpay_event_id index)
CREATE UNIQUE INDEX IF NOT EXISTS synapsis_tx_unique_stripe_event
    ON synapsis.platform_transactions(stripe_event_id)
    WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS synapsis_tx_stripe_session_idx
    ON synapsis.platform_transactions(stripe_session_id);

-- ─── INVOICES — track currency for proper formatting ───────────────────────

ALTER TABLE synapsis.invoices
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR'
        CHECK (currency IN ('INR','USD'));
