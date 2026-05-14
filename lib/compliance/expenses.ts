// ─── EXPENSE TRACKING — server helpers ─────────────────────────────────────
// CRUD + aggregation for synapsis.expenses. The API surface the upcoming
// Expense Tracking UI (and Gmail auto-fetch cron) will call.

import 'server-only';
import { supabase } from '@/lib/supabase';
import type { Expense, ExpenseCategory, ExpenseSource } from './types';
import { fyBoundsForDate, fyBoundsFromLabel } from './deadline-planner';
import { toIsoDate } from './date-utils';

// ─── Input shape for creating an expense ───────────────────────────────────

export interface NewExpenseInput {
    expense_date: string;             // yyyy-mm-dd
    vendor: string;
    description?: string;
    category_code?: string;
    amount_paise: number;             // total amount paid (incl GST)
    gst_amount_paise?: number;        // 0 if no GST / not ITC eligible
    gst_rate?: number;
    original_currency?: string;       // 'INR' default
    original_amount_minor?: number;
    fx_rate?: number;
    itc_eligible?: boolean;
    vendor_gstin?: string;
    vendor_invoice_number?: string;
    receipt_url?: string;
    source?: ExpenseSource;
    source_reference?: string;        // for dedup (email msg-id etc.)
    is_capex?: boolean;
    depreciation_rate?: number;
    useful_life_years?: number;
    notes?: string;
}

/**
 * Create an expense row. Derives taxable_paise = amount − gst.
 * Dedup: if source+source_reference already exists, returns existing row.
 */
export async function createExpense(input: NewExpenseInput): Promise<{ expense: Expense; deduped: boolean }> {
    // Dedup check
    if (input.source && input.source_reference) {
        const { data: existing } = await supabase
            .from('expenses')
            .select('*')
            .eq('source', input.source)
            .eq('source_reference', input.source_reference)
            .maybeSingle();
        if (existing) {
            return { expense: existing as Expense, deduped: true };
        }
    }

    const gst = input.gst_amount_paise ?? 0;
    const taxable = input.amount_paise - gst;
    if (taxable < 0) {
        throw new Error('createExpense: gst_amount_paise cannot exceed amount_paise');
    }

    const row = {
        expense_date: input.expense_date,
        vendor: input.vendor,
        description: input.description ?? null,
        category_code: input.category_code ?? 'other',
        amount_paise: input.amount_paise,
        taxable_paise: taxable,
        gst_amount_paise: gst,
        gst_rate: input.gst_rate ?? null,
        original_currency: input.original_currency ?? 'INR',
        original_amount_minor: input.original_amount_minor ?? null,
        fx_rate: input.fx_rate ?? null,
        itc_eligible: input.itc_eligible ?? (gst > 0),
        itc_claimed: false,
        vendor_gstin: input.vendor_gstin ?? null,
        vendor_invoice_number: input.vendor_invoice_number ?? null,
        receipt_url: input.receipt_url ?? null,
        source: input.source ?? 'manual',
        source_reference: input.source_reference ?? null,
        is_capex: input.is_capex ?? false,
        depreciation_rate: input.depreciation_rate ?? null,
        useful_life_years: input.useful_life_years ?? null,
        notes: input.notes ?? null,
    };

    const { data, error } = await supabase
        .from('expenses')
        .insert(row)
        .select('*')
        .single();
    if (error || !data) {
        throw new Error(`createExpense failed: ${error?.message ?? 'no row returned'}`);
    }
    return { expense: data as Expense, deduped: false };
}

// ─── List / filter ─────────────────────────────────────────────────────────

export interface ExpenseFilter {
    fromDate?: string;
    toDate?: string;
    categoryCode?: string;
    itcEligibleOnly?: boolean;
    itcUnclaimedOnly?: boolean;
    vendor?: string;
    limit?: number;
}

export async function listExpenses(filter: ExpenseFilter = {}): Promise<Expense[]> {
    let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
    if (filter.fromDate) q = q.gte('expense_date', filter.fromDate);
    if (filter.toDate) q = q.lte('expense_date', filter.toDate);
    if (filter.categoryCode) q = q.eq('category_code', filter.categoryCode);
    if (filter.itcEligibleOnly) q = q.eq('itc_eligible', true);
    if (filter.itcUnclaimedOnly) q = q.eq('itc_eligible', true).eq('itc_claimed', false);
    if (filter.vendor) q = q.ilike('vendor', `%${filter.vendor}%`);
    if (filter.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw new Error(`listExpenses: ${error.message}`);
    return (data ?? []) as Expense[];
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
    const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('sort_order', { ascending: true });
    if (error) throw new Error(`listExpenseCategories: ${error.message}`);
    return (data ?? []) as ExpenseCategory[];
}

// ─── Aggregation ───────────────────────────────────────────────────────────

export interface ExpenseTotals {
    fiscal_year: string;
    total_amount_paise: number;
    total_taxable_paise: number;
    total_gst_paise: number;
    itc_eligible_paise: number;       // gst portion that is ITC eligible
    itc_claimed_paise: number;
    itc_unclaimed_paise: number;
    by_category: Record<string, { amount_paise: number; count: number }>;
    count: number;
}

const num = (v: unknown): number => {
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'number') return v;
    return Number(v ?? 0);
};

/**
 * Aggregate expenses for a fiscal year. Drives the Books module + GSTR-3B ITC.
 */
export async function expenseTotalsForFY(fyLabel?: string): Promise<ExpenseTotals> {
    const fy = fyLabel ? fyBoundsFromLabel(fyLabel) : fyBoundsForDate();
    const fromDate = toIsoDate(fy.start);
    const toDate = toIsoDate(fy.end);
    const label = fy.fy_label;

    const rows = await listExpenses({ fromDate, toDate });

    const totals: ExpenseTotals = {
        fiscal_year: label,
        total_amount_paise: 0,
        total_taxable_paise: 0,
        total_gst_paise: 0,
        itc_eligible_paise: 0,
        itc_claimed_paise: 0,
        itc_unclaimed_paise: 0,
        by_category: {},
        count: rows.length,
    };

    for (const e of rows) {
        const amount = num(e.amount_paise);
        const gst = num(e.gst_amount_paise);
        totals.total_amount_paise += amount;
        totals.total_taxable_paise += num(e.taxable_paise);
        totals.total_gst_paise += gst;
        if (e.itc_eligible) {
            totals.itc_eligible_paise += gst;
            if (e.itc_claimed) totals.itc_claimed_paise += gst;
            else totals.itc_unclaimed_paise += gst;
        }
        const cat = e.category_code ?? 'other';
        if (!totals.by_category[cat]) totals.by_category[cat] = { amount_paise: 0, count: 0 };
        totals.by_category[cat].amount_paise += amount;
        totals.by_category[cat].count += 1;
    }

    return totals;
}

// ─── Mark ITC claimed (after GSTR-3B filing) ───────────────────────────────

export async function markItcClaimed(
    expenseIds: string[],
    gstr3bReference: string
): Promise<number> {
    if (expenseIds.length === 0) return 0;
    const { data, error } = await supabase
        .from('expenses')
        .update({ itc_claimed: true, itc_claimed_in_return: gstr3bReference })
        .in('id', expenseIds)
        .select('id');
    if (error) throw new Error(`markItcClaimed: ${error.message}`);
    return (data ?? []).length;
}

// ─── Update / delete ───────────────────────────────────────────────────────

export async function updateExpense(id: string, patch: Partial<NewExpenseInput>): Promise<Expense> {
    // Recompute taxable if amount or gst changed
    const updates: Record<string, unknown> = { ...patch };
    if (patch.amount_paise !== undefined || patch.gst_amount_paise !== undefined) {
        const { data: current } = await supabase.from('expenses').select('*').eq('id', id).single();
        if (current) {
            const amount = patch.amount_paise ?? num(current.amount_paise);
            const gst = patch.gst_amount_paise ?? num(current.gst_amount_paise);
            updates.taxable_paise = amount - gst;
        }
    }
    const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
    if (error || !data) throw new Error(`updateExpense: ${error?.message ?? 'no row'}`);
    return data as Expense;
}

export async function deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(`deleteExpense: ${error.message}`);
}
