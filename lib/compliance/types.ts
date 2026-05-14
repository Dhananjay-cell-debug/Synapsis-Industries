// ─── COMPLIANCE TYPES ──────────────────────────────────────────────────────
// TypeScript types mirroring the synapsis.* compliance tables.
// Pure shapes — no logic. Logic lives in tax-engine.ts and module libs.

import type { SacCode } from './constants';

export type ConstitutionType =
    | 'sole_proprietorship'
    | 'partnership'
    | 'llp'
    | 'private_limited'
    | 'huf'
    | 'other';

export type GstStatus = 'not_applied' | 'pending' | 'active' | 'cancelled' | 'suspended';
export type IncomeRegime = 'old' | 'new' | 'auto';
export type PresumptiveScheme = '44ADA' | '44AD' | 'regular';
export type GstFilingScheme = 'qrmp' | 'monthly' | 'composition';
export type BankAccountType = 'savings' | 'current';

export interface BusinessTaxProfile {
    id: string;
    is_active: boolean;
    legal_name: string;
    trade_name: string;
    constitution_type: ConstitutionType;
    pan_last4: string;
    gstin: string | null;
    gstin_state_code: string | null;
    gst_registration_date: string | null;
    gst_application_arn: string | null;
    gst_status: GstStatus;
    lut_active: boolean;
    lut_arn: string | null;
    lut_filed_at: string | null;
    lut_valid_until: string | null;
    income_tax_regime: IncomeRegime;
    presumptive_scheme: PresumptiveScheme;
    gst_filing_scheme: GstFilingScheme;
    udyam_number: string | null;
    udyam_registered_at: string | null;
    address_line1: string;
    address_line2: string | null;
    address_city: string;
    address_state: string;
    address_pincode: string;
    address_country: string;
    default_sac_code: SacCode | string;
    default_gst_rate: number;
    bank_account_type: BankAccountType;
    bank_account_last4: string | null;
    bank_ifsc: string | null;
    bank_name: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export type RecipientType =
    | 'indian_registered'
    | 'indian_unregistered'
    | 'international_business'
    | 'international_individual';

export interface ClientTaxProfile {
    id: string;
    deal_token: string | null;
    legal_name: string;
    trade_name: string | null;
    recipient_type: RecipientType;
    client_gstin: string | null;
    client_pan: string | null;
    billing_line1: string | null;
    billing_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_pincode: string | null;
    billing_country: string;
    place_of_supply: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export type GstTreatment =
    | 'intra_state'
    | 'inter_state'
    | 'export_lut_zero_rated'
    | 'export_with_igst'
    | 'b2c_intra'
    | 'b2c_inter'
    | 'exempt'
    | 'reverse_charge';

export interface InvoiceTaxSnapshot {
    id: string;
    invoice_id: string;
    invoice_currency: 'INR' | 'USD';
    taxable_value_minor: bigint | number;
    cgst_amount_minor: bigint | number;
    sgst_amount_minor: bigint | number;
    igst_amount_minor: bigint | number;
    total_tax_minor: bigint | number;
    total_invoice_minor: bigint | number;
    gst_rate: number;
    sac_code: string;
    place_of_supply: string;
    treatment: GstTreatment;
    treatment_reason: string;
    zero_rated: boolean;
    reverse_charge: boolean;
    inr_equivalent_paise: bigint | number | null;
    fx_rate: number | null;
    fx_rate_date: string | null;
    fx_rate_source: string | null;
    rule_version: string;
    created_at: string;
}

export type ExpenseSource =
    | 'manual'
    | 'email_parsed'
    | 'bank_csv'
    | 'razorpay_fee'
    | 'stripe_fee'
    | 'recurring';

export interface Expense {
    id: string;
    expense_date: string;
    vendor: string;
    description: string | null;
    category_code: string | null;
    amount_paise: bigint | number;
    taxable_paise: bigint | number;
    gst_amount_paise: bigint | number;
    gst_rate: number | null;
    original_currency: string;
    original_amount_minor: bigint | number | null;
    fx_rate: number | null;
    itc_eligible: boolean;
    itc_claimed: boolean;
    itc_claimed_in_return: string | null;
    vendor_gstin: string | null;
    vendor_invoice_number: string | null;
    receipt_url: string | null;
    source: ExpenseSource;
    source_reference: string | null;
    is_capex: boolean;
    depreciation_rate: number | null;
    useful_life_years: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface ExpenseCategory {
    id: string;
    code: string;
    label: string;
    description: string | null;
    typical_itc_eligible: boolean;
    depreciation_rate: number | null;
    sort_order: number;
    created_at: string;
}

export type TaskKind =
    | 'gstr-1'
    | 'gstr-3b'
    | 'gstr-9'
    | 'itr-4'
    | 'itr-3'
    | 'advance-tax'
    | 'lut-renewal'
    | 'lut-initial'
    | 'tds-payment'
    | 'tds-return'
    | 'health-insurance-renewal'
    | 'nps-contribution'
    | 'udyam-update'
    | 'professional-tax'
    | 'other';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue';
export type TaskSeverity = 'critical' | 'standard' | 'informational';

export interface ComplianceTask {
    id: string;
    kind: TaskKind;
    title: string;
    description: string | null;
    period: string | null;
    due_date: string;
    severity: TaskSeverity;
    status: TaskStatus;
    remind_at_t7: string | null;
    remind_at_t3: string | null;
    remind_at_t1: string | null;
    reminded_t7_sent: boolean;
    reminded_t3_sent: boolean;
    reminded_t1_sent: boolean;
    completed_at: string | null;
    completed_notes: string | null;
    related_filing_id: string | null;
    auto_generated: boolean;
    created_at: string;
    updated_at: string;
}

export type ForexProvider = 'stripe' | 'razorpay_intl' | 'wise' | 'direct_wire' | 'paypal' | 'other';
export type FircStatus = 'pending' | 'requested' | 'received' | 'not_applicable';

export interface ForexInward {
    id: string;
    payment_id: string | null;
    provider: ForexProvider;
    payment_date: string;
    foreign_currency: string;
    foreign_amount_minor: bigint | number;
    inr_amount_paise: bigint | number;
    fx_rate: number;
    fx_rate_source: string;
    firc_status: FircStatus;
    firc_reference: string | null;
    firc_url: string | null;
    firc_received_at: string | null;
    purpose_code: string;
    purpose_code_corrected: boolean;
    qualifies_as_export: boolean;
    export_qualification_notes: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export type FilingKind = 'gstr-1' | 'gstr-3b' | 'gstr-9' | 'gstr-9c' | 'itr-4' | 'itr-3' | 'tds-return' | 'lut' | 'other';

export interface TaxFiling {
    id: string;
    kind: FilingKind;
    period: string;
    fiscal_year: string;
    gross_amount_paise: bigint | number | null;
    tax_amount_paise: bigint | number | null;
    paid_amount_paise: bigint | number | null;
    refund_amount_paise: bigint | number | null;
    acknowledgement_ref: string;
    submitted_at: string;
    submitted_method: string;
    submission_pdf_url: string | null;
    challan_pdf_url: string | null;
    computation_snapshot: unknown;
    notes: string | null;
    created_at: string;
}

export type DeductionSection =
    | '80C' | '80CCD(1B)' | '80CCD(2)' | '80D' | '80D-parents'
    | '80E' | '80EE' | '80EEA' | '80G' | '80TTA' | '80TTB'
    | '24(b)' | 'other';

export interface Deduction {
    id: string;
    fiscal_year: string;
    section: DeductionSection;
    sub_category: string | null;
    amount_paise: bigint | number;
    target_amount_paise: bigint | number | null;
    proof_url: string | null;
    invested_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdvanceTaxPayment {
    id: string;
    fiscal_year: string;
    installment: 'q1_jun15' | 'q2_sep15' | 'q3_dec15' | 'q4_mar15' | 'self_assessment' | 'tds_credit';
    amount_paise: bigint | number;
    challan_reference: string;
    bsr_code: string | null;
    paid_at: string;
    challan_pdf_url: string | null;
    notes: string | null;
    created_at: string;
}

// ─── Tax engine computation types ──────────────────────────────────────────

export interface DeductionStack {
    '80C'?: number;          // paise
    '80CCD(1B)'?: number;
    '80D'?: number;
    '80D-parents'?: number;
    '80E'?: number;
    '80EE'?: number;
    '80EEA'?: number;
    '80G'?: number;
    '80TTA'?: number;
    '24(b)'?: number;
}

export interface TaxEstimateInput {
    receipts_inr_paise: number;            // FY total receipts
    declared_higher_income_paise?: number; // if you want to declare >50%
    deductions: DeductionStack;
    regime?: IncomeRegime;
    advance_tax_paid_paise?: number;
    tds_credit_paise?: number;
}

export interface TaxEstimateOutput {
    receipts_paise: number;
    deemed_income_paise: number;
    deductions_total_paise: number;
    taxable_income_old_paise: number;
    taxable_income_new_paise: number;
    tax_old_regime_paise: number;
    tax_new_regime_paise: number;
    recommended_regime: 'old' | 'new';
    effective_tax_rate: number;            // tax / receipts
    net_payable_paise: number;             // after advance + tds credit
    advance_tax_due_paise: number;         // by 15 Mar for 44ADA
    next_action_date: string;              // ISO date string
    notes: string[];
}

export interface GstClassifyInput {
    business: Pick<BusinessTaxProfile, 'address_state' | 'lut_active' | 'gstin'>;
    client: Pick<ClientTaxProfile, 'recipient_type' | 'billing_state' | 'billing_country' | 'client_gstin' | 'place_of_supply'>;
    invoice_currency: 'INR' | 'USD';
    taxable_value_minor: number;
    sac_code?: string;
    gst_rate?: number;
}

export interface GstClassifyOutput {
    treatment: GstTreatment;
    treatment_reason: string;
    place_of_supply: string;
    sac_code: string;
    gst_rate: number;
    cgst_amount_minor: number;
    sgst_amount_minor: number;
    igst_amount_minor: number;
    total_tax_minor: number;
    total_invoice_minor: number;
    zero_rated: boolean;
    reverse_charge: boolean;
    rule_version: string;
}
