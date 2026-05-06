// ─── ADMIN — REJECT MANUAL NEFT PROOF ──────────────────────────────────────
// Admin rejects an invalid manual proof. Frees up the pending_admin_verify
// payment row (sets status=failed) so client can submit a new one.
//
// POST body: { reason: string }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
    getManualProof,
    markManualProofRejected,
    markPaymentFailed,
    recordTransaction,
} from "@/lib/payments/db";

export const runtime = "nodejs";

export async function POST(
    req: NextRequest,
    { params }: { params: { proofId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session?.user?.email)) {
        return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
    }
    const adminEmail = session!.user!.email!;

    const proofId = params.proofId;
    const body = await req.json().catch(() => ({}));
    const reason: string = (body.reason || "").trim();
    if (!reason || reason.length < 10) {
        return NextResponse.json({ error: "reason must be at least 10 characters" }, { status: 400 });
    }

    const proof = await getManualProof(proofId);
    if (!proof) return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    if (proof.status !== "pending_review") {
        return NextResponse.json({ error: `Proof already ${proof.status}` }, { status: 400 });
    }

    // Free up the pending payment row
    const { data: paymentRows } = await supabase
        .from("payments")
        .select("*")
        .eq("deal_token", proof.deal_token)
        .eq("phase", proof.phase)
        .eq("status", "pending_admin_verify")
        .order("created_at", { ascending: false })
        .limit(1);
    if (paymentRows && paymentRows.length > 0) {
        await markPaymentFailed(paymentRows[0].id, `Manual proof rejected: ${reason}`);
    }

    await markManualProofRejected({
        proofId,
        reviewerEmail: adminEmail,
        reason,
    });

    await recordTransaction({
        dealToken: proof.deal_token,
        paymentId: paymentRows?.[0]?.id,
        type: "manual.proof.rejected",
        source: "admin_manual",
        actorEmail: adminEmail,
        metadata: { proofId, reason, utr: proof.utr },
    });

    return NextResponse.json({ ok: true, proofId, status: "rejected" });
}
