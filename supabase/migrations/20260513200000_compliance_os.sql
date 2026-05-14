-- ─── SYNAPSIS COMPLIANCE OS ────────────────────────────────────────────────
-- Full compliance layer over existing payments/invoices.
-- Self-file mode. 44ADA presumptive. QRMP GST. LUT for exports.
-- Spec: docs/compliance/COMPLIANCE-OS-MASTER.md
-- Strategy: docs/compliance/TAX-STRATEGY.md
-- Applied 2026-05-13.

-- ============================================================================
-- 1. BUSINESS_TAX_PROFILE — singleton row for Synapsis identity
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.business_tax_profile (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- identity (singleton enforced via unique index below)
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    legal_name                  TEXT NOT NULL,
    trade_name                  TEXT NOT NULL,
    constitution_type           TEXT NOT NULL DEFAULT 'sole_proprietorship'
        CHECK (constitution_type IN ('sole_proprietorship','partnership','llp','private_limited','huf','other')),
    -- pan: store last4 only here; full in server env (SYNAPSIS_PAN_FULL)
    pan_last4                   TEXT NOT NULL,
    -- gst
    gstin                       TEXT,
    gstin_state_code            TEXT,
    gst_registration_date       DATE,
    gst_application_arn         TEXT,
    gst_status                  TEXT NOT NULL DEFAULT 'pending'
        CHECK (gst_status IN ('not_applied','pending','active','cancelled','suspended')),
    -- lut
    lut_active                  BOOLEAN NOT NULL DEFAULT false,
    lut_arn                     TEXT,
    lut_filed_at                TIMESTAMPTZ,
    lut_valid_until             DATE,
    -- regime + scheme
    income_tax_regime           TEXT NOT NULL DEFAULT 'auto'
        CHECK (income_tax_regime IN ('old','new','auto')),
    presumptive_scheme          TEXT NOT NULL DEFAULT '44ADA'
        CHECK (presumptive_scheme IN ('44ADA','44AD','regular')),
    gst_filing_scheme           TEXT NOT NULL DEFAULT 'qrmp'
        CHECK (gst_filing_scheme IN ('qrmp','monthly','composition')),
    -- udyam
    udyam_number                TEXT,
    udyam_registered_at         DATE,
    -- address (principal place of business)
    address_line1               TEXT NOT NULL,
    address_line2               TEXT,
    address_city                TEXT NOT NULL,
    address_state               TEXT NOT NULL DEFAULT 'Maharashtra',
    address_pincode             TEXT NOT NULL,
    address_country             TEXT NOT NULL DEFAULT 'India',
    -- default classification
    default_sac_code            TEXT NOT NULL DEFAULT '998313',
    default_gst_rate            NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    -- bank context (last4; full in env)
    bank_account_type           TEXT NOT NULL DEFAULT 'savings'
        CHECK (bank_account_type IN ('savings','current')),
    bank_account_last4          TEXT,
    bank_ifsc                   TEXT,
    bank_name                   TEXT,
    -- meta
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce singleton (only one active profile)
CREATE UNIQUE INDEX IF NOT EXISTS synapsis_business_profile_singleton
    ON synapsis.business_tax_profile(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS synapsis_business_profile_updated_at ON synapsis.business_tax_profile;
CREATE TRIGGER synapsis_business_profile_updated_at
    BEFORE UPDATE ON synapsis.business_tax_profile
    FOR EACH ROW EXECUTE FUNCTION synapsis.set_updated_at();


-- ============================================================================
-- 2. CLIENT_TAX_PROFILE — one row per client
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.client_tax_profile (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_token                  TEXT,                       -- link to deal if available
    legal_name                  TEXT NOT NULL,
    trade_name                  TEXT,
    recipient_type              TEXT NOT NULL
        CHECK (recipient_type IN ('indian_registered','indian_unregistered','international_business','international_individual')),
    client_gstin                TEXT,                       -- only for indian_registered
    client_pan                  TEXT,                       -- optional
    -- billing address
    billing_line1               TEXT,
    billing_line2               TEXT,
    billing_city                TEXT,
    billing_state               TEXT,                       -- Indian state name when indian_*
    billing_pincode             TEXT,
    billing_country             TEXT NOT NULL DEFAULT 'India',
    -- place of supply (computed default, overridable)
    place_of_supply             TEXT,                       -- state for indian, country for international
    -- contact
    contact_email               TEXT,
    contact_phone               TEXT,
    -- meta
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS synapsis_client_profile_deal_idx
    ON synapsis.client_tax_profile(deal_token);
CREATE INDEX IF NOT EXISTS synapsis_client_profile_country_idx
    ON synapsis.client_tax_profile(billing_country);
CREATE INDEX IF NOT EXISTS synapsis_client_profile_gstin_idx
    ON synapsis.client_tax_profile(client_gstin) WHERE client_gstin IS NOT NULL;

DROP TRIGGER IF EXISTS synapsis_client_profile_updated_at ON synapsis.client_tax_profile;
CREATE TRIGGER synapsis_client_profile_updated_at
    BEFORE UPDATE ON synapsis.client_tax_profile
    FOR EACH ROW EXECUTE FUNCTION synapsis.set_updated_at();


-- ============================================================================
-- 3. INVOICE_TAX_SNAPSHOT — immutable per-invoice tax decision
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.invoice_tax_snapshot (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id                  UUID NOT NULL REFERENCES synapsis.invoices(id),
    -- amounts (in minor units of invoice currency)
    invoice_currency            TEXT NOT NULL CHECK (invoice_currency IN ('INR','USD')),
    taxable_value_minor         BIGINT NOT NULL,
    cgst_amount_minor           BIGINT NOT NULL DEFAULT 0,
    sgst_amount_minor           BIGINT NOT NULL DEFAULT 0,
    igst_amount_minor           BIGINT NOT NULL DEFAULT 0,
    total_tax_minor             BIGINT NOT NULL DEFAULT 0,
    total_invoice_minor         BIGINT NOT NULL,
    -- rate
    gst_rate                    NUMERIC(5,2) NOT NULL DEFAULT 0,
    -- classification
    sac_code                    TEXT NOT NULL,
    place_of_supply             TEXT NOT NULL,
    treatment                   TEXT NOT NULL
        CHECK (treatment IN ('intra_state','inter_state','export_lut_zero_rated','export_with_igst','b2c_intra','b2c_inter','exempt','reverse_charge')),
    treatment_reason            TEXT NOT NULL,
    zero_rated                  BOOLEAN NOT NULL DEFAULT false,
    reverse_charge              BOOLEAN NOT NULL DEFAULT false,
    -- inr equivalent for forex invoices (per SBI TT rate)
    inr_equivalent_paise        BIGINT,
    fx_rate                     NUMERIC(12,4),
    fx_rate_date                DATE,
    fx_rate_source              TEXT,
    -- rule version (so future rule changes don't silently rewrite)
    rule_version                TEXT NOT NULL,
    -- meta
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(invoice_id)
);

CREATE INDEX IF NOT EXISTS synapsis_tax_snap_treatment_idx
    ON synapsis.invoice_tax_snapshot(treatment);
CREATE INDEX IF NOT EXISTS synapsis_tax_snap_currency_idx
    ON synapsis.invoice_tax_snapshot(invoice_currency);
CREATE INDEX IF NOT EXISTS synapsis_tax_snap_created_idx
    ON synapsis.invoice_tax_snapshot(created_at DESC);

-- Append-only: no UPDATE, no DELETE
DROP TRIGGER IF EXISTS synapsis_tax_snap_no_update ON synapsis.invoice_tax_snapshot;
CREATE TRIGGER synapsis_tax_snap_no_update BEFORE UPDATE ON synapsis.invoice_tax_snapshot
    FOR EACH ROW EXECUTE FUNCTION synapsis.block_tx_mutation();

DROP TRIGGER IF EXISTS synapsis_tax_snap_no_delete ON synapsis.invoice_tax_snapshot;
CREATE TRIGGER synapsis_tax_snap_no_delete BEFORE DELETE ON synapsis.invoice_tax_snapshot
    FOR EACH ROW EXECUTE FUNCTION synapsis.block_tx_mutation();


-- ============================================================================
-- 4. EXPENSE_CATEGORIES — controlled vocabulary
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.expense_categories (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                        TEXT NOT NULL UNIQUE,
    label                       TEXT NOT NULL,
    description                 TEXT,
    typical_itc_eligible        BOOLEAN NOT NULL DEFAULT true,
    depreciation_rate           NUMERIC(5,2),       -- percentage if capex; null for opex
    sort_order                  INT NOT NULL DEFAULT 100,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard categories
INSERT INTO synapsis.expense_categories (code, label, description, typical_itc_eligible, depreciation_rate, sort_order) VALUES
    ('saas_dev_tools', 'Dev Tools / SaaS', 'GitHub, Cursor, Vercel, Supabase, Anthropic, OpenAI, etc.', true, NULL, 10),
    ('saas_business',  'Business SaaS', 'Razorpay fees, Stripe fees, accounting tools, email, CRM', true, NULL, 20),
    ('equipment_it',   'IT Equipment', 'Laptop, monitor, phone, peripherals (capex; 40% depreciation)', true, 40.00, 30),
    ('domain_hosting', 'Domain & Hosting', 'Domain registration, DNS, CDN', true, NULL, 40),
    ('professional',   'Professional Fees', 'CA, lawyer, consultant fees', true, NULL, 50),
    ('marketing',      'Marketing', 'Ads, paid promotion, design fees for marketing', true, NULL, 60),
    ('telecom',        'Telecom & Internet', 'Mobile bill, broadband bill (business portion)', true, NULL, 70),
    ('travel',         'Travel for Client', 'Flights, trains, hotels for client work', true, NULL, 80),
    ('office_supplies','Office Supplies', 'Stationery, small office items', true, NULL, 90),
    ('books_courses',  'Books & Courses', 'Technical books, online courses', false, NULL, 100),
    ('bank_charges',   'Bank Charges', 'Account fees, NEFT/RTGS charges', true, NULL, 110),
    ('utility_home',   'Home Office Utility', 'Electricity (business portion); only if regular books', false, NULL, 120),
    ('rent',           'Rent (business)', 'Coworking, office rent', true, NULL, 130),
    ('other',          'Other', 'Catch-all; categorize later', false, NULL, 999)
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- 5. EXPENSES — every business spend
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.expenses (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- when + what
    expense_date                DATE NOT NULL,
    vendor                      TEXT NOT NULL,
    description                 TEXT,
    category_code               TEXT REFERENCES synapsis.expense_categories(code),
    -- amounts (paise — INR)
    amount_paise                BIGINT NOT NULL CHECK (amount_paise > 0),
    taxable_paise               BIGINT NOT NULL,        -- amount minus gst
    gst_amount_paise            BIGINT NOT NULL DEFAULT 0,
    gst_rate                    NUMERIC(5,2),
    -- foreign currency original (for SaaS billed in USD)
    original_currency           TEXT NOT NULL DEFAULT 'INR' CHECK (original_currency IN ('INR','USD','EUR','GBP','SGD')),
    original_amount_minor       BIGINT,
    fx_rate                     NUMERIC(12,4),
    -- itc tracking
    itc_eligible                BOOLEAN NOT NULL DEFAULT false,
    itc_claimed                 BOOLEAN NOT NULL DEFAULT false,
    itc_claimed_in_return       TEXT,                   -- gstr-3b reference, e.g. "3B-2026-05"
    -- vendor gst details (if itc claimable)
    vendor_gstin                TEXT,
    vendor_invoice_number       TEXT,
    -- receipt
    receipt_url                 TEXT,                   -- supabase storage URL
    -- source classification
    source                      TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual','email_parsed','bank_csv','razorpay_fee','stripe_fee','recurring')),
    source_reference            TEXT,                   -- email msg-id, csv row, etc. (for dedup)
    -- depreciation tracking (capex items)
    is_capex                    BOOLEAN NOT NULL DEFAULT false,
    depreciation_rate           NUMERIC(5,2),
    useful_life_years           INT,
    -- meta
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS synapsis_expenses_date_idx ON synapsis.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS synapsis_expenses_vendor_idx ON synapsis.expenses(vendor);
CREATE INDEX IF NOT EXISTS synapsis_expenses_category_idx ON synapsis.expenses(category_code);
CREATE INDEX IF NOT EXISTS synapsis_expenses_itc_eligible_idx ON synapsis.expenses(itc_eligible) WHERE itc_eligible = true;
CREATE INDEX IF NOT EXISTS synapsis_expenses_source_ref_unique
    ON synapsis.expenses(source, source_reference) WHERE source_reference IS NOT NULL;

DROP TRIGGER IF EXISTS synapsis_expenses_updated_at ON synapsis.expenses;
CREATE TRIGGER synapsis_expenses_updated_at
    BEFORE UPDATE ON synapsis.expenses
    FOR EACH ROW EXECUTE FUNCTION synapsis.set_updated_at();


-- ============================================================================
-- 6. COMPLIANCE_TASKS — every deadline + reminder lifecycle
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.compliance_tasks (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                        TEXT NOT NULL
        CHECK (kind IN ('gstr-1','gstr-3b','gstr-9','itr-4','itr-3','advance-tax','lut-renewal','lut-initial','tds-payment','tds-return','health-insurance-renewal','nps-contribution','udyam-update','professional-tax','other')),
    title                       TEXT NOT NULL,
    description                 TEXT,
    period                      TEXT,                     -- '2026-Q1', '2026-05', 'FY2026-27'
    due_date                    DATE NOT NULL,
    severity                    TEXT NOT NULL DEFAULT 'standard'
        CHECK (severity IN ('critical','standard','informational')),
    status                      TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','in_progress','completed','skipped','overdue')),
    -- reminders
    remind_at_t7                TIMESTAMPTZ,
    remind_at_t3                TIMESTAMPTZ,
    remind_at_t1                TIMESTAMPTZ,
    reminded_t7_sent            BOOLEAN NOT NULL DEFAULT false,
    reminded_t3_sent            BOOLEAN NOT NULL DEFAULT false,
    reminded_t1_sent            BOOLEAN NOT NULL DEFAULT false,
    -- completion
    completed_at                TIMESTAMPTZ,
    completed_notes             TEXT,
    related_filing_id           UUID,                     -- references tax_filings.id when applicable
    -- meta
    auto_generated              BOOLEAN NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS synapsis_tasks_due_idx ON synapsis.compliance_tasks(due_date);
CREATE INDEX IF NOT EXISTS synapsis_tasks_status_idx ON synapsis.compliance_tasks(status);
CREATE INDEX IF NOT EXISTS synapsis_tasks_kind_period_idx ON synapsis.compliance_tasks(kind, period);
CREATE UNIQUE INDEX IF NOT EXISTS synapsis_tasks_unique_period
    ON synapsis.compliance_tasks(kind, period) WHERE period IS NOT NULL;

DROP TRIGGER IF EXISTS synapsis_tasks_updated_at ON synapsis.compliance_tasks;
CREATE TRIGGER synapsis_tasks_updated_at
    BEFORE UPDATE ON synapsis.compliance_tasks
    FOR EACH ROW EXECUTE FUNCTION synapsis.set_updated_at();


-- ============================================================================
-- 7. FOREX_INWARD — every international payment + FIRC
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.forex_inward (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id                  UUID REFERENCES synapsis.payments(id),
    provider                    TEXT NOT NULL CHECK (provider IN ('stripe','razorpay_intl','wise','direct_wire','paypal','other')),
    payment_date                DATE NOT NULL,
    foreign_currency            TEXT NOT NULL CHECK (foreign_currency IN ('USD','EUR','GBP','SGD','AUD','CAD','AED','other')),
    foreign_amount_minor        BIGINT NOT NULL,
    inr_amount_paise            BIGINT NOT NULL,
    fx_rate                     NUMERIC(12,4) NOT NULL,
    fx_rate_source              TEXT NOT NULL DEFAULT 'sbi_tt_reference',
    -- firc
    firc_status                 TEXT NOT NULL DEFAULT 'pending'
        CHECK (firc_status IN ('pending','requested','received','not_applicable')),
    firc_reference              TEXT,
    firc_url                    TEXT,                     -- supabase storage URL
    firc_received_at            DATE,
    -- purpose code (FEMA)
    purpose_code                TEXT NOT NULL DEFAULT 'P0802',  -- computer software/IT services
    purpose_code_corrected      BOOLEAN NOT NULL DEFAULT false,
    -- export validity (under GST)
    qualifies_as_export         BOOLEAN NOT NULL DEFAULT true,
    export_qualification_notes  TEXT,
    -- meta
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS synapsis_forex_date_idx ON synapsis.forex_inward(payment_date DESC);
CREATE INDEX IF NOT EXISTS synapsis_forex_firc_status_idx ON synapsis.forex_inward(firc_status);
CREATE INDEX IF NOT EXISTS synapsis_forex_payment_idx ON synapsis.forex_inward(payment_id);

DROP TRIGGER IF EXISTS synapsis_forex_updated_at ON synapsis.forex_inward;
CREATE TRIGGER synapsis_forex_updated_at
    BEFORE UPDATE ON synapsis.forex_inward
    FOR EACH ROW EXECUTE FUNCTION synapsis.set_updated_at();


-- ============================================================================
-- 8. TAX_FILINGS — every GSTR/ITR submission record
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.tax_filings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                        TEXT NOT NULL
        CHECK (kind IN ('gstr-1','gstr-3b','gstr-9','gstr-9c','itr-4','itr-3','tds-return','lut','other')),
    period                      TEXT NOT NULL,            -- '2026-Q1', '2026-05', 'FY2026-27'
    fiscal_year                 TEXT NOT NULL,            -- 'FY2026-27'
    -- amounts in paise
    gross_amount_paise          BIGINT,
    tax_amount_paise            BIGINT,
    paid_amount_paise           BIGINT,
    refund_amount_paise         BIGINT,
    -- submission
    acknowledgement_ref         TEXT NOT NULL,            -- ARN / e-filing ack
    submitted_at                TIMESTAMPTZ NOT NULL,
    submitted_method            TEXT NOT NULL DEFAULT 'portal_online'
        CHECK (submitted_method IN ('portal_online','portal_offline_utility','manual_chalan')),
    -- artifacts
    submission_pdf_url          TEXT,                     -- supabase storage URL
    challan_pdf_url             TEXT,
    -- snapshot of computation at time of filing
    computation_snapshot        JSONB,
    -- meta
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS synapsis_filings_kind_period_idx
    ON synapsis.tax_filings(kind, period);
CREATE UNIQUE INDEX IF NOT EXISTS synapsis_filings_unique_filing
    ON synapsis.tax_filings(kind, period);
CREATE INDEX IF NOT EXISTS synapsis_filings_fy_idx ON synapsis.tax_filings(fiscal_year);

-- Append-only
DROP TRIGGER IF EXISTS synapsis_filings_no_update ON synapsis.tax_filings;
CREATE TRIGGER synapsis_filings_no_update BEFORE UPDATE ON synapsis.tax_filings
    FOR EACH ROW EXECUTE FUNCTION synapsis.block_tx_mutation();

DROP TRIGGER IF EXISTS synapsis_filings_no_delete ON synapsis.tax_filings;
CREATE TRIGGER synapsis_filings_no_delete BEFORE DELETE ON synapsis.tax_filings
    FOR EACH ROW EXECUTE FUNCTION synapsis.block_tx_mutation();


-- ============================================================================
-- 9. DEDUCTIONS — yearly chapter VI-A claims
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.deductions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year                 TEXT NOT NULL,            -- 'FY2026-27'
    section                     TEXT NOT NULL
        CHECK (section IN ('80C','80CCD(1B)','80CCD(2)','80D','80D-parents','80E','80EE','80EEA','80G','80TTA','80TTB','24(b)','other')),
    sub_category                TEXT,                     -- 'ppf', 'elss', 'lic', 'nps-tier-1', etc.
    amount_paise                BIGINT NOT NULL CHECK (amount_paise > 0),
    target_amount_paise         BIGINT,                   -- yearly target (for tracker)
    proof_url                   TEXT,                     -- supabase storage URL
    invested_at                 DATE,
    -- meta
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS synapsis_deductions_fy_idx ON synapsis.deductions(fiscal_year);
CREATE INDEX IF NOT EXISTS synapsis_deductions_section_idx ON synapsis.deductions(section);

DROP TRIGGER IF EXISTS synapsis_deductions_updated_at ON synapsis.deductions;
CREATE TRIGGER synapsis_deductions_updated_at
    BEFORE UPDATE ON synapsis.deductions
    FOR EACH ROW EXECUTE FUNCTION synapsis.set_updated_at();


-- ============================================================================
-- 10. ADVANCE_TAX_PAYMENTS — challan history
-- ============================================================================

CREATE TABLE IF NOT EXISTS synapsis.advance_tax_payments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year                 TEXT NOT NULL,
    installment                 TEXT NOT NULL
        CHECK (installment IN ('q1_jun15','q2_sep15','q3_dec15','q4_mar15','self_assessment','tds_credit')),
    amount_paise                BIGINT NOT NULL CHECK (amount_paise > 0),
    challan_reference           TEXT NOT NULL,            -- CIN
    bsr_code                    TEXT,
    paid_at                     DATE NOT NULL,
    challan_pdf_url             TEXT,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS synapsis_advtax_fy_idx ON synapsis.advance_tax_payments(fiscal_year);


-- ============================================================================
-- 11. RLS + grants
-- ============================================================================

ALTER TABLE synapsis.business_tax_profile     ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.client_tax_profile       ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.invoice_tax_snapshot     ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.expense_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.expenses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.compliance_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.forex_inward             ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.tax_filings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.deductions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapsis.advance_tax_payments     ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA synapsis TO service_role;


-- ============================================================================
-- 12. HELPER FUNCTIONS
-- ============================================================================

-- Compute current Indian fiscal year string ('FY2026-27' for Apr 2026 onward)
CREATE OR REPLACE FUNCTION synapsis.current_fy(at_date DATE DEFAULT current_date)
RETURNS TEXT AS $$
DECLARE
    y INT;
    m INT;
BEGIN
    y := EXTRACT(YEAR FROM at_date)::INT;
    m := EXTRACT(MONTH FROM at_date)::INT;
    IF m >= 4 THEN
        RETURN 'FY' || y || '-' || LPAD(((y+1) % 100)::TEXT, 2, '0');
    ELSE
        RETURN 'FY' || (y-1) || '-' || LPAD((y % 100)::TEXT, 2, '0');
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Compute fiscal quarter ('FY2026-27-Q1' for Apr-Jun, etc.)
CREATE OR REPLACE FUNCTION synapsis.current_fq(at_date DATE DEFAULT current_date)
RETURNS TEXT AS $$
DECLARE
    m INT;
    q TEXT;
BEGIN
    m := EXTRACT(MONTH FROM at_date)::INT;
    q := CASE
        WHEN m IN (4,5,6)   THEN 'Q1'
        WHEN m IN (7,8,9)   THEN 'Q2'
        WHEN m IN (10,11,12) THEN 'Q3'
        ELSE 'Q4'
    END;
    RETURN synapsis.current_fy(at_date) || '-' || q;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================================
-- 13. SEED — initial Synapsis business profile (no GSTIN yet)
-- ============================================================================

INSERT INTO synapsis.business_tax_profile (
    legal_name, trade_name, constitution_type, pan_last4,
    gst_status, gst_application_arn,
    income_tax_regime, presumptive_scheme, gst_filing_scheme,
    address_line1, address_city, address_state, address_pincode,
    default_sac_code, default_gst_rate,
    bank_account_type
) VALUES (
    'Dhananjay Chitmilla',
    'Synapsis Industries',
    'sole_proprietorship',
    'XXXX',                     -- update via admin once GSTIN profile arrives
    'pending',
    NULL,                       -- TODO: paste ARN via admin
    'auto',
    '44ADA',
    'qrmp',
    'Registered Address Line 1', 'Mumbai', 'Maharashtra', '400001',
    '998313',
    18.00,
    'savings'
) ON CONFLICT DO NOTHING;
