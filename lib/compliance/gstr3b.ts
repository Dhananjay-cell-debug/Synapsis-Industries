// ─── GSTR-3B BUILDER — section-by-section summary for manual portal entry ──
// GSTR-3B is filled by typing numbers into the portal (no JSON upload like
// GSTR-1). This lib produces the exact values per portal section so the
// founder can read + paste with confidence.
//
// Portal sections covered:
//   3.1(a) — Outward taxable supplies (other than zero-rated, nil, exempt)
//   3.1(b) — Outward taxable supplies (zero-rated)
//   3.1(c) — Other outward supplies (nil rated, exempted)
//   3.1(d) — Inward supplies liable to reverse charge   [not used yet]
//   3.1(e) — Non-GST outward supplies                    [not used yet]
//   4(A)   — ITC Available
//   4(B)   — ITC Reversed                                [not used yet]
//   4(C)   — Net ITC = 4(A) − 4(B)
//   6.1    — Net tax payable = output tax − net ITC

import "server-only";
import { supabase } from "@/lib/supabase";
import { getBusinessTaxProfile } from "./business-profile";

const n = (v: unknown): number =>
    typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0);

export interface GSTR3BSummary {
    period: string;              // "2026-05"
    period_start: string;        // ISO
    period_end: string;
    business_gstin: string;
    generated_at: string;

    // Section 3.1 — Outward + RCM
    s3_1_a: { taxable_paise: number; igst: number; cgst: number; sgst: number; cess: number };
    s3_1_b: { taxable_paise: number; igst: number; cess: number };   // zero-rated (exports/SEZ)
    s3_1_c: { taxable_paise: number };                                // nil-rated / exempt
    s3_1_d: { taxable_paise: number; igst: number; cgst: number; sgst: number; cess: number };  // reverse charge
    s3_1_e: { taxable_paise: number };                                // non-GST

    // Section 4 — ITC
    s4_a_total: number;                          // sum of all ITC available
    s4_a_breakup: {
        imports: number;
        rcm: number;
        isd: number;
        other_itc: number;
    };
    s4_b_reversed: number;
    s4_c_net: number;

    // Section 6.1 — Net tax payable
    output_tax_total: number;
    net_payable: number;

    // Helpful side-data
    invoiceCount: number;
    expenseCount: number;
    itcClaimableCount: number;

    warnings: string[];
}

function monthBounds(year: number, month: number): { start: string; end: string } {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));  // last day of month
    return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
    };
}

export async function buildGSTR3B(year: number, month: number): Promise<GSTR3BSummary> {
    if (month < 1 || month > 12) throw new Error(`Invalid month: ${month}`);
    if (year < 2026 || year > 2050) throw new Error(`Invalid year: ${year}`);

    const profile = await getBusinessTaxProfile();
    if (!profile.gstin) {
        throw new Error("Business GSTIN not set — activate it in Tax Profile before generating GSTR-3B.");
    }

    const { start, end } = monthBounds(year, month);
    const period = `${year}-${String(month).padStart(2, "0")}`;
    const warnings: string[] = [];

    // ─── Outward supplies — from invoices + tax snapshots in this month ────
    const { data: invs, error: invErr } = await supabase
        .from("invoices")
        .select("id, currency, issued_at")
        .gte("issued_at", start)
        .lte("issued_at", end + "T23:59:59Z");
    if (invErr) throw new Error(`GSTR-3B: invoices fetch — ${invErr.message}`);

    const invoiceIds = (invs ?? []).map((r) => r.id as string);
    const { data: snaps, error: snapErr } = invoiceIds.length > 0
        ? await supabase.from("invoice_tax_snapshot").select("*").in("invoice_id", invoiceIds)
        : { data: [], error: null };
    if (snapErr) throw new Error(`GSTR-3B: snapshots fetch — ${snapErr.message}`);

    // Accumulate per section
    let a_tax = 0, a_igst = 0, a_cgst = 0, a_sgst = 0, a_cess = 0;
    let b_tax = 0, b_igst = 0, b_cess = 0;
    let c_tax = 0;
    let d_tax = 0, d_igst = 0, d_cgst = 0, d_sgst = 0, d_cess = 0;
    let e_tax = 0;

    for (const s of (snaps ?? []) as Record<string, unknown>[]) {
        const treatment = s.treatment as string;
        const currency = (s.invoice_currency as string) || "INR";
        const taxable = currency === "INR"
            ? n(s.taxable_value_minor)
            : (s.inr_equivalent_paise != null ? n(s.inr_equivalent_paise) : n(s.taxable_value_minor));
        const cgst = currency === "INR" ? n(s.cgst_amount_minor) : 0;
        const sgst = currency === "INR" ? n(s.sgst_amount_minor) : 0;
        const igst = currency === "INR" ? n(s.igst_amount_minor) : 0;

        if (treatment === "intra_state" || treatment === "inter_state"
            || treatment === "b2c_intra" || treatment === "b2c_inter") {
            // 3.1(a) — Outward taxable (regular)
            a_tax += taxable; a_igst += igst; a_cgst += cgst; a_sgst += sgst;
        } else if (treatment === "export_lut_zero_rated") {
            // 3.1(b) — Zero-rated (LUT export)
            b_tax += taxable;
            // iamt 0 under LUT
        } else if (treatment === "export_with_igst") {
            // 3.1(b) — Zero-rated (with IGST)
            b_tax += taxable; b_igst += igst;
        } else if (treatment === "exempt") {
            c_tax += taxable;
        } else if (treatment === "reverse_charge") {
            d_tax += taxable; d_igst += igst; d_cgst += cgst; d_sgst += sgst;
        }
    }

    // ─── ITC — from itc_eligible expenses booked in this month ─────────────
    const { data: expRows, error: expErr } = await supabase
        .from("expenses")
        .select("amount_paise, gst_amount_paise, itc_eligible, itc_claimed, category_code, expense_date")
        .gte("expense_date", start)
        .lte("expense_date", end)
        .eq("itc_eligible", true);
    if (expErr) throw new Error(`GSTR-3B: expenses fetch — ${expErr.message}`);

    let itcAvailable = 0;
    let imports = 0, rcm = 0, isd = 0, other_itc = 0;
    let itcClaimable = 0;
    for (const e of (expRows ?? []) as Record<string, unknown>[]) {
        const gst = n(e.gst_amount_paise);
        if (gst > 0 && !e.itc_claimed) {
            itcAvailable += gst;
            itcClaimable += 1;
            // Crude bucketing — most Synapsis ITC is "other ITC" (domestic SaaS/services)
            other_itc += gst;
        }
    }

    const s4_a_total = itcAvailable;
    const s4_b_reversed = 0;
    const s4_c_net = s4_a_total - s4_b_reversed;

    const outputTax = a_igst + a_cgst + a_sgst + a_cess + b_igst + d_igst + d_cgst + d_sgst;
    const netPayable = Math.max(0, outputTax - s4_c_net);

    if (a_tax === 0 && b_tax === 0 && (snaps ?? []).length === 0) {
        warnings.push("No invoices in this period — return will be a nil filing.");
    }
    if (s4_a_total > outputTax) {
        warnings.push(`ITC available (₹${(s4_a_total / 100).toFixed(2)}) exceeds output tax (₹${(outputTax / 100).toFixed(2)}). Excess will carry forward.`);
    }

    return {
        period,
        period_start: start,
        period_end: end,
        business_gstin: profile.gstin,
        generated_at: new Date().toISOString(),
        s3_1_a: { taxable_paise: a_tax, igst: a_igst, cgst: a_cgst, sgst: a_sgst, cess: a_cess },
        s3_1_b: { taxable_paise: b_tax, igst: b_igst, cess: b_cess },
        s3_1_c: { taxable_paise: c_tax },
        s3_1_d: { taxable_paise: d_tax, igst: d_igst, cgst: d_cgst, sgst: d_sgst, cess: d_cess },
        s3_1_e: { taxable_paise: e_tax },
        s4_a_total,
        s4_a_breakup: { imports, rcm, isd, other_itc },
        s4_b_reversed,
        s4_c_net,
        output_tax_total: outputTax,
        net_payable: netPayable,
        invoiceCount: (invs ?? []).length,
        expenseCount: (expRows ?? []).length,
        itcClaimableCount: itcClaimable,
        warnings,
    };
}
