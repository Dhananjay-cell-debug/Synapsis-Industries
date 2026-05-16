// ─── INVOICE PDF GENERATION ────────────────────────────────────────────────
// Branded Synapsis invoice PDF using pdf-lib (pure JS, no native deps).
// Idempotent: if an invoice already exists for the (deal, payment), returns it.
//
// Compliance:
// • Sequential invoice numbers via DB function (synapsis.next_invoice_number)
// • PAN last-4, Udyam registration shown — sole proprietor format
// • GSTIN: "Not Applicable" until threshold crossed
// • TDS receivable line: visible if client deducted (manual entry)
// • System-generated; no signature required (footer disclaimer)

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
    createInvoice,
    generateInvoiceNumber,
    getInvoiceForPayment,
    getInvoiceByNumber,
} from "@/lib/payments/db";
import { supabase } from "@/lib/supabase";
import { SYNAPSIS_CONFIG, formatBankInstructions } from "@/lib/synapsis-config";
import { PHASE_NAMES, PAYMENT_SPLIT } from "@/lib/phases/constants";
import { getBusinessTaxProfile } from "@/lib/compliance/business-profile";
import { classifyGstTreatment } from "@/lib/compliance/tax-engine";
import { RULE_VERSION } from "@/lib/compliance/constants";
import type { BusinessTaxProfile, RecipientType } from "@/lib/compliance/types";

// ─── Tax breakdown computed once, used for PDF + snapshot ─────────────────

interface InvoiceTaxBreakdown {
    baseMinor: number;           // pre-GST taxable value (in invoice currency minor units)
    cgstMinor: number;
    sgstMinor: number;
    igstMinor: number;
    totalGstMinor: number;       // cgst + sgst + igst
    totalMinor: number;          // base + totalGstMinor (== payment.amount_paise for non-zero-rated)
    gstRate: number;             // 0 | 18
    treatment: string;           // synapsis.invoice_tax_snapshot.treatment values
    treatmentReason: string;
    placeOfSupply: string;
    zeroRated: boolean;
    sacCode: string;
    ruleVersion: string;
    gstinDisplay: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatINR = (paise: number): string => {
    const rupees = paise / 100;
    return `INR ${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatUSD = (cents: number): string => {
    const dollars = cents / 100;
    return `USD ${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatMoney = (minor: number, currency: "INR" | "USD"): string =>
    currency === "USD" ? formatUSD(minor) : formatINR(minor);

// Convert hex "#11B8EA" → rgb(0..1)
const hexToRgb = (hex: string) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return rgb(r, g, b);
};

// Number → words helper (Indian style, supports up to crores)
function numberToIndianWords(num: number): string {
    if (num === 0) return "Zero";
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const twoDigits = (n: number): string => {
        if (n < 20) return ones[n];
        return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    };
    const threeDigits = (n: number): string => {
        const h = Math.floor(n / 100);
        const r = n % 100;
        return (h ? ones[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigits(r) : "");
    };

    let result = "";
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const remainder = num % 1000;

    if (crore) result += twoDigits(crore) + " Crore ";
    if (lakh) result += twoDigits(lakh) + " Lakh ";
    if (thousand) result += twoDigits(thousand) + " Thousand ";
    if (remainder) result += threeDigits(remainder);

    return result.trim();
}

// ─── Drawing primitives ────────────────────────────────────────────────────

interface DrawCtx {
    page: PDFPage;
    fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont };
    colors: { primary: ReturnType<typeof rgb>; accent: ReturnType<typeof rgb>; muted: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> };
}

function drawText(ctx: DrawCtx, text: string, x: number, y: number, opts: {
    size?: number; bold?: boolean; italic?: boolean; color?: ReturnType<typeof rgb>;
} = {}) {
    const font = opts.bold ? ctx.fonts.bold : opts.italic ? ctx.fonts.italic : ctx.fonts.regular;
    ctx.page.drawText(text, {
        x, y, size: opts.size || 10, font,
        color: opts.color || ctx.colors.text,
    });
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color: ReturnType<typeof rgb>, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
    page.drawRectangle({ x, y, width: w, height: h, color });
}

// ─── Public — generate or fetch existing ───────────────────────────────────

export interface GenerateInvoiceArgs {
    dealToken: string;
    paymentId: string;
}

/**
 * Idempotent invoice generation: if invoice already exists for this payment,
 * returns it. Otherwise generates a new invoice number, builds PDF, persists
 * to synapsis.invoices (with PDF blob inline), returns the row.
 */
export async function generateAndPersistInvoice(args: GenerateInvoiceArgs) {
    // Existing?
    const existing = await getInvoiceForPayment(args.paymentId);
    if (existing) return existing;

    // Load payment
    const { data: payment, error: pErr } = await supabase
        .from("payments")
        .select("*")
        .eq("id", args.paymentId)
        .single();
    if (pErr || !payment) throw new Error(`Payment not found for invoice generation: ${pErr?.message}`);

    // Load deal from JSON (via re-import to avoid circular)
    const { getDeal } = await import("@/lib/deals/store");
    const deal = await getDeal(args.dealToken);
    if (!deal) throw new Error(`Deal not found for invoice generation: ${args.dealToken}`);

    // Generate sequential number
    const invoiceNumber = await generateInvoiceNumber();

    const currency: "INR" | "USD" = (payment.currency === "USD" ? "USD" : "INR");
    const provider: string = payment.provider || "razorpay";
    const totalMinor: number = payment.amount_minor || payment.amount_paise;

    // ─── NEW: tax breakdown (reverse-computed from charged total) ─────────
    const profile = await getBusinessTaxProfile();
    const { data: clientProfile } = await supabase
        .from("client_tax_profile")
        .select("*")
        .eq("deal_token", args.dealToken)
        .maybeSingle();

    const breakdown = computeTaxBreakdown(totalMinor, currency, profile, clientProfile);

    // Render PDF (with breakdown)
    const pdfBuffer = await renderInvoicePdf({
        invoiceNumber,
        currency,
        deal: {
            token: deal.token,
            name: deal.name,
            company: deal.company,
            need: deal.need,
        },
        payment: {
            phase: payment.phase as 3 | 4 | 6,
            amountMinor: totalMinor,
            tdsReceivedPaise: payment.tds_received_paise || 0,
            method: payment.method || provider,
            provider,
            razorpayPaymentId: payment.razorpay_payment_id,
            stripePaymentIntentId: payment.stripe_payment_intent_id,
            paidAt: payment.paid_at,
        },
        taxBreakdown: breakdown,
    });

    // Persist invoice
    const row = await createInvoice({
        invoiceNumber,
        dealToken: args.dealToken,
        paymentId: args.paymentId,
        phase: payment.phase,
        amountPaise: payment.amount_paise,
        currency,
        issuedToName: deal.name,
        issuedToCompany: deal.company,
        issuedToEmail: undefined,                  // V2: collect from questionnaire/onboarding
        pdfBlob: pdfBuffer,
        generatedBy: "system",
        metadata: { totalPriceMajor: deal.totalPrice, percentage: payment.percentage, currency, provider },
    });

    // ─── NEW: stamp immutable tax snapshot (idempotent via UNIQUE(invoice_id)) ─
    try {
        await supabase.from("invoice_tax_snapshot").insert({
            invoice_id: row.id,
            invoice_currency: currency,
            taxable_value_minor: breakdown.baseMinor,
            cgst_amount_minor: breakdown.cgstMinor,
            sgst_amount_minor: breakdown.sgstMinor,
            igst_amount_minor: breakdown.igstMinor,
            total_tax_minor: breakdown.totalGstMinor,
            total_invoice_minor: breakdown.totalMinor,
            gst_rate: breakdown.gstRate,
            sac_code: breakdown.sacCode,
            place_of_supply: breakdown.placeOfSupply,
            treatment: breakdown.treatment,
            treatment_reason: breakdown.treatmentReason,
            zero_rated: breakdown.zeroRated,
            reverse_charge: false,
            rule_version: breakdown.ruleVersion,
        });
    } catch (e) {
        // Append-only; if a snapshot already exists (concurrent), supabase will throw.
        console.warn("[invoice] tax snapshot insert skipped:", e instanceof Error ? e.message : e);
    }

    return row;
}

// ─── Tax breakdown computation ────────────────────────────────────────────
// Treats `totalMinor` as the GST-INCLUSIVE total (what was actually charged).
// Reverse-computes base + GST per the classifier's treatment.

function computeTaxBreakdown(
    totalMinor: number,
    currency: "INR" | "USD",
    profile: BusinessTaxProfile,
    clientProfile: Record<string, unknown> | null,
): InvoiceTaxBreakdown {
    const isInternational = currency === "USD"
        || (clientProfile?.billing_country && clientProfile.billing_country !== "India");

    // Recipient type (best-effort default)
    let recipient: RecipientType;
    if (clientProfile?.recipient_type) {
        recipient = clientProfile.recipient_type as RecipientType;
    } else if (isInternational) {
        recipient = "international_business";
    } else {
        recipient = "indian_unregistered";
    }

    // Compute base: if GST applies, reverse from total; else base = total.
    const willCarryGst = !isInternational || (isInternational && !profile.lut_active);
    const baseMinor = willCarryGst ? Math.round((totalMinor * 100) / 118) : totalMinor;

    const classification = classifyGstTreatment({
        business: {
            address_state: profile.address_state,
            lut_active: profile.lut_active,
            gstin: profile.gstin,
        },
        client: {
            recipient_type: recipient,
            billing_state: (clientProfile?.billing_state as string | null) ?? null,
            billing_country: (clientProfile?.billing_country as string) ?? (isInternational ? "Outside India" : "India"),
            client_gstin: (clientProfile?.client_gstin as string | null) ?? null,
            place_of_supply: null,
        },
        invoice_currency: currency,
        taxable_value_minor: baseMinor,
    });

    const cgst = classification.cgst_amount_minor;
    const sgst = classification.sgst_amount_minor;
    const igst = classification.igst_amount_minor;
    const totalGst = cgst + sgst + igst;
    // Snap total to the charged amount (within ₹1 rounding tolerance)
    const total = baseMinor + totalGst;

    const gstinDisplay = profile.gstin
        ? profile.gstin
        : (profile.gst_application_arn ? `ARN: ${profile.gst_application_arn} (GSTIN pending)` : "Not Applicable (pending)");

    return {
        baseMinor,
        cgstMinor: cgst,
        sgstMinor: sgst,
        igstMinor: igst,
        totalGstMinor: totalGst,
        totalMinor: total,
        gstRate: classification.gst_rate,
        treatment: classification.treatment,
        treatmentReason: classification.treatment_reason,
        placeOfSupply: classification.place_of_supply,
        zeroRated: classification.zero_rated,
        sacCode: classification.sac_code,
        ruleVersion: RULE_VERSION,
        gstinDisplay,
    };
}

// ─── PDF Renderer ──────────────────────────────────────────────────────────

interface RenderArgs {
    invoiceNumber: string;
    currency?: "INR" | "USD";
    deal: { token: string; name: string; company: string; need: string };
    payment: {
        phase: 3 | 4 | 6;
        amountMinor?: number;                      // canonical (paise|cents) — GST-inclusive total
        amountPaise?: number;                      // legacy alias
        tdsReceivedPaise: number;
        method: string;
        provider?: string;
        razorpayPaymentId: string | null;
        stripePaymentIntentId?: string | null;
        paidAt: string | null;
    };
    taxBreakdown?: InvoiceTaxBreakdown;             // optional; if absent, falls back to legacy single-line summary
}

export async function renderInvoicePdf(args: RenderArgs): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);              // A4 portrait (pt)
    const { height } = page.getSize();

    const currency: "INR" | "USD" = args.currency || "INR";
    const isUSD = currency === "USD";
    const amountMinor = args.payment.amountMinor ?? args.payment.amountPaise ?? 0;
    const tdsMinor = args.payment.tdsReceivedPaise || 0;
    const netReceivedMinor = amountMinor - tdsMinor;
    const fmt = (m: number) => formatMoney(m, currency);

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const colors = {
        primary: hexToRgb(SYNAPSIS_CONFIG.brand.primaryHex),       // deep navy
        accent:  hexToRgb(SYNAPSIS_CONFIG.brand.accentHex),         // azure
        accent2: hexToRgb(SYNAPSIS_CONFIG.brand.accent2Hex),        // royal
        muted:   hexToRgb(SYNAPSIS_CONFIG.brand.mutedHex),
        text:    hexToRgb("#1A1A1A"),
        white:   rgb(1, 1, 1),
    };
    const ctx: DrawCtx = {
        page,
        fonts: { regular: fontRegular, bold: fontBold, italic: fontItalic },
        colors: { primary: colors.primary, accent: colors.accent, muted: colors.muted, text: colors.text },
    };

    // ─── HEADER BAR (deep navy) ────────────────────────────────────────────
    drawRect(page, 0, height - 100, 595, 100, colors.primary);
    drawText(ctx, "SYNAPSIS INDUSTRIES", 40, height - 40, { size: 22, bold: true, color: colors.white });
    drawText(ctx, SYNAPSIS_CONFIG.tagline, 40, height - 60, { size: 9, color: hexToRgb("#94A3B8") });
    drawText(ctx, "INVOICE", 595 - 110, height - 40, { size: 24, bold: true, color: colors.accent });
    drawText(ctx, args.invoiceNumber, 595 - 110, height - 60, { size: 10, color: hexToRgb("#94A3B8") });

    let y = height - 140;

    // ─── BILL FROM / INVOICE DETAILS ───────────────────────────────────────
    drawText(ctx, "BILL FROM", 40, y, { size: 8, bold: true, color: colors.muted });
    drawText(ctx, "INVOICE DETAILS", 320, y, { size: 8, bold: true, color: colors.muted });
    y -= 18;

    const dateLocale = isUSD ? "en-US" : "en-IN";

    drawText(ctx, SYNAPSIS_CONFIG.legalName, 40, y, { size: 11, bold: true });
    drawText(ctx, "Issue Date:", 320, y, { size: 9, color: colors.muted });
    drawText(ctx, new Date().toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" }), 400, y, { size: 9 });
    y -= 14;

    drawText(ctx, SYNAPSIS_CONFIG.proprietorshipLine, 40, y, { size: 9, color: colors.muted });
    if (args.payment.paidAt) {
        drawText(ctx, "Payment Date:", 320, y, { size: 9, color: colors.muted });
        drawText(ctx, new Date(args.payment.paidAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" }), 400, y, { size: 9 });
    }
    y -= 14;

    drawText(ctx, `${SYNAPSIS_CONFIG.address.line1}`, 40, y, { size: 9, color: colors.muted });
    drawText(ctx, "Currency:", 320, y, { size: 9, color: colors.muted });
    drawText(ctx, isUSD ? "USD ($)" : "INR (Rs)", 400, y, { size: 9 });
    y -= 12;
    drawText(ctx, `${SYNAPSIS_CONFIG.address.city}, ${SYNAPSIS_CONFIG.address.state} ${SYNAPSIS_CONFIG.address.pincode}`, 40, y, { size: 9, color: colors.muted });
    drawText(ctx, "Method:", 320, y, { size: 9, color: colors.muted });
    const methodLabel =
        args.payment.method === "manual_neft" ? "NEFT/RTGS" :
        args.payment.method === "stripe"      ? "Stripe (International)" :
        args.payment.method === "razorpay" && isUSD ? "Razorpay (International)" :
        args.payment.method === "razorpay"    ? "Razorpay (Online)" :
        "Manual";
    drawText(ctx, methodLabel, 400, y, { size: 9 });
    y -= 12;

    drawText(ctx, `Email: ${SYNAPSIS_CONFIG.contact.email}`, 40, y, { size: 9, color: colors.muted });
    y -= 12;
    drawText(ctx, `Phone: ${SYNAPSIS_CONFIG.contact.phone}`, 40, y, { size: 9, color: colors.muted });
    y -= 16;

    drawText(ctx, `PAN: XXXXX${SYNAPSIS_CONFIG.panLast4}    Udyam: ${SYNAPSIS_CONFIG.udyamRegistration}`, 40, y, { size: 8, color: colors.muted });
    y -= 12;
    if (args.taxBreakdown) {
        const tb = args.taxBreakdown;
        const gstinLine = tb.zeroRated
            ? `GSTIN: ${tb.gstinDisplay}    ·    Place of Supply: ${tb.placeOfSupply}  ·  Export of Services (LUT — Zero-rated)`
            : `GSTIN: ${tb.gstinDisplay}    ·    Place of Supply: ${tb.placeOfSupply}  ·  SAC ${tb.sacCode}`;
        drawText(ctx, gstinLine, 40, y, { size: 8, color: colors.muted });
    } else if (isUSD) {
        drawText(ctx, "Place of Supply: Outside India  ·  Export of Services (LUT — Zero-rated)", 40, y, { size: 8, color: colors.muted });
    } else {
        drawText(ctx, `GSTIN: ${SYNAPSIS_CONFIG.gstin || "Not Applicable (Sole Proprietor — below Rs.20L threshold)"}`, 40, y, { size: 8, color: colors.muted });
    }
    y -= 24;

    // ─── BILL TO ───────────────────────────────────────────────────────────
    drawText(ctx, "BILL TO", 40, y, { size: 8, bold: true, color: colors.muted });
    y -= 18;
    drawText(ctx, args.deal.name, 40, y, { size: 12, bold: true });
    y -= 14;
    if (args.deal.company) {
        drawText(ctx, args.deal.company, 40, y, { size: 10, color: colors.muted });
        y -= 14;
    }
    drawText(ctx, `Project: ${args.deal.need}`, 40, y, { size: 9, color: colors.muted });
    y -= 14;
    drawText(ctx, `Deal Reference: ${args.deal.token}`, 40, y, { size: 9, color: colors.muted });
    y -= 28;

    // ─── LINE ITEMS TABLE ──────────────────────────────────────────────────
    drawRect(page, 40, y - 4, 515, 22, hexToRgb("#F1F5F9"));
    drawText(ctx, "DESCRIPTION", 50, y + 4, { size: 8, bold: true, color: colors.muted });
    drawText(ctx, "PHASE", 350, y + 4, { size: 8, bold: true, color: colors.muted });
    drawText(ctx, "AMOUNT", 480, y + 4, { size: 8, bold: true, color: colors.muted });
    y -= 30;

    const phaseLabel = PAYMENT_SPLIT[args.payment.phase].label;
    const phaseName = PHASE_NAMES[args.payment.phase];
    drawText(ctx, `${phaseLabel} — Synapsis Engagement`, 50, y, { size: 11, bold: true });
    drawText(ctx, `Phase ${args.payment.phase} (${phaseName})`, 350, y, { size: 10 });
    drawText(ctx, fmt(amountMinor), 480, y, { size: 11, bold: true });
    y -= 14;
    drawText(ctx, `${PAYMENT_SPLIT[args.payment.phase].percentage}% milestone — Per Engagement Protocol`, 50, y, { size: 9, color: colors.muted });
    y -= 28;

    drawLine(page, 40, y, 555, y, colors.muted, 0.5);
    y -= 18;

    // ─── SUMMARY ───────────────────────────────────────────────────────────
    const tdsLine = !isUSD && tdsMinor > 0;
    const tb = args.taxBreakdown;

    if (tb) {
        // Base / taxable subtotal (pre-GST)
        drawText(ctx, "Taxable amount", 380, y, { size: 10, color: colors.muted });
        drawText(ctx, fmt(tb.baseMinor), 480, y, { size: 10 });
        y -= 14;

        if (tb.zeroRated) {
            drawText(ctx, "GST (zero-rated, LUT)", 380, y, { size: 10, color: colors.muted });
            drawText(ctx, "0.00", 480, y, { size: 10, color: colors.muted });
            y -= 14;
        } else if (tb.cgstMinor > 0 && tb.sgstMinor > 0) {
            drawText(ctx, `CGST 9%`, 380, y, { size: 10, color: colors.muted });
            drawText(ctx, fmt(tb.cgstMinor), 480, y, { size: 10 });
            y -= 14;
            drawText(ctx, `SGST 9%`, 380, y, { size: 10, color: colors.muted });
            drawText(ctx, fmt(tb.sgstMinor), 480, y, { size: 10 });
            y -= 14;
        } else if (tb.igstMinor > 0) {
            drawText(ctx, `IGST ${tb.gstRate}%`, 380, y, { size: 10, color: colors.muted });
            drawText(ctx, fmt(tb.igstMinor), 480, y, { size: 10 });
            y -= 14;
        } else {
            drawText(ctx, "GST", 380, y, { size: 10, color: colors.muted });
            drawText(ctx, "Not Applicable", 480, y, { size: 10, color: colors.muted });
            y -= 14;
        }
    } else {
        // ── Legacy fallback (no breakdown — for old/test invoices) ──
        drawText(ctx, "Subtotal", 380, y, { size: 10, color: colors.muted });
        drawText(ctx, fmt(amountMinor), 480, y, { size: 10 });
        y -= 14;
        if (isUSD) {
            drawText(ctx, "GST / IGST", 380, y, { size: 10, color: colors.muted });
            drawText(ctx, "0% (Export — LUT)", 480, y, { size: 10, color: colors.muted });
        } else {
            drawText(ctx, "GST", 380, y, { size: 10, color: colors.muted });
            drawText(ctx, "Not Applicable", 480, y, { size: 10, color: colors.muted });
        }
        y -= 14;
    }

    if (tdsLine) {
        drawText(ctx, "TDS Deducted (by Client)", 380, y, { size: 10, color: colors.muted });
        drawText(ctx, `(${fmt(tdsMinor)})`, 480, y, { size: 10, color: hexToRgb("#DC2626") });
        y -= 14;
    }
    drawLine(page, 380, y + 4, 555, y + 4, colors.muted, 0.5);
    y -= 8;

    drawText(ctx, "TOTAL DUE", 380, y, { size: 11, bold: true });
    drawText(ctx, fmt(amountMinor), 480, y, { size: 12, bold: true, color: colors.primary });
    y -= 14;

    if (tdsLine) {
        drawText(ctx, "Net Received", 380, y, { size: 9, color: colors.muted });
        drawText(ctx, fmt(netReceivedMinor), 480, y, { size: 10, color: colors.muted });
        y -= 14;
    }

    // Amount in words
    if (isUSD) {
        const dollars = Math.floor(amountMinor / 100);
        drawText(ctx, "In words:", 40, y, { size: 8, bold: true, color: colors.muted });
        drawText(ctx, `US Dollars ${dollars.toLocaleString("en-US")} Only`, 90, y, { size: 9, italic: true });
    } else {
        const rupees = Math.floor(amountMinor / 100);
        drawText(ctx, "In words:", 40, y, { size: 8, bold: true, color: colors.muted });
        drawText(ctx, `Indian Rupees ${numberToIndianWords(rupees)} Only`, 90, y, { size: 9, italic: true });
    }
    y -= 24;

    // ─── PAYMENT REFERENCE ─────────────────────────────────────────────────
    if (args.payment.razorpayPaymentId) {
        drawText(ctx, "Payment Reference", 40, y, { size: 8, bold: true, color: colors.muted });
        y -= 14;
        drawText(ctx, `Razorpay Payment ID: ${args.payment.razorpayPaymentId}`, 40, y, { size: 9 });
        y -= 18;
    } else if (args.payment.stripePaymentIntentId) {
        drawText(ctx, "Payment Reference", 40, y, { size: 8, bold: true, color: colors.muted });
        y -= 14;
        drawText(ctx, `Stripe Payment ID: ${args.payment.stripePaymentIntentId}`, 40, y, { size: 9 });
        y -= 18;
    }

    // ─── BANK / PAYMENT INSTRUCTIONS ───────────────────────────────────────
    if (isUSD && args.payment.provider === "stripe") {
        drawRect(page, 40, y - 60, 515, 60, hexToRgb("#F8FAFC"));
        drawText(ctx, "PAID VIA STRIPE (International)", 50, y - 12, { size: 8, bold: true, color: colors.muted });
        drawText(ctx, "All major cards · ACH (US) · SEPA (EU) · Apple/Google Pay · Link", 50, y - 28, { size: 9, color: colors.text });
        drawText(ctx, "For wire transfer or invoicing inquiries: " + SYNAPSIS_CONFIG.contact.email, 50, y - 42, { size: 9, color: colors.text });
        y -= 80;
    } else if (isUSD) {
        drawRect(page, 40, y - 72, 515, 72, hexToRgb("#F8FAFC"));
        drawText(ctx, "PAID VIA RAZORPAY INTERNATIONAL", 50, y - 12, { size: 8, bold: true, color: colors.muted });
        drawText(ctx, "International cards are supported directly on checkout.", 50, y - 28, { size: 9, color: colors.text });
        drawText(ctx, "ACH, SEPA, CHAPS, SWIFT, Trustly, Giropay and Sofort depend on Razorpay activation and buyer region.", 50, y - 42, { size: 9, color: colors.text });
        drawText(ctx, "Settlement is handled by Razorpay to Synapsis Industries in India.", 50, y - 56, { size: 9, color: colors.text });
        y -= 92;
    } else {
        drawRect(page, 40, y - 80, 515, 80, hexToRgb("#F8FAFC"));
        drawText(ctx, "PAY TO (NEFT / RTGS reference)", 50, y - 12, { size: 8, bold: true, color: colors.muted });
        const bankLines = formatBankInstructions().split("\n");
        let by = y - 28;
        for (const line of bankLines) {
            drawText(ctx, line, 50, by, { size: 9, color: colors.text });
            by -= 12;
        }
        y -= 100;
    }

    // ─── FOOTER ────────────────────────────────────────────────────────────
    drawLine(page, 40, 80, 555, 80, colors.muted, 0.5);
    drawText(ctx, SYNAPSIS_CONFIG.invoice.footer, 40, 64, { size: 8, italic: true, color: colors.muted });
    drawText(ctx, `Payment Terms: ${SYNAPSIS_CONFIG.invoice.paymentTerms}`, 40, 50, { size: 8, color: colors.muted });
    drawText(ctx, "synapsis.industries", 40, 36, { size: 8, color: colors.accent });
    drawText(ctx, args.invoiceNumber, 595 - 100, 36, { size: 8, bold: true, color: colors.muted });

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
}

// ─── Re-export for serve route ─────────────────────────────────────────────
export { getInvoiceByNumber };
