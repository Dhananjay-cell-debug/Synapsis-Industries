// ─── TAX ENGINE — pure-function compliance brain ───────────────────────────
// All tax logic lives here. No DB calls. No I/O. Pure & testable.
//
// Spec: docs/compliance/TAX-STRATEGY.md
// Constants: lib/compliance/constants.ts
//
// All money inputs/outputs are in paise (or invoice-currency minor units).
// Integer math everywhere — no floating-point money.

import {
    RULE_VERSION,
    SAC_CODES,
    SLABS_NEW_REGIME_FY2026,
    SLABS_OLD_REGIME_FY2026,
    REBATE_87A_NEW_AMOUNT,
    REBATE_87A_NEW_LIMIT,
    REBATE_87A_OLD_AMOUNT,
    REBATE_87A_OLD_LIMIT,
    SURCHARGE_TIERS,
    CESS_RATE,
    PRESUMPTIVE_44ADA_DEEMED_PCT,
    PRESUMPTIVE_44ADA_LIMIT_DIGITAL,
    DEDUCTION_LIMITS,
    GST_RATE_STANDARD,
    GST_SPLIT_INTRA,
    SYNAPSIS_STATE,
} from './constants';
import type {
    DeductionStack,
    GstClassifyInput,
    GstClassifyOutput,
    IncomeRegime,
    TaxEstimateInput,
    TaxEstimateOutput,
} from './types';
import { isoDate, utcDate, toIsoDate, daysBetween } from './date-utils';

// ─── Money helpers ─────────────────────────────────────────────────────────
const round = Math.round;

/**
 * Apply progressive slabs to taxable income (in rupees, not paise).
 * Returns tax in rupees.
 */
function applySlabs(taxableRupees: number, slabs: { upto: number; rate: number }[]): number {
    if (taxableRupees <= 0) return 0;
    let remaining = taxableRupees;
    let prev = 0;
    let tax = 0;
    for (const { upto, rate } of slabs) {
        const band = Math.min(remaining, upto - prev);
        if (band <= 0) break;
        tax += band * rate;
        remaining -= band;
        prev = upto;
        if (remaining <= 0) break;
    }
    return tax;
}

/**
 * 87A rebate — wipes out small tax bills entirely.
 * Old regime: full rebate if taxable income ≤ ₹5L (max ₹12,500).
 * New regime: full rebate if taxable income ≤ ₹7L (max ₹25,000).
 */
function applyRebate87A(tax: number, taxableRupees: number, regime: 'old' | 'new'): number {
    if (regime === 'old') {
        if (taxableRupees <= REBATE_87A_OLD_LIMIT) {
            return Math.max(0, tax - REBATE_87A_OLD_AMOUNT);
        }
        return tax;
    } else {
        if (taxableRupees <= REBATE_87A_NEW_LIMIT) {
            return Math.max(0, tax - REBATE_87A_NEW_AMOUNT);
        }
        return tax;
    }
}

/**
 * Surcharge on tax based on total income tier.
 * New regime caps surcharge at 25% (no 37% bracket).
 */
function applySurcharge(tax: number, incomeRupees: number, regime: 'old' | 'new'): number {
    let rate = 0;
    for (const tier of SURCHARGE_TIERS) {
        if (incomeRupees > tier.income_above) rate = tier.rate;
    }
    if (regime === 'new' && rate > 0.25) rate = 0.25;
    return tax + tax * rate;
}

/**
 * Health & Education Cess (4% on tax+surcharge).
 */
function applyCess(taxWithSurcharge: number): number {
    return taxWithSurcharge * (1 + CESS_RATE);
}

// ─── 44ADA deemed income ───────────────────────────────────────────────────

export function compute44ADADeemedIncomePaise(
    receiptsPaise: number,
    declaredHigherPaise?: number
): number {
    const deemed = Math.floor(receiptsPaise * PRESUMPTIVE_44ADA_DEEMED_PCT);
    if (declaredHigherPaise && declaredHigherPaise > deemed) return declaredHigherPaise;
    return deemed;
}

/**
 * Whether 44ADA still applies for the given FY receipts (after digital-receipts
 * relaxation to ₹75L).
 */
export function is44ADAEligible(receiptsPaise: number): boolean {
    return receiptsPaise <= PRESUMPTIVE_44ADA_LIMIT_DIGITAL * 100;
}

// ─── Deduction total (Chapter VI-A) ────────────────────────────────────────

export function totalDeductionsPaise(stack: DeductionStack, regime: 'old' | 'new'): number {
    // Under new regime, Chapter VI-A deductions are NOT allowed except 80CCD(2)
    // which is N/A for a proprietor.
    if (regime === 'new') return 0;

    let total = 0;
    for (const section of Object.keys(stack) as (keyof DeductionStack)[]) {
        const raw = stack[section] ?? 0;
        const limitRupees = (DEDUCTION_LIMITS as Record<string, number>)[section];
        const limitPaise = (limitRupees ?? Infinity) * 100;
        total += Math.min(raw, limitPaise);
    }
    return total;
}

// ─── Tax under one regime ──────────────────────────────────────────────────

interface OneRegimeOutput {
    taxable_income_paise: number;
    tax_before_rebate_paise: number;
    rebate_87a_paise: number;
    tax_after_rebate_paise: number;
    surcharge_paise: number;
    cess_paise: number;
    total_tax_paise: number;
}

export function taxUnderRegime(
    deemedIncomePaise: number,
    deductionsTotalPaise: number,
    regime: 'old' | 'new'
): OneRegimeOutput {
    const taxableIncomePaise = Math.max(0, deemedIncomePaise - deductionsTotalPaise);
    const taxableRupees = taxableIncomePaise / 100;

    const slabs = regime === 'old' ? SLABS_OLD_REGIME_FY2026 : SLABS_NEW_REGIME_FY2026;
    const baseTaxRupees = applySlabs(taxableRupees, slabs);
    const afterRebateRupees = applyRebate87A(baseTaxRupees, taxableRupees, regime);
    const withSurchargeRupees = applySurcharge(afterRebateRupees, taxableRupees, regime);
    const withCessRupees = applyCess(withSurchargeRupees);

    return {
        taxable_income_paise: taxableIncomePaise,
        tax_before_rebate_paise: round(baseTaxRupees * 100),
        rebate_87a_paise: round((baseTaxRupees - afterRebateRupees) * 100),
        tax_after_rebate_paise: round(afterRebateRupees * 100),
        surcharge_paise: round((withSurchargeRupees - afterRebateRupees) * 100),
        cess_paise: round((withCessRupees - withSurchargeRupees) * 100),
        total_tax_paise: round(withCessRupees * 100),
    };
}

// ─── Main estimate engine ──────────────────────────────────────────────────

export function estimateFYTax(input: TaxEstimateInput): TaxEstimateOutput {
    const receipts = input.receipts_inr_paise;
    const deemed = compute44ADADeemedIncomePaise(receipts, input.declared_higher_income_paise);

    // Old regime: deductions apply
    const oldDeductions = totalDeductionsPaise(input.deductions, 'old');
    const oldOut = taxUnderRegime(deemed, oldDeductions, 'old');

    // New regime: deductions ignored
    const newOut = taxUnderRegime(deemed, 0, 'new');

    // Pick recommendation
    let recommended: 'old' | 'new';
    if (input.regime === 'old') recommended = 'old';
    else if (input.regime === 'new') recommended = 'new';
    else recommended = oldOut.total_tax_paise <= newOut.total_tax_paise ? 'old' : 'new';

    const recommendedTax = recommended === 'old' ? oldOut.total_tax_paise : newOut.total_tax_paise;
    const advPaid = input.advance_tax_paid_paise ?? 0;
    const tdsCredit = input.tds_credit_paise ?? 0;
    const netPayable = Math.max(0, recommendedTax - advPaid - tdsCredit);

    // 44ADA: full advance tax due by 15 March of FY
    const today = new Date();
    const fyEndYear = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
    const advanceDateStr = isoDate(fyEndYear, 2, 15); // March (month idx 2) 15

    const notes: string[] = [];
    if (!is44ADAEligible(receipts)) {
        notes.push('Receipts exceed ₹75L digital cap — 44ADA no longer applies. Regular books + audit required.');
    }
    if (oldDeductions > 0 && recommended === 'new') {
        notes.push('Deductions claimed but new regime recommended — deductions are ignored under new regime. Consider whether deductions are still worth maintaining.');
    }
    if (recommendedTax < 10000_00) {
        notes.push('Tax liability under ₹10,000 — advance tax payment is technically not required.');
    }

    return {
        receipts_paise: receipts,
        deemed_income_paise: deemed,
        deductions_total_paise: oldDeductions,
        taxable_income_old_paise: oldOut.taxable_income_paise,
        taxable_income_new_paise: newOut.taxable_income_paise,
        tax_old_regime_paise: oldOut.total_tax_paise,
        tax_new_regime_paise: newOut.total_tax_paise,
        recommended_regime: recommended,
        effective_tax_rate: receipts > 0 ? recommendedTax / receipts : 0,
        net_payable_paise: netPayable,
        advance_tax_due_paise: recommendedTax, // 44ADA: full by 15 Mar
        next_action_date: advanceDateStr,
        notes,
    };
}

// ─── GST classifier ────────────────────────────────────────────────────────
// Decides treatment for a single invoice. Pure function; stamps rule_version
// so historical decisions never silently change.

export function classifyGstTreatment(input: GstClassifyInput): GstClassifyOutput {
    const sac = input.sac_code ?? SAC_CODES.IT_DESIGN_DEV;
    const rate = input.gst_rate ?? GST_RATE_STANDARD;
    const taxable = input.taxable_value_minor;

    const businessState = input.business.address_state || SYNAPSIS_STATE;
    const clientCountry = (input.client.billing_country || 'India').trim();
    const isInternational = clientCountry.toLowerCase() !== 'india' || input.invoice_currency === 'USD';

    // ─── EXPORT (international) ────────────────────────────────────────────
    if (isInternational) {
        const pos = clientCountry || 'Outside India';
        if (input.business.lut_active) {
            return {
                treatment: 'export_lut_zero_rated',
                treatment_reason: 'International recipient + LUT active → zero-rated export of services.',
                place_of_supply: pos,
                sac_code: sac,
                gst_rate: 0,
                cgst_amount_minor: 0,
                sgst_amount_minor: 0,
                igst_amount_minor: 0,
                total_tax_minor: 0,
                total_invoice_minor: taxable,
                zero_rated: true,
                reverse_charge: false,
                rule_version: RULE_VERSION,
            };
        } else {
            const igst = round((taxable * rate) / 100);
            return {
                treatment: 'export_with_igst',
                treatment_reason: 'International recipient but LUT not active → IGST 18% charged; refund claim path applies.',
                place_of_supply: pos,
                sac_code: sac,
                gst_rate: rate,
                cgst_amount_minor: 0,
                sgst_amount_minor: 0,
                igst_amount_minor: igst,
                total_tax_minor: igst,
                total_invoice_minor: taxable + igst,
                zero_rated: false,
                reverse_charge: false,
                rule_version: RULE_VERSION,
            };
        }
    }

    // ─── DOMESTIC ──────────────────────────────────────────────────────────
    const clientState = (input.client.billing_state || '').trim();
    const isIntraState = clientState && clientState.toLowerCase() === businessState.toLowerCase();
    const isB2B = input.client.recipient_type === 'indian_registered' && !!input.client.client_gstin;

    if (isIntraState) {
        const cgst = round((taxable * GST_SPLIT_INTRA.cgst) / 100);
        const sgst = round((taxable * GST_SPLIT_INTRA.sgst) / 100);
        return {
            treatment: isB2B ? 'intra_state' : 'b2c_intra',
            treatment_reason: `Client in ${clientState} (same as business state) → CGST 9% + SGST 9%${isB2B ? ' (B2B)' : ' (B2C)'}.`,
            place_of_supply: clientState || businessState,
            sac_code: sac,
            gst_rate: rate,
            cgst_amount_minor: cgst,
            sgst_amount_minor: sgst,
            igst_amount_minor: 0,
            total_tax_minor: cgst + sgst,
            total_invoice_minor: taxable + cgst + sgst,
            zero_rated: false,
            reverse_charge: false,
            rule_version: RULE_VERSION,
        };
    }

    // Inter-state OR client state unknown (default to inter-state IGST, safer)
    const igst = round((taxable * rate) / 100);
    return {
        treatment: isB2B ? 'inter_state' : 'b2c_inter',
        treatment_reason: clientState
            ? `Client in ${clientState} (different from business state) → IGST 18%${isB2B ? ' (B2B)' : ' (B2C)'}.`
            : `Client state unknown → defaulting to inter-state IGST 18% (safer). Update client profile.`,
        place_of_supply: clientState || 'Unknown — defaulted to inter-state',
        sac_code: sac,
        gst_rate: rate,
        cgst_amount_minor: 0,
        sgst_amount_minor: 0,
        igst_amount_minor: igst,
        total_tax_minor: igst,
        total_invoice_minor: taxable + igst,
        zero_rated: false,
        reverse_charge: false,
        rule_version: RULE_VERSION,
    };
}

// ─── Advance Tax planner (44ADA: single installment by 15 Mar) ─────────────

export interface AdvanceTaxPlan {
    fiscal_year: string;
    full_amount_paise: number;
    due_date: string;            // 15 March of FY-end
    paid_so_far_paise: number;
    remaining_paise: number;
    days_remaining: number;
    is_overdue: boolean;
}

export function planAdvanceTax(
    estimatedTotalTaxPaise: number,
    paidSoFarPaise: number = 0,
    today: Date = new Date()
): AdvanceTaxPlan {
    // Determine FY: Apr-Mar
    const month = today.getMonth(); // 0-11
    const year = today.getFullYear();
    const fyStartYear = month >= 3 ? year : year - 1;
    const fyEndYear = fyStartYear + 1;
    const fyLabel = `FY${fyStartYear}-${String(fyEndYear).slice(-2)}`;

    const dueDate = utcDate(fyEndYear, 2, 15); // March 15
    const dueDateStr = toIsoDate(dueDate);
    const daysRemaining = daysBetween(today, dueDate);

    return {
        fiscal_year: fyLabel,
        full_amount_paise: estimatedTotalTaxPaise,
        due_date: dueDateStr,
        paid_so_far_paise: paidSoFarPaise,
        remaining_paise: Math.max(0, estimatedTotalTaxPaise - paidSoFarPaise),
        days_remaining: daysRemaining,
        is_overdue: daysRemaining < 0 && paidSoFarPaise < estimatedTotalTaxPaise,
    };
}

// ─── GSTIN format validator (15-char) ──────────────────────────────────────
// Format: 2-digit state code + 10-char PAN + 1 entity code + Z + 1 checksum.
// Light validator (no checksum). Useful for client profile input UX.

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstinFormat(gstin: string | null | undefined): boolean {
    if (!gstin) return false;
    return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

export function gstinStateCode(gstin: string): string | null {
    if (!isValidGstinFormat(gstin)) return null;
    return gstin.trim().substring(0, 2);
}

// ─── PAN format validator ──────────────────────────────────────────────────

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export function isValidPanFormat(pan: string | null | undefined): boolean {
    if (!pan) return false;
    return PAN_REGEX.test(pan.trim().toUpperCase());
}
