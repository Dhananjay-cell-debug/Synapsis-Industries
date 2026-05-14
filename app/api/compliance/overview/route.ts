// ─── COMPLIANCE — OVERVIEW ─────────────────────────────────────────────────
// GET /api/compliance/overview → aggregated dashboard payload.
// Admin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getBusinessTaxProfile } from "@/lib/compliance/business-profile";
import { upcomingTasks, overdueTasks } from "@/lib/compliance/deadline-engine";
import { expenseTotalsForFY } from "@/lib/compliance/expenses";
import { estimateFYTax } from "@/lib/compliance/tax-engine";
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

        const [profile, upcoming, overdue, expenseTotals] = await Promise.all([
            getBusinessTaxProfile(),
            upcomingTasks(120, 6),
            overdueTasks(),
            expenseTotalsForFY(fy.fy_label),
        ]);

        // Real receipts this FY: paid INR payments + forex inward INR equivalent
        const [paymentsRes, forexRes, deductionsRes] = await Promise.all([
            supabase.from("payments").select("amount_paise, currency, status, paid_at")
                .eq("status", "paid").gte("paid_at", fromIso).lte("paid_at", toIso + "T23:59:59Z"),
            supabase.from("forex_inward").select("inr_amount_paise, payment_date")
                .gte("payment_date", fromIso).lte("payment_date", toIso),
            supabase.from("deductions").select("section, amount_paise").eq("fiscal_year", fy.fy_label),
        ]);

        let receiptsPaise = 0;
        for (const p of paymentsRes.data ?? []) {
            if (p.currency === "INR") receiptsPaise += n(p.amount_paise);
        }
        for (const f of forexRes.data ?? []) receiptsPaise += n(f.inr_amount_paise);

        const deductions: DeductionStack = {};
        for (const d of deductionsRes.data ?? []) {
            const sec = d.section as keyof DeductionStack;
            deductions[sec] = (deductions[sec] ?? 0) + n(d.amount_paise);
        }

        const taxEstimate = estimateFYTax({
            receipts_inr_paise: receiptsPaise,
            deductions,
            regime: profile.income_tax_regime,
        });

        // ─── Health score ────────────────────────────────────────────────
        const factors: { label: string; ok: boolean; detail: string }[] = [];
        const gstActive = profile.gst_status === "active" && !!profile.gstin;
        factors.push({
            label: "GST registration",
            ok: gstActive,
            detail: gstActive ? "GSTIN active" : `Status: ${profile.gst_status} — GST returns unlock on activation`,
        });
        factors.push({
            label: "LUT for exports",
            ok: profile.lut_active,
            detail: profile.lut_active ? "LUT active — zero-rated exports" : "File LUT when GSTIN arrives",
        });
        const profileComplete = profile.pan_last4 !== "XXXX" && !profile.address_line1.startsWith("Registered Address");
        factors.push({
            label: "Business profile",
            ok: profileComplete,
            detail: profileComplete ? "Identity + address set" : "PAN / address still placeholder",
        });
        factors.push({
            label: "No overdue deadlines",
            ok: overdue.length === 0,
            detail: overdue.length === 0 ? "All deadlines on track" : `${overdue.length} overdue task(s)`,
        });
        factors.push({
            label: "Expense tracking",
            ok: expenseTotals.count > 0,
            detail: expenseTotals.count > 0 ? `${expenseTotals.count} expense(s) logged this FY` : "No expenses logged yet",
        });
        factors.push({
            label: "Deduction tracking",
            ok: (deductionsRes.data ?? []).length > 0,
            detail: (deductionsRes.data ?? []).length > 0 ? "Deductions being tracked" : "No 80C/80D claims logged yet",
        });
        const score = Math.round((factors.filter((f) => f.ok).length / factors.length) * 100);

        return NextResponse.json({
            fy_label: fy.fy_label,
            profile: {
                legal_name: profile.legal_name,
                trade_name: profile.trade_name,
                constitution_type: profile.constitution_type,
                gst_status: profile.gst_status,
                gstin: profile.gstin,
                gst_application_arn: profile.gst_application_arn,
                lut_active: profile.lut_active,
                presumptive_scheme: profile.presumptive_scheme,
                gst_filing_scheme: profile.gst_filing_scheme,
                income_tax_regime: profile.income_tax_regime,
                address_state: profile.address_state,
            },
            health: { score, factors },
            nextDeadlines: upcoming,
            overdueCount: overdue.length,
            expenseTotals: {
                total_amount_paise: expenseTotals.total_amount_paise,
                total_gst_paise: expenseTotals.total_gst_paise,
                itc_unclaimed_paise: expenseTotals.itc_unclaimed_paise,
                count: expenseTotals.count,
            },
            receiptsPaise,
            taxEstimate,
        });
    } catch (e) {
        console.error("[compliance/overview] error:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "overview failed" },
            { status: 500 }
        );
    }
}
