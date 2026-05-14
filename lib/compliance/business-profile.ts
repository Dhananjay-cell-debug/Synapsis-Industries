// ─── BUSINESS TAX PROFILE — server-side accessor ───────────────────────────
// Single source of truth for Synapsis identity (GSTIN, LUT, regime, etc).
// Reads from synapsis.business_tax_profile (singleton row).
//
// Browser-safe display fields still live in synapsis-config.ts (brand, contact,
// address-display, colors). Sensitive identifiers (full GSTIN, full PAN, full
// account number) come from this module — server-only.

import 'server-only';
import { supabase } from '@/lib/supabase';
import type { BusinessTaxProfile } from './types';

let cached: { profile: BusinessTaxProfile; at: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60s — profile changes are rare

export async function getBusinessTaxProfile(force = false): Promise<BusinessTaxProfile> {
    const now = Date.now();
    if (!force && cached && (now - cached.at) < CACHE_TTL_MS) {
        return cached.profile;
    }

    // supabase client is already pinned to 'synapsis' schema in lib/supabase.ts
    const { data, error } = await supabase
        .from('business_tax_profile')
        .select('*')
        .eq('is_active', true)
        .single();

    if (error || !data) {
        throw new Error(`business_tax_profile not found: ${error?.message ?? 'no row'}`);
    }

    cached = { profile: data as BusinessTaxProfile, at: now };
    return cached.profile;
}

export function clearBusinessProfileCache() {
    cached = null;
}

// ─── Server-only sensitive identifiers ─────────────────────────────────────
// Pulled from env so they never reach the browser bundle.
//
// REQUIRED ENV VARS (when GSTIN becomes active):
//   SYNAPSIS_PAN_FULL          — full 10-char PAN (e.g. AAAPA0000A)
//   SYNAPSIS_GSTIN_FULL        — full 15-char GSTIN
//   SYNAPSIS_BANK_ACCOUNT_FULL — full account number
//   SYNAPSIS_BANK_IFSC         — IFSC (already in NEXT_PUBLIC config too)
//
// Behavior: returns null if env not set. Caller must handle (e.g. show "pending").

export function getSensitiveIdentifiers() {
    return {
        pan_full:          process.env.SYNAPSIS_PAN_FULL          ?? null,
        gstin_full:        process.env.SYNAPSIS_GSTIN_FULL        ?? null,
        bank_account_full: process.env.SYNAPSIS_BANK_ACCOUNT_FULL ?? null,
        bank_ifsc:         process.env.SYNAPSIS_BANK_IFSC         ?? null,
    };
}

// ─── Convenience predicates ────────────────────────────────────────────────

export async function isGstActive(): Promise<boolean> {
    const p = await getBusinessTaxProfile();
    return p.gst_status === 'active' && !!p.gstin;
}

export async function isLutActive(): Promise<boolean> {
    const p = await getBusinessTaxProfile();
    if (!p.lut_active) return false;
    if (p.lut_valid_until) {
        const validUntil = new Date(p.lut_valid_until);
        if (validUntil.getTime() < Date.now()) return false;
    }
    return true;
}

export async function getEffectiveRegime(): Promise<'old' | 'new'> {
    const p = await getBusinessTaxProfile();
    if (p.income_tax_regime === 'auto') {
        // Engine recomputes per FY; default for now is 'new' since receipts are
        // modest and deduction stack is being built. Override per-FY in profile.
        return 'new';
    }
    return p.income_tax_regime;
}
