// ─── COMPLIANCE — BUSINESS TAX PROFILE ─────────────────────────────────────
// GET   /api/compliance/profile → full business tax profile
// PATCH /api/compliance/profile → update fields (clears cache)
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getBusinessTaxProfile, clearBusinessProfileCache } from "@/lib/compliance/business-profile";
import { isValidGstinFormat, gstinStateCode } from "@/lib/compliance/tax-engine";

export const runtime = "nodejs";

// Fields the admin is allowed to edit via this route.
const EDITABLE = new Set([
    "legal_name", "trade_name", "constitution_type", "pan_last4",
    "gstin", "gst_registration_date", "gst_application_arn", "gst_status",
    "lut_active", "lut_arn", "lut_filed_at", "lut_valid_until",
    "income_tax_regime", "presumptive_scheme", "gst_filing_scheme",
    "udyam_number", "udyam_registered_at",
    "address_line1", "address_line2", "address_city", "address_state", "address_pincode",
    "default_sac_code", "default_gst_rate",
    "bank_account_type", "bank_account_last4", "bank_ifsc", "bank_name",
    "notes",
]);

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }
    try {
        const profile = await getBusinessTaxProfile(true);
        return NextResponse.json(profile);
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "profile fetch failed" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "admin auth required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
        if (EDITABLE.has(k)) updates[k] = v;
    }
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "no editable fields supplied" }, { status: 400 });
    }

    // GSTIN validation + auto-derive state code
    if (typeof updates.gstin === "string" && updates.gstin.trim() !== "") {
        const gstin = (updates.gstin as string).trim().toUpperCase();
        if (!isValidGstinFormat(gstin)) {
            return NextResponse.json({ error: "GSTIN format invalid (expect 15-char e.g. 27ABCDE1234F1Z5)" }, { status: 400 });
        }
        updates.gstin = gstin;
        updates.gstin_state_code = gstinStateCode(gstin);
    }

    try {
        const current = await getBusinessTaxProfile(true);
        const { data, error } = await supabase
            .from("business_tax_profile")
            .update(updates)
            .eq("id", current.id)
            .select("*")
            .single();
        if (error || !data) {
            return NextResponse.json({ error: error?.message ?? "update failed" }, { status: 500 });
        }
        clearBusinessProfileCache();
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "profile update failed" },
            { status: 500 }
        );
    }
}
