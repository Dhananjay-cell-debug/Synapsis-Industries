// ─── MANUAL NEFT PROOF SUBMISSION (client) ─────────────────────────────────
// Client (in big-budget projects) pays via NEFT/RTGS to Synapsis bank account,
// then submits the UTR + screenshot here. Lands in pending_review queue
// awaiting admin verification.
//
// POST body (multipart/form-data preferred for screenshot, JSON OK without):
//   { token, paymentPhase, utr, amountRupees, bankName?, accountHolderName?, paymentDate?, notes? }

import { NextRequest, NextResponse } from "next/server";
import { rupeesToPaise } from "@/lib/razorpay";
import { paymentAmountFor } from "@/lib/phases/constants";
import { getDeal } from "@/lib/deals/store";
import {
    getPaymentForPhase,
    submitManualProof,
    recordTransaction,
    upsertPendingPayment,
} from "@/lib/payments/db";
import { sendManualPaymentSubmittedAlert } from "@/lib/email/payment-notifications";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const ct = req.headers.get("content-type") || "";
        let body: Record<string, string> = {};
        let imageBuffer: Buffer | null = null;
        let imageMime = "image/png";
        let imageName = "proof.png";

        if (ct.includes("multipart/form-data")) {
            const form = await req.formData();
            const entries = Array.from(form.entries());
            for (const [k, v] of entries) {
                if (v instanceof File) {
                    imageBuffer = Buffer.from(await v.arrayBuffer());
                    imageMime = v.type || "image/png";
                    imageName = v.name || "proof.png";
                } else {
                    body[k] = String(v);
                }
            }
        } else {
            body = await req.json();
        }

        const token = body.token;
        const phase = Number(body.paymentPhase) as 3 | 4 | 6;
        const utr = (body.utr || "").trim();
        const amountRupees = Number(body.amountRupees);
        const bankName = body.bankName?.trim() || undefined;
        const accountHolderName = body.accountHolderName?.trim() || undefined;
        const paymentDate = body.paymentDate || undefined;
        const notes = body.notes || undefined;

        if (!token || !phase || !utr) {
            return NextResponse.json({ error: "Missing token, paymentPhase, or UTR" }, { status: 400 });
        }
        if (utr.length < 8) {
            return NextResponse.json({ error: "UTR must be at least 8 characters" }, { status: 400 });
        }
        if (![3, 4, 6].includes(phase)) {
            return NextResponse.json({ error: "Invalid paymentPhase" }, { status: 400 });
        }

        // ─── Load deal + cross-check amount ────────────────────────────────
        const deal = await getDeal(token);
        if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        if (!deal.totalPrice || deal.totalPrice <= 0) {
            return NextResponse.json({ error: "Project total not set" }, { status: 400 });
        }

        const expectedRupees = paymentAmountFor(deal.totalPrice, phase);
        const expectedPaise = rupeesToPaise(expectedRupees);
        const submittedPaise = rupeesToPaise(amountRupees);

        // Allow small rounding tolerance (1 paise)
        if (Math.abs(submittedPaise - expectedPaise) > 1) {
            return NextResponse.json({
                error: `Amount mismatch — expected ${expectedRupees}, got ${amountRupees}`,
            }, { status: 400 });
        }

        // Block if already paid or another manual is pending
        const existing = await getPaymentForPhase(token, phase);
        if (existing?.status === "paid") {
            return NextResponse.json({ error: "This phase is already paid" }, { status: 400 });
        }
        if (existing?.status === "pending_admin_verify") {
            return NextResponse.json({
                error: "A manual NEFT submission is already pending verification for this phase",
            }, { status: 400 });
        }

        // ─── Upload proof image to Supabase Storage (best-effort) ─────────
        let proofImageUrl: string | undefined;
        if (imageBuffer) {
            const bucket = "manual-payment-proofs";
            const key = `${token}/p${phase}/${Date.now()}-${imageName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
            const { error: upErr } = await supabase.storage
                .from(bucket)
                .upload(key, imageBuffer, { contentType: imageMime, upsert: false });
            if (!upErr) {
                const { data: urlData } = supabase.storage.from(bucket).createSignedUrl
                    ? await supabase.storage.from(bucket).createSignedUrl(key, 60 * 60 * 24 * 30)
                    : { data: null };
                proofImageUrl = urlData?.signedUrl || `supabase://${bucket}/${key}`;
            } else {
                // Bucket might not exist yet — fall back to data URL stub
                console.warn("[manual/submit] storage upload failed:", upErr.message);
                proofImageUrl = undefined;
            }
        }

        // ─── Create pending_admin_verify payment row ──────────────────────
        const paymentRow = await upsertPendingPayment({
            dealToken: token,
            phase,
            totalPriceMajor: deal.totalPrice,
            currency: "INR",
            provider: "manual",
            razorpayOrderId: `manual_${Date.now()}_${utr}`,        // placeholder — no Razorpay involved
            receipt: `deal_${token}_p${phase}_neft`,
            method: "manual_neft",
        });

        // Override status to pending_admin_verify
        await supabase
            .from("payments")
            .update({ status: "pending_admin_verify", method: "manual_neft", razorpay_order_id: null })
            .eq("id", paymentRow.id);

        // ─── Submit proof ──────────────────────────────────────────────────
        const proof = await submitManualProof({
            dealToken: token,
            phase,
            amountPaise: expectedPaise,
            utr,
            bankName,
            accountHolderName,
            paymentDate,
            proofImageUrl,
            notes,
        });

        // Audit log
        await recordTransaction({
            dealToken: token,
            paymentId: paymentRow.id,
            type: "manual.proof.submitted",
            source: "client_callback",
            amountPaise: expectedPaise,
            metadata: { utr, bankName, paymentDate, proofId: proof.id },
        });

        // Alert admin (best-effort)
        Promise.resolve().then(async () => {
            try { await sendManualPaymentSubmittedAlert(proof.id); }
            catch (e) {
                await recordTransaction({
                    dealToken: token, paymentId: paymentRow.id,
                    type: "email.notification.failed",
                    source: "system",
                    metadata: { stage: "manual.submitted.alert", error: e instanceof Error ? e.message : String(e) },
                });
            }
        }).catch(() => { /* swallowed */ });

        return NextResponse.json({
            ok: true,
            proofId: proof.id,
            status: "pending_review",
            note: "Proof submitted. Admin will verify against bank statement, typically within 24 hours.",
        });
    } catch (err) {
        console.error("[payments/manual/submit] error:", err);
        const msg = err instanceof Error ? err.message : "Failed to submit manual payment";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
