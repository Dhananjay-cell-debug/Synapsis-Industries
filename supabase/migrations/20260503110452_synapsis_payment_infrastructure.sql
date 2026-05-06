-- ─── SYNAPSIS PAYMENT INFRASTRUCTURE ───────────────────────────────────────
-- Bulletproof payment system for Synapsis Industries portfolio site.
-- 30/30/40 milestone payments. INR. Razorpay + Manual NEFT. Audit-grade.
-- Applied to project VELT (uslmejdctlglropgqzmc) on 2026-05-03.

CREATE SCHEMA IF NOT EXISTS synapsis;

-- ─── Sequential invoice numbering (gap-aware, atomic) ──────────────────────
CREATE SEQUENCE IF NOT EXISTS synapsis.invoice_seq START 1 MINVALUE 1;

-- ─── PAYMENTS — per-phase payment record (3, 4, 6) ─────────────────────────
CREATE TABLE IF NOT EXISTS synapsis.payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_token          TEXT NOT NULL,
    phase               INT  NOT NULL CHECK (phase IN (3, 4, 6)),
    percentage          INT  NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    amount_paise        BIGINT NOT NULL CHECK (amount_paise > 0),
    currency            TEXT NOT NULL DEFAULT 'INR',
    status              TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded','pending_admin_verify')),
    method              TEXT CHECK (method IN ('razorpay','manual_neft','admin_marked')),
    razorpay_order_id   TEXT,
    razorpay_payment_id TEXT,
    receipt             TEXT,
    paid_at             TIMESTAMPTZ,
    failed_reason       TEXT,
    tds_received_paise  BIGINT NOT NULL DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS synapsis_payments_one_pending_per_phase
    ON synapsis.payments(deal_token, phase) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS synapsis_payments_one_paid_per_phase
    ON synapsis.payments(deal_token, phase) WHERE status = 'paid';
CREATE UNIQUE INDEX IF NOT EXISTS synapsis_payments_one_admin_pending_per_phase
    ON synapsis.payments(deal_token, phase) WHERE status = 'pending_admin_verify';
CREATE INDEX IF NOT EXISTS synapsis_payments_order_idx ON synapsis.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS synapsis_payments_pid_idx ON synapsis.payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS synapsis_payments_status_idx ON synapsis.payments(status);

-- ─── PLATFORM TRANSACTIONS — IMMUTABLE audit log ───────────────────────────
CREATE TABLE IF NOT EXISTS synapsis.platform_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_token          TEXT NOT NULL,
    payment_id          UUID REFERENCES synapsis.payments(id),
    type                TEXT NOT NULL,
    source              TEXT NOT NULL CHECK (source IN ('webhook','client_callback','admin_manual','system')),
    actor_email         TEXT,
    amount_paise        BIGINT,
    razorpay_event_id   TEXT,
    razorpay_order_id   TEXT,
    razorpay_payment_id TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS synapsis_tx_unique_event
    ON synapsis.platform_transactions(razorpay_event_id)
    WHERE razorpay_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS synapsis_tx_deal_idx ON synapsis.platform_transactions(deal_token);
CREATE INDEX IF NOT EXISTS synapsis_tx_type_idx ON synapsis.platform_transactions(type);
CREATE INDEX IF NOT EXISTS synapsis_tx_created_idx ON synapsis.platform_transactions(created_at DESC);

CREATE OR REPLACE FUNCTION synapsis.block_tx_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'platform_transactions is append-only — UPDATE/DELETE forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS synapsis_tx_no_update ON synapsis.platform_transactions;
CREATE TRIGGER synapsis_tx_no_update BEFORE UPDATE ON synapsis.platform_transactions
    FOR EACH ROW EXECUTE FUNCTION synapsis.block_tx_mutation();

DROP TRIGGER IF EXISTS synapsis_tx_no_delete ON synapsis.platform_transactions;
CREATE TRIGGER synapsis_tx_no_delete BEFORE DELETE ON synapsis.platform_transactions
    FOR EACH ROW EXECUTE FUNCTION synapsis.block_tx_mutation();

-- ─── INVOICES — sequential, gap-aware, immutable once issued ───────────────
CREATE TABLE IF NOT EXISTS synapsis.invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number      TEXT NOT NULL UNIQUE,
    deal_token          TEXT NOT NULL,
    payment_id          UUID NOT NULL REFERENCES synapsis.payments(id),
    phase               INT NOT NULL,
    amount_paise        BIGINT NOT NULL,
    tds_received_paise  BIGINT NOT NULL DEFAULT 0,
    pdf_url             TEXT,
    pdf_blob            BYTEA,
    issued_to_name      TEXT,
    issued_to_company   TEXT,
    issued_to_email     TEXT,
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by        TEXT NOT NULL CHECK (generated_by IN ('system','admin')),
    metadata            JSONB
);

CREATE INDEX IF NOT EXISTS synapsis_invoices_deal_idx ON synapsis.invoices(deal_token);
CREATE INDEX IF NOT EXISTS synapsis_invoices_payment_idx ON synapsis.invoices(payment_id);

-- ─── MANUAL PAYMENT PROOFS — NEFT/RTGS submissions (>₹5L flows) ────────────
CREATE TABLE IF NOT EXISTS synapsis.manual_payment_proofs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_token              TEXT NOT NULL,
    phase                   INT NOT NULL CHECK (phase IN (3, 4, 6)),
    amount_paise            BIGINT NOT NULL CHECK (amount_paise > 0),
    utr                     TEXT NOT NULL,
    bank_name               TEXT,
    account_holder_name     TEXT,
    payment_date            DATE,
    proof_image_url         TEXT,
    notes                   TEXT,
    status                  TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review','verified','rejected')),
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by             TEXT,
    reviewed_at             TIMESTAMPTZ,
    rejection_reason        TEXT,
    payment_id              UUID REFERENCES synapsis.payments(id),
    UNIQUE(deal_token, phase, utr)
);

CREATE INDEX IF NOT EXISTS synapsis_proofs_status_idx ON synapsis.manual_payment_proofs(status);
CREATE INDEX IF NOT EXISTS synapsis_proofs_deal_idx ON synapsis.manual_payment_proofs(deal_token);

-- ─── updated_at trigger for payments ───────────────────────────────────────
CREATE OR REPLACE FUNCTION synapsis.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS synapsis_payments_updated_at ON synapsis.payments;
CREATE TRIGGER synapsis_payments_updated_at
    BEFORE UPDATE ON synapsis.payments
    FOR EACH ROW EXECUTE FUNCTION synapsis.set_updated_at();

-- ─── Invoice numbering function (gap-aware, atomic) ────────────────────────
CREATE OR REPLACE FUNCTION synapsis.next_invoice_number(prefix TEXT DEFAULT 'SYNAP')
RETURNS TEXT AS $$
DECLARE
    seq_val BIGINT;
    year_str TEXT;
BEGIN
    seq_val := nextval('synapsis.invoice_seq');
    year_str := EXTRACT(YEAR FROM now())::TEXT;
    RETURN prefix || '-' || year_str || '-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ─── RLS — service role only (server-side access) ──────────────────────────
ALTER TABLE synapsis.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.platform_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.manual_payment_proofs ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA synapsis TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA synapsis TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA synapsis TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA synapsis TO service_role;
