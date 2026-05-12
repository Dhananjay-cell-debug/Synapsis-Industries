// ─── PAYMENT NOTIFICATION EMAILS ───────────────────────────────────────────
// Branded transactional emails for payment events. Reuses existing nodemailer
// Gmail setup. Failures are caller's responsibility — log to platform_transactions
// for reconciliation; do NOT block payment capture on email send failure.

import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import { getInvoiceForPayment } from "@/lib/payments/db";
import { SYNAPSIS_CONFIG } from "@/lib/synapsis-config";
import { PAYMENT_SPLIT, PHASE_NAMES } from "@/lib/phases/constants";

function getTransporter() {
    return nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
}

const formatINR = (paise: number): string =>
    `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatUSD = (cents: number): string =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatMoney = (minor: number, currency: string): string =>
    currency === "USD" ? formatUSD(minor) : formatINR(minor);

const methodLabel = (method: string | null, provider: string | null, currency: string): string => {
    if (method === "stripe" || provider === "stripe") return "Stripe (International)";
    if (method === "razorpay" && currency === "USD") return "Razorpay (International)";
    if (method === "manual_neft") return "Manual NEFT/RTGS";
    if (method === "razorpay") return "Razorpay";
    if (method === "admin_marked") return "Admin-marked";
    return provider || "Unknown";
};

// ─── Email shells ──────────────────────────────────────────────────────────

interface BasicTemplateArgs {
    title: string;
    preheader: string;
    headline: string;
    intro: string;
    body: string;
    cta?: { label: string; href: string };
    footerNote?: string;
}

function emailShell(args: BasicTemplateArgs): string {
    const { title, preheader, headline, intro, body, cta, footerNote } = args;
    return `
<!doctype html>
<html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0A0F1E;font-family:Inter,Arial,sans-serif;">
<div style="display:none;font-size:0;line-height:0;color:#0A0F1E;">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F1E;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0D1526;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#11B8EA 0%,#3B6AE8 100%);padding:24px 32px;">
    <p style="margin:0;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:0.3em;text-transform:uppercase;">Synapsis Industries</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:600;">${headline}</h1>
  </td></tr>
  <tr><td style="padding:32px;color:#fff;">
    <p style="margin:0 0 16px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">${intro}</p>
    ${body}
    ${cta ? `<p style="margin:24px 0 0;"><a href="${cta.href}" style="display:inline-block;background:#11B8EA;color:#0A0F1E;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">${cta.label}</a></p>` : ""}
  </td></tr>
  <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;line-height:1.6;">
      ${footerNote || ""}<br/>
      Synapsis Industries · ${SYNAPSIS_CONFIG.contact.email} · ${SYNAPSIS_CONFIG.contact.phone}
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ─── Trigger: payment captured ─────────────────────────────────────────────

export interface PaymentEmailArgs {
    dealToken: string;
    paymentId: string;
}

/**
 * Sends two emails:
 * - Admin: payment received notification
 * - Client: payment confirmation + invoice PDF attached (if generated)
 */
export async function sendPaymentVerifiedEmails(args: PaymentEmailArgs): Promise<void> {
    const { data: payment, error: pErr } = await supabase
        .from("payments").select("*").eq("id", args.paymentId).single();
    if (pErr || !payment) throw new Error(`Payment not found for email: ${pErr?.message}`);

    const { getDeal } = await import("@/lib/deals/store");
    const deal = await getDeal(args.dealToken);
    if (!deal) throw new Error(`Deal not found for email: ${args.dealToken}`);

    const invoice = await getInvoiceForPayment(args.paymentId);

    // Fetch invoice PDF blob if available
    let pdfAttachment: { filename: string; content: Buffer } | null = null;
    if (invoice) {
        const { data: invFull } = await supabase
            .from("invoices").select("pdf_blob, invoice_number")
            .eq("id", invoice.id).single();
        const blob = invFull?.pdf_blob as unknown;
        if (blob) {
            let buf: Buffer | null = null;
            if (typeof blob === "string") {
                const hex = blob.startsWith("\\x") ? blob.slice(2) : blob;
                try { buf = Buffer.from(hex, "hex"); }
                catch { buf = Buffer.from(hex, "base64"); }
            } else if (blob instanceof Uint8Array) {
                buf = Buffer.from(blob);
            }
            if (buf) {
                pdfAttachment = { filename: `${invoice.invoice_number}.pdf`, content: buf };
            }
        }
    }

    const transporter = getTransporter();
    const phaseLabel = PAYMENT_SPLIT[payment.phase as 3 | 4 | 6]?.label || `Phase ${payment.phase}`;
    const phaseName = PHASE_NAMES[payment.phase] || `Phase ${payment.phase}`;
    const currency: string = payment.currency || "INR";
    const amountMinor = payment.amount_minor ?? payment.amount_paise ?? 0;
    const amountStr = formatMoney(amountMinor, currency);
    const paymentMethodStr = methodLabel(payment.method, payment.provider, currency);
    const paymentRefId = payment.razorpay_payment_id || payment.stripe_payment_intent_id || "";
    const paymentRefLabel = payment.razorpay_payment_id ? "Razorpay Payment ID"
                          : payment.stripe_payment_intent_id ? "Stripe Payment Intent ID"
                          : "";

    // ─── ADMIN EMAIL ───────────────────────────────────────────────────────
    const adminBody = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(17,184,234,0.08);border:1px solid rgba(17,184,234,0.25);border-radius:12px;padding:20px;margin:0 0 16px;">
<tr><td>
<p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">Amount Captured</p>
<p style="margin:0;color:#11B8EA;font-size:28px;font-weight:700;">${amountStr}</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
<tr><td style="padding:16px;">
<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">Client</p>
<p style="margin:0 0 12px;color:#fff;font-size:14px;">${deal.name} ${deal.company ? `· ${deal.company}` : ""}</p>
<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">Phase</p>
<p style="margin:0 0 12px;color:#fff;font-size:14px;">Phase ${payment.phase} — ${phaseName} (${phaseLabel})</p>
<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">Method</p>
<p style="margin:0 0 12px;color:#fff;font-size:14px;">${paymentMethodStr}</p>
${paymentRefId ? `<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">${paymentRefLabel}</p><p style="margin:0;color:#fff;font-size:13px;font-family:monospace;">${paymentRefId}</p>` : ""}
</td></tr></table>`;

    await transporter.sendMail({
        from: `"Synapsis Industries" <${process.env.GMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL || SYNAPSIS_CONFIG.contact.email,
        subject: `[Synapsis] Payment received — ${amountStr} from ${deal.name}`,
        html: emailShell({
            title: "Payment Received",
            preheader: `${amountStr} captured from ${deal.name}`,
            headline: "Payment Received",
            intro: `${amountStr} captured for <strong style="color:#fff;">${deal.name}</strong>${deal.company ? ` (${deal.company})` : ""} — ${phaseLabel}.`,
            body: adminBody,
            cta: invoice ? { label: "View Invoice", href: `${SYNAPSIS_CONFIG.contact.website}/admin/invoices/${invoice.invoice_number}` } : undefined,
            footerNote: "Logged in synapsis.platform_transactions.",
        }),
    });

    // ─── CLIENT EMAIL ──────────────────────────────────────────────────────
    // We don't always have client email yet (V2: from questionnaire). For now,
    // BCC to admin so they can forward, OR send if we have it.
    const clientEmail = (deal.questionnaire as Record<string, string> | undefined)?.email
        || (deal.questionnaire as Record<string, string> | undefined)?.contact_email;

    if (clientEmail) {
        const clientBody = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:12px;padding:20px;margin:0 0 16px;">
<tr><td>
<p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">Amount</p>
<p style="margin:0;color:#10B981;font-size:28px;font-weight:700;">${amountStr}</p>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:12px;">${phaseLabel} · ${PAYMENT_SPLIT[payment.phase as 3|4|6].percentage}% milestone</p>
</td></tr></table>
<p style="margin:0 0 12px;color:rgba(255,255,255,0.6);font-size:13px;line-height:1.7;">A signed copy of your invoice is attached to this email${invoice ? ` (${invoice.invoice_number})` : ""}. Please save it for your records.</p>
${payment.phase === 3 ? `<p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.7;">Next: build phase begins. You'll receive a kickoff brief within 24 hours.</p>` : ""}
${payment.phase === 4 ? `<p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.7;">Next: final build will be submitted for your review per the sprint schedule.</p>` : ""}
${payment.phase === 6 ? `<p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.7;">Next: deployment + handover package will be delivered.</p>` : ""}`;

        await transporter.sendMail({
            from: `"Synapsis Industries" <${process.env.GMAIL_USER}>`,
            to: clientEmail,
            bcc: process.env.ADMIN_EMAIL || undefined,
            subject: `Payment received — ${invoice?.invoice_number || phaseLabel}`,
            html: emailShell({
                title: "Payment Received — Synapsis Industries",
                preheader: `Thank you. ${amountStr} received for ${phaseLabel}.`,
                headline: "Thank you — payment received",
                intro: `Hi ${deal.name.split(" ")[0]}, we've received your payment of <strong style="color:#fff;">${amountStr}</strong> for the ${phaseLabel}.`,
                body: clientBody,
                footerNote: "This is a system-generated invoice. No physical signature required.",
            }),
            attachments: pdfAttachment ? [pdfAttachment] : [],
        });
    }
}

// ─── Manual NEFT submitted (alert admin) ───────────────────────────────────

export async function sendManualPaymentSubmittedAlert(proofId: string): Promise<void> {
    const { data: proof } = await supabase
        .from("manual_payment_proofs").select("*").eq("id", proofId).single();
    if (!proof) return;

    const { getDeal } = await import("@/lib/deals/store");
    const deal = await getDeal(proof.deal_token);
    const transporter = getTransporter();
    const amountStr = formatINR(proof.amount_paise);

    await transporter.sendMail({
        from: `"Synapsis Industries" <${process.env.GMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL || SYNAPSIS_CONFIG.contact.email,
        subject: `[Synapsis URGENT] Manual NEFT proof submitted — ${amountStr}${deal ? ` from ${deal.name}` : ""}`,
        html: emailShell({
            title: "Manual NEFT Proof Submitted",
            preheader: `${amountStr} NEFT proof awaiting your verification`,
            headline: "Manual NEFT — Verify Required",
            intro: `A client has submitted a NEFT/RTGS payment proof for ${amountStr}. Verify against your bank statement before approving.`,
            body: `
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
<tr><td style="padding:16px;">
<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">Client</p>
<p style="margin:0 0 12px;color:#fff;font-size:14px;">${deal?.name || proof.deal_token}</p>
<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">Phase</p>
<p style="margin:0 0 12px;color:#fff;font-size:14px;">Phase ${proof.phase} — ${PAYMENT_SPLIT[proof.phase as 3|4|6]?.label}</p>
<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">UTR</p>
<p style="margin:0 0 12px;color:#fff;font-size:14px;font-family:monospace;">${proof.utr}</p>
${proof.bank_name ? `<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">From Bank</p><p style="margin:0;color:#fff;font-size:14px;">${proof.bank_name}${proof.account_holder_name ? ` · ${proof.account_holder_name}` : ""}</p>` : ""}
</td></tr></table>`,
            cta: { label: "Open Admin Review", href: `${SYNAPSIS_CONFIG.contact.website}/admin/payments/manual` },
        }),
    });
}
