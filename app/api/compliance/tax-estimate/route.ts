// ─── COMPLIANCE — TAX ESTIMATE ─────────────────────────────────────────────
// GET /api/compliance/tax-estimate → real receipts + real deductions + estimate.
// The frontend recomputes live with sliders (tax-engine is client-safe).
// Admin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getBusinessTaxProfile } from "@/lib/compliance/business-profile";
import { estimateFYTax, planAdvanceTax } from "@/lib/compliance/tax-engine";
import { fyBoundsForDate } from "@/lib/compliance/deadline-planner";
import type { DeductionStack } from "@/lib/compliance/types";

export const runtime = "nodejs";

const n = (v: unknown): number =>
    typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0);

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    try {
        const fy = fyBoundsForDate();
        const fromIso = fy.start.toISOString().slice(0, 10);
        const toIso = fy.end.toISOString().slice(0, 10);

        const [profile, paymentsRes, forexRes, deductionsRes, advTaxRes] = await Promise.all([
            getBusinessTaxProfile(),
            supabase.from("payments").select("amount_paise, currency, status, paid_at")
                .eq("status", "paid").gte("paid_at", fromIso).lte("paid_at", toIso + "T23:59:59Z"),
            supabase.from("forex_inward").select("inr_amount_paise, payment_date")
                .gte("payment_date", fromIso).lte("payment_date", toIso),
            supabase.from("deductions").select("section, sub_category, amount_paise")
                .eq("fiscal_year", fy.fy_label),
            supabase.from("advance_tax_payments").select("amount_paise")
                .eq("fiscal_year", fy.fy_label),
        ]);

        let receiptsPaise = 0;
        let domesticPaise = 0;
        let exportPaise = 0;
        for (const p of paymentsRes.data ?? []) {
            if (p.currency === "INR") {
                receiptsPaise += n(p.amount_paise);
                domesticPaise += n(p.amount_paise);
            }
        }
        for (const f of forexRes.data ?? []) {
            receiptsPaise += n(f.inr_amount_paise);
            exportPaise += n(f.inr_amount_paise);
        }

        const deductions: DeductionStack = {};
        for (const d of deductionsRes.data ?? []) {
            const sec = d.section as keyof DeductionStack;
            deductions[sec] = (deductions[sec] ?? 0) + n(d.amount_paise);
        }

        let advancePaid = 0;
        for (const a of advTaxRes.data ?? []) advancePaid += n(a.amount_paise);

        const estimate = estimateFYTax({
            receipts_inr_paise: receiptsPaise,
            deductions,
            regime: profile.income_tax_regime,
            advance_tax_paid_paise: advancePaid,
        });

        const advancePlan = planAdvanceTax(estimate.advance_tax_due_paise, advancePaid);

        return NextResponse.json({
            fy_label: fy.fy_label,
            regime_preference: profile.income_tax_regime,
            presumptive_scheme: profile.presumptive_scheme,
            real: {
                receiptsPaise,
                domesticPaise,
                exportPaise,
                deductions,
                advanceTaxPaidPaise: advancePaid,
            },
            estimate,
            advancePlan,
        });
    } catch (e) {
        console.error("[compliance/tax-estimate] error:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "tax estimate failed" },
            { status: 500 }
        );
    }
}
