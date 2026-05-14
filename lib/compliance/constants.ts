// ─── COMPLIANCE CONSTANTS ──────────────────────────────────────────────────
// Single source of truth for tax rates, deadlines, SAC codes, slab rates.
// Spec: docs/compliance/COMPLIANCE-OS-MASTER.md
// Strategy: docs/compliance/TAX-STRATEGY.md
//
// IMPORTANT: When rates/slabs change in future budgets, bump RULE_VERSION
// and add a new dated block. Never edit historical values — they're stamped
// onto invoice_tax_snapshot.rule_version.

export const RULE_VERSION = '2026-05-13.v1';

// ─── SAC codes — service classification ────────────────────────────────────
// Reference: GST Council notified SAC list. 998313–998319 covers IT services.
export const SAC_CODES = {
    IT_DESIGN_DEV:        '998313',  // IT design & development (default for Synapsis)
    IT_INFRA_PROVISIONING:'998314',  // IT infrastructure
    IT_SUPPORT:           '998315',  // IT support / maintenance
    IT_CONSULTING:        '998311',  // IT consulting & advisory
    MGMT_CONSULTING:      '998311',  // Management consulting (overlaps; pick 998313 for clarity)
    DATA_PROCESSING:      '998316',  // Data processing services
    HOSTING:              '998315',  // (hosting reseller scenarios)
} as const;

export type SacCode = typeof SAC_CODES[keyof typeof SAC_CODES];

// ─── GST rates ─────────────────────────────────────────────────────────────
// Standard IT services attract 18%. Composite breakdown:
//   intra-state: CGST 9% + SGST 9% = 18%
//   inter-state: IGST 18%
//   export with LUT: 0% (zero-rated)
export const GST_RATE_STANDARD = 18.00;
export const GST_RATE_ZERO     = 0.00;

export const GST_SPLIT_INTRA = {
    cgst: 9.00,
    sgst: 9.00,
    igst: 0.00,
} as const;

export const GST_SPLIT_INTER = {
    cgst: 0.00,
    sgst: 0.00,
    igst: 18.00,
} as const;

// ─── Indian state codes (for place of supply & GSTIN validation) ───────────
// GSTIN first 2 digits encode state code.
export const STATE_CODES: Record<string, string> = {
    'Jammu & Kashmir': '01', 'Himachal Pradesh': '02', 'Punjab': '03',
    'Chandigarh': '04', 'Uttarakhand': '05', 'Haryana': '06', 'Delhi': '07',
    'Rajasthan': '08', 'Uttar Pradesh': '09', 'Bihar': '10', 'Sikkim': '11',
    'Arunachal Pradesh': '12', 'Nagaland': '13', 'Manipur': '14',
    'Mizoram': '15', 'Tripura': '16', 'Meghalaya': '17', 'Assam': '18',
    'West Bengal': '19', 'Jharkhand': '20', 'Odisha': '21',
    'Chhattisgarh': '22', 'Madhya Pradesh': '23', 'Gujarat': '24',
    'Daman & Diu': '25', 'Dadra & Nagar Haveli': '26', 'Maharashtra': '27',
    'Andhra Pradesh (Old)': '28', 'Karnataka': '29', 'Goa': '30',
    'Lakshadweep': '31', 'Kerala': '32', 'Tamil Nadu': '33',
    'Puducherry': '34', 'Andaman & Nicobar': '35', 'Telangana': '36',
    'Andhra Pradesh': '37', 'Ladakh': '38',
};

export const SYNAPSIS_STATE = 'Maharashtra' as const;
export const SYNAPSIS_STATE_CODE = STATE_CODES['Maharashtra'];

// ─── FEMA purpose codes (for international inward remittance) ──────────────
export const FEMA_PURPOSE_CODES = {
    IT_SOFTWARE_SERVICES:   'P0802',  // default for Synapsis
    BPO_KPO:                'P0803',
    DATA_PROCESSING:        'P0801',
    BUSINESS_CONSULTING:    'P1006',
    R_AND_D:                'P0807',
} as const;

// ─── Income Tax slabs — FY 2026-27 ─────────────────────────────────────────
// NOTE: Indian budgets revise slabs annually. Update when budget published.
// Source of these defaults: Finance Act 2024 carry-forward + Budget 2025 indications.
// If actual FY 2026-27 budget differs, bump RULE_VERSION and add new block.

export const SLABS_OLD_REGIME_FY2026 = [
    { upto:    250000, rate: 0.00 },
    { upto:    500000, rate: 0.05 },
    { upto:   1000000, rate: 0.20 },
    { upto: Infinity, rate: 0.30 },
];

export const SLABS_NEW_REGIME_FY2026 = [
    { upto:    300000, rate: 0.00 },
    { upto:    700000, rate: 0.05 },
    { upto:   1000000, rate: 0.10 },
    { upto:   1200000, rate: 0.15 },
    { upto:   1500000, rate: 0.20 },
    { upto:   2000000, rate: 0.25 },
    { upto: Infinity, rate: 0.30 },
];

// 87A rebate — full tax credit up to these limits
export const REBATE_87A_OLD_LIMIT = 500000;     // taxable income ceiling
export const REBATE_87A_OLD_AMOUNT = 12500;     // max rebate
export const REBATE_87A_NEW_LIMIT = 700000;
export const REBATE_87A_NEW_AMOUNT = 25000;

// Surcharge — applies on tax (not income)
export const SURCHARGE_TIERS = [
    { income_above:  5000000, rate: 0.10 },
    { income_above: 10000000, rate: 0.15 },
    { income_above: 20000000, rate: 0.25 },
    { income_above: 50000000, rate: 0.37 },  // new regime caps at 25%; handle in engine
];

// Health & Education Cess
export const CESS_RATE = 0.04;  // 4% on (tax + surcharge)

// ─── Section 44ADA limits ──────────────────────────────────────────────────
export const PRESUMPTIVE_44ADA_LIMIT_DIGITAL = 7500000;  // ₹75L if ≥95% digital receipts
export const PRESUMPTIVE_44ADA_LIMIT_NORMAL  = 5000000;  // ₹50L otherwise
export const PRESUMPTIVE_44ADA_DEEMED_PCT    = 0.50;

// Audit threshold for profession (44AB)
export const AUDIT_THRESHOLD_PROFESSION = 5000000;  // ₹50L — but 44ADA exempt under 75L digital

// ─── Chapter VI-A deduction limits ─────────────────────────────────────────
export const DEDUCTION_LIMITS = {
    '80C':          150000,
    '80CCD(1B)':     50000,    // extra over 80C, NPS only
    '80CCD(2)':     750000,    // employer NPS — N/A for proprietor
    '80D':           25000,    // self under 60
    '80D-parents':   25000,    // parents under 60
    '80D-parents-senior': 50000, // parents 60+
    '80E':         Infinity,   // education loan interest, no cap
    '80EE':          50000,    // first home buyer
    '80EEA':        150000,    // affordable home
    '80G':         Infinity,   // donations (subject to qualifying amount)
    '80TTA':         10000,    // savings interest
    '80TTB':         50000,    // senior citizen interest
    '24(b)':        200000,    // home loan interest
};

// ─── GST filing deadlines (relative to period end) ─────────────────────────
// Returns deadline calculator helpers in deadline-engine.ts; constants here.
export const GST_DEADLINES = {
    GSTR_1_MONTHLY:        11,   // day of next month (when monthly scheme)
    GSTR_1_QRMP_QUARTERLY: 13,   // day of month after quarter end
    GSTR_3B:               20,   // day of next month
    GSTR_9:                'dec-31',  // annual, by 31 Dec of following FY
} as const;

// ─── Income tax deadlines ──────────────────────────────────────────────────
export const INCOME_TAX_DEADLINES = {
    ITR_4:           'jul-31',     // ITR-4 filing (44ADA)
    ITR_3:           'jul-31',
    ADVANCE_TAX_Q1:  'jun-15',
    ADVANCE_TAX_Q2:  'sep-15',
    ADVANCE_TAX_Q3:  'dec-15',
    ADVANCE_TAX_Q4:  'mar-15',
    ADVANCE_TAX_44ADA_FULL: 'mar-15',
    TAX_SAVING_DEADLINE:    'mar-31',
} as const;

// ─── Other deadlines ───────────────────────────────────────────────────────
export const OTHER_DEADLINES = {
    LUT_RENEWAL:           'apr-01',
    UDYAM_UPDATE:          'apr-30',  // self-declaration update
    HEALTH_INS_RENEWAL:    'annual',  // policy-specific
} as const;

// ─── Reminder offsets (days before due_date) ───────────────────────────────
export const REMINDER_OFFSETS_DAYS = [7, 3, 1] as const;

// ─── FX rate source (for invoice INR equivalent) ───────────────────────────
export const FX_RATE_SOURCE_DEFAULT = 'sbi_tt_reference';

// ─── Currency minor unit factors ───────────────────────────────────────────
export const MINOR_PER_MAJOR: Record<string, number> = {
    INR: 100,
    USD: 100,
    EUR: 100,
    GBP: 100,
    SGD: 100,
    AUD: 100,
    CAD: 100,
    AED: 100,
};

export function minorUnit(currency: string): number {
    return MINOR_PER_MAJOR[currency.toUpperCase()] ?? 100;
}
