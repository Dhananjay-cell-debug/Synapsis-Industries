// ─── PAYMENT DATABASE LAYER ────────────────────────────────────────────────
// All Supabase synapsis-schema reads/writes for the payment domain go through here.
// API routes never speak to Supabase directly — they call these helpers.
//
// Bulletproof properties baked in:
// • Idempotent order creation (UNIQUE INDEX on pending row)
// • Append-only transactions (DB triggers enforce)
// • Server-side amount recompute (callers pass deal totalPrice → we compute paise)
// • Webhook event idempotency (UNIQUE INDEX on razorpay_event_id)

import { supabase } from "@/lib/supabase";
import { PAYMENT_SPLIT, paymentAmountFor } from "@/lib/phases/constants";
import { rupeesToPaise } from "@/lib/razorpay";

// ─── Types (shape of synapsis.payments rows) ──────────────────────────────

export type PaymentStatus =
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "pending_admin_verify";

export type PaymentMethod = "razorpay" | "manual_neft" | "admin_marked" | "stripe";
export type PaymentProvider = "razorpay" | "stripe" | "manual";
export type PaymentCurrency = "INR" | "USD";

export interface PaymentRow {
    id: string;
    deal_token: string;
    phase: 3 | 4 | 6;
    percentage: number;
    amount_paise: number;                           // legacy: minor-unit (paise for INR, cents for USD via amount_minor)
    amount_minor: number | null;                    // canonical minor-unit (paise|cents)
    minor_per_major: number;                        // 100 (paise/INR or cents/USD)
    currency: PaymentCurrency;
    provider: PaymentProvider;
    status: PaymentStatus;
    method: PaymentMethod | null;
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    stripe_session_id: string | null;
    stripe_payment_intent_id: string | null;
    receipt: string | null;
    paid_at: string | null;
    failed_reason: string | null;
    tds_received_paise: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface TransactionRow {
    id: string;
    deal_token: string;
    payment_id: string | null;
    type: string;
    source: "webhook" | "client_callback" | "admin_manual" | "system";
    actor_email: string | null;
    amount_paise: number | null;
    provider: PaymentProvider | null;
    razorpay_event_id: string | null;
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    stripe_event_id: string | null;
    stripe_session_id: string | null;
    stripe_payment_intent_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface InvoiceRow {
    id: string;
    invoice_number: string;
    deal_token: string;
    payment_id: string;
    phase: number;
    amount_paise: number;
    currency: PaymentCurrency;
    tds_received_paise: number;
    pdf_url: string | null;
    issued_to_name: string | null;
    issued_to_company: string | null;
    issued_to_email: string | null;
    issued_at: string;
    generated_by: "system" | "admin";
    metadata: Record<string, unknown> | null;
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────

/**
 * Get pending or paid payment for a (deal, phase). Idempotent helper.
 * Returns the most recent row in ['pending','paid','pending_admin_verify'] for that phase.
 */
export async function getPaymentForPhase(
    dealToken: string,
    phase: 3 | 4 | 6
): Promise<PaymentRow | null> {
    const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("deal_token", dealToken)
        .eq("phase", phase)
        .in("status", ["pending", "paid", "pending_admin_verify"])
        .order("created_at", { ascending: false })
        .limit(1);
    if (error) throw new Error(`getPaymentForPhase: ${error.message}`);
    return (data?.[0] as PaymentRow) || null;
}

/**
 * Idempotent payment-row creation: if a pending row exists for (deal, phase), reuse it.
 * Otherwise insert a new pending row. Server recomputes amount from totalPrice — never trust client.
 *
 * Provider-aware:
 *   - razorpay (INR): amount derived from totalPriceRupees × percentage, in paise
 *   - razorpay (USD international): same path, but currency='USD' and amount in cents
 *   - stripe (USD): amount in cents, stripe_session_id stored
 */
export async function upsertPendingPayment(params: {
    dealToken: string;
    phase: 3 | 4 | 6;
    totalPriceMajor: number;             // total in major unit (rupees OR dollars depending on currency)
    currency?: PaymentCurrency;          // default 'INR' for back-compat
    provider?: PaymentProvider;          // default 'razorpay' for back-compat
    razorpayOrderId?: string;
    stripeSessionId?: string;
    receipt: string;
    method: PaymentMethod;
}): Promise<PaymentRow> {
    const {
        dealToken, phase, totalPriceMajor,
        currency = "INR", provider = "razorpay",
        razorpayOrderId, stripeSessionId, receipt, method,
    } = params;
    const cfg = PAYMENT_SPLIT[phase];
    if (!cfg) throw new Error(`Invalid phase ${phase}`);

    const amountMajor = paymentAmountFor(totalPriceMajor, phase);
    // Both INR (paise) and USD (cents) use 100 minor per major
    const amountMinor = Math.round(amountMajor * 100);

    // Check for existing pending row (idempotent)
    const existing = await getPaymentForPhase(dealToken, phase);
    if (existing && existing.status === "pending") {
        // Refresh canonical fields so a deal that switched currency/provider/amount
        // before payment cannot reuse a stale row. Server is source of truth —
        // amount_minor, currency, provider are recomputed every call.
        const updates: Record<string, unknown> = {
            receipt,
            amount_paise: amountMinor,
            amount_minor: amountMinor,
            minor_per_major: 100,
            currency,
            provider,
            method,
        };
        if (provider === "razorpay") {
            updates.razorpay_order_id = razorpayOrderId ?? existing.razorpay_order_id ?? null;
            if (existing.stripe_session_id) updates.stripe_session_id = null;
            if (existing.stripe_payment_intent_id) updates.stripe_payment_intent_id = null;
        } else if (provider === "stripe") {
            updates.stripe_session_id = stripeSessionId ?? existing.stripe_session_id ?? null;
            if (existing.razorpay_order_id) updates.razorpay_order_id = null;
            if (existing.razorpay_payment_id) updates.razorpay_payment_id = null;
        }
        const { data, error } = await supabase
            .from("payments")
            .update(updates)
            .eq("id", existing.id)
            .select("*")
            .single();
        if (error) throw new Error(`upsertPendingPayment update: ${error.message}`);
        return data as PaymentRow;
    }
    if (existing && existing.status === "paid") {
        throw new Error(`Payment for phase ${phase} already paid (id=${existing.id})`);
    }
    if (existing && existing.status === "pending_admin_verify") {
        throw new Error(`Manual payment for phase ${phase} awaiting admin verification`);
    }

    const { data, error } = await supabase
        .from("payments")
        .insert({
            deal_token: dealToken,
            phase,
            percentage: cfg.percentage,
            amount_paise: amountMinor,            // legacy column — same minor-unit value
            amount_minor: amountMinor,
            minor_per_major: 100,
            currency,
            provider,
            status: "pending",
            method,
            razorpay_order_id: razorpayOrderId ?? null,
            stripe_session_id: stripeSessionId ?? null,
            receipt,
        })
        .select("*")
        .single();
    if (error) throw new Error(`upsertPendingPayment insert: ${error.message}`);
    return data as PaymentRow;
}

/**
 * Mark a pending payment as paid. Atomic. Provider-specific id stored.
 * If row already paid, no-op (idempotent).
 */
export async function markPaymentPaid(params: {
    paymentId: string;
    razorpayPaymentId?: string;
    stripePaymentIntentId?: string;
    paidAtMs?: number;
}): Promise<PaymentRow> {
    const paidAt = new Date(params.paidAtMs ?? Date.now()).toISOString();
    const updates: Record<string, unknown> = { status: "paid", paid_at: paidAt };
    if (params.razorpayPaymentId) updates.razorpay_payment_id = params.razorpayPaymentId;
    if (params.stripePaymentIntentId) updates.stripe_payment_intent_id = params.stripePaymentIntentId;
    const { data, error } = await supabase
        .from("payments")
        .update(updates)
        .eq("id", params.paymentId)
        .select("*")
        .single();
    if (error) throw new Error(`markPaymentPaid: ${error.message}`);
    return data as PaymentRow;
}

export async function markPaymentFailed(paymentId: string, reason: string): Promise<void> {
    const { error } = await supabase
        .from("payments")
        .update({ status: "failed", failed_reason: reason })
        .eq("id", paymentId);
    if (error) throw new Error(`markPaymentFailed: ${error.message}`);
}

export async function listPaymentsForDeal(dealToken: string): Promise<PaymentRow[]> {
    const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("deal_token", dealToken)
        .order("phase", { ascending: true });
    if (error) throw new Error(`listPaymentsForDeal: ${error.message}`);
    return (data || []) as PaymentRow[];
}

export async function getPaymentByOrderId(orderId: string): Promise<PaymentRow | null> {
    const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("razorpay_order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1);
    if (error) throw new Error(`getPaymentByOrderId: ${error.message}`);
    return (data?.[0] as PaymentRow) || null;
}

export async function getPaymentByStripeSessionId(sessionId: string): Promise<PaymentRow | null> {
    const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("stripe_session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1);
    if (error) throw new Error(`getPaymentByStripeSessionId: ${error.message}`);
    return (data?.[0] as PaymentRow) || null;
}

export async function getPaymentByStripePaymentIntentId(piId: string): Promise<PaymentRow | null> {
    const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("stripe_payment_intent_id", piId)
        .order("created_at", { ascending: false })
        .limit(1);
    if (error) throw new Error(`getPaymentByStripePaymentIntentId: ${error.message}`);
    return (data?.[0] as PaymentRow) || null;
}

// ─── PLATFORM TRANSACTIONS — append-only audit log ────────────────────────

/**
 * Record an immutable transaction event. Idempotent on razorpay_event_id OR
 * stripe_event_id — if same event already logged, returns existing row.
 */
export async function recordTransaction(params: {
    dealToken: string;
    paymentId?: string | null;
    type: string;
    source: TransactionRow["source"];
    provider?: PaymentProvider | null;
    actorEmail?: string | null;
    amountPaise?: number | null;
    razorpayEventId?: string | null;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    stripeEventId?: string | null;
    stripeSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    metadata?: Record<string, unknown> | null;
}): Promise<TransactionRow> {
    // Idempotency check on event id (razorpay or stripe)
    const eventColumn = params.razorpayEventId ? "razorpay_event_id"
                      : params.stripeEventId   ? "stripe_event_id"
                      : null;
    const eventValue  = params.razorpayEventId || params.stripeEventId;
    if (eventColumn && eventValue) {
        const { data: existing } = await supabase
            .from("platform_transactions")
            .select("*")
            .eq(eventColumn, eventValue)
            .limit(1);
        if (existing && existing.length > 0) {
            return existing[0] as TransactionRow;
        }
    }

    const { data, error } = await supabase
        .from("platform_transactions")
        .insert({
            deal_token: params.dealToken,
            payment_id: params.paymentId ?? null,
            type: params.type,
            source: params.source,
            provider: params.provider ?? null,
            actor_email: params.actorEmail ?? null,
            amount_paise: params.amountPaise ?? null,
            razorpay_event_id: params.razorpayEventId ?? null,
            razorpay_order_id: params.razorpayOrderId ?? null,
            razorpay_payment_id: params.razorpayPaymentId ?? null,
            stripe_event_id: params.stripeEventId ?? null,
            stripe_session_id: params.stripeSessionId ?? null,
            stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
            metadata: params.metadata ?? null,
        })
        .select("*")
        .single();
    if (error) {
        // Race condition on unique event id → fetch the winner
        if (error.code === "23505" && eventColumn && eventValue) {
            const { data: winner } = await supabase
                .from("platform_transactions")
                .select("*")
                .eq(eventColumn, eventValue)
                .single();
            if (winner) return winner as TransactionRow;
        }
        throw new Error(`recordTransaction: ${error.message}`);
    }
    return data as TransactionRow;
}

export async function listTransactionsForDeal(dealToken: string): Promise<TransactionRow[]> {
    const { data, error } = await supabase
        .from("platform_transactions")
        .select("*")
        .eq("deal_token", dealToken)
        .order("created_at", { ascending: false });
    if (error) throw new Error(`listTransactionsForDeal: ${error.message}`);
    return (data || []) as TransactionRow[];
}

// ─── INVOICES ─────────────────────────────────────────────────────────────

export async function generateInvoiceNumber(): Promise<string> {
    const { data, error } = await supabase.rpc("next_invoice_number", { prefix: "SYNAP" });
    if (error) throw new Error(`generateInvoiceNumber: ${error.message}`);
    return data as string;
}

export async function createInvoice(params: {
    invoiceNumber: string;
    dealToken: string;
    paymentId: string;
    phase: number;
    amountPaise: number;
    currency?: PaymentCurrency;
    issuedToName?: string;
    issuedToCompany?: string;
    issuedToEmail?: string;
    pdfBlob?: Buffer;
    pdfUrl?: string;
    generatedBy?: "system" | "admin";
    metadata?: Record<string, unknown>;
}): Promise<InvoiceRow> {
    const { data, error } = await supabase
        .from("invoices")
        .insert({
            invoice_number: params.invoiceNumber,
            deal_token: params.dealToken,
            payment_id: params.paymentId,
            phase: params.phase,
            amount_paise: params.amountPaise,
            currency: params.currency ?? "INR",
            issued_to_name: params.issuedToName ?? null,
            issued_to_company: params.issuedToCompany ?? null,
            issued_to_email: params.issuedToEmail ?? null,
            pdf_url: params.pdfUrl ?? null,
            pdf_blob: params.pdfBlob ?? null,
            generated_by: params.generatedBy || "system",
            metadata: params.metadata ?? null,
        })
        .select("*")
        .single();
    if (error) throw new Error(`createInvoice: ${error.message}`);
    return data as InvoiceRow;
}

export async function getInvoiceByNumber(invoiceNumber: string): Promise<(InvoiceRow & { pdf_blob: Uint8Array | null }) | null> {
    const { data, error } = await supabase
        .from("invoices")
        .select("*, pdf_blob")
        .eq("invoice_number", invoiceNumber)
        .single();
    if (error) {
        if (error.code === "PGRST116") return null; // not found
        throw new Error(`getInvoiceByNumber: ${error.message}`);
    }
    return data as InvoiceRow & { pdf_blob: Uint8Array | null };
}

export async function getInvoiceForPayment(paymentId: string): Promise<InvoiceRow | null> {
    const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("payment_id", paymentId)
        .order("issued_at", { ascending: false })
        .limit(1);
    if (error) throw new Error(`getInvoiceForPayment: ${error.message}`);
    return (data?.[0] as InvoiceRow) || null;
}

export async function listInvoicesForDeal(dealToken: string): Promise<InvoiceRow[]> {
    const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, deal_token, payment_id, phase, amount_paise, tds_received_paise, pdf_url, issued_to_name, issued_to_company, issued_to_email, issued_at, generated_by, metadata")
        .eq("deal_token", dealToken)
        .order("issued_at", { ascending: false });
    if (error) throw new Error(`listInvoicesForDeal: ${error.message}`);
    return (data || []) as InvoiceRow[];
}

// ─── MANUAL PAYMENT PROOFS ────────────────────────────────────────────────

export interface ManualProofRow {
    id: string;
    deal_token: string;
    phase: 3 | 4 | 6;
    amount_paise: number;
    utr: string;
    bank_name: string | null;
    account_holder_name: string | null;
    payment_date: string | null;
    proof_image_url: string | null;
    notes: string | null;
    status: "pending_review" | "verified" | "rejected";
    submitted_at: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    payment_id: string | null;
}

export async function submitManualProof(params: {
    dealToken: string;
    phase: 3 | 4 | 6;
    amountPaise: number;
    utr: string;
    bankName?: string;
    accountHolderName?: string;
    paymentDate?: string;        // ISO date "2026-05-03"
    proofImageUrl?: string;
    notes?: string;
}): Promise<ManualProofRow> {
    const { data, error } = await supabase
        .from("manual_payment_proofs")
        .insert({
            deal_token: params.dealToken,
            phase: params.phase,
            amount_paise: params.amountPaise,
            utr: params.utr,
            bank_name: params.bankName ?? null,
            account_holder_name: params.accountHolderName ?? null,
            payment_date: params.paymentDate ?? null,
            proof_image_url: params.proofImageUrl ?? null,
            notes: params.notes ?? null,
            status: "pending_review",
        })
        .select("*")
        .single();
    if (error) throw new Error(`submitManualProof: ${error.message}`);
    return data as ManualProofRow;
}

export async function getManualProof(id: string): Promise<ManualProofRow | null> {
    const { data, error } = await supabase
        .from("manual_payment_proofs")
        .select("*")
        .eq("id", id)
        .single();
    if (error) {
        if (error.code === "PGRST116") return null;
        throw new Error(`getManualProof: ${error.message}`);
    }
    return data as ManualProofRow;
}

export async function listPendingManualProofs(): Promise<ManualProofRow[]> {
    const { data, error } = await supabase
        .from("manual_payment_proofs")
        .select("*")
        .eq("status", "pending_review")
        .order("submitted_at", { ascending: true });
    if (error) throw new Error(`listPendingManualProofs: ${error.message}`);
    return (data || []) as ManualProofRow[];
}

export async function markManualProofVerified(params: {
    proofId: string;
    paymentId: string;
    reviewerEmail: string;
}): Promise<ManualProofRow> {
    const { data, error } = await supabase
        .from("manual_payment_proofs")
        .update({
            status: "verified",
            reviewed_by: params.reviewerEmail,
            reviewed_at: new Date().toISOString(),
            payment_id: params.paymentId,
        })
        .eq("id", params.proofId)
        .select("*")
        .single();
    if (error) throw new Error(`markManualProofVerified: ${error.message}`);
    return data as ManualProofRow;
}

export async function markManualProofRejected(params: {
    proofId: string;
    reviewerEmail: string;
    reason: string;
}): Promise<ManualProofRow> {
    const { data, error } = await supabase
        .from("manual_payment_proofs")
        .update({
            status: "rejected",
            reviewed_by: params.reviewerEmail,
            reviewed_at: new Date().toISOString(),
            rejection_reason: params.reason,
        })
        .eq("id", params.proofId)
        .select("*")
        .single();
    if (error) throw new Error(`markManualProofRejected: ${error.message}`);
    return data as ManualProofRow;
}
