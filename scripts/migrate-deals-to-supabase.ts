// ─── ONE-TIME MIGRATION: data/deals.json → synapsis.payments ───────────────
// Reads existing deals.json, finds deals with payments[], and inserts
// matching rows into synapsis.payments + synapsis.platform_transactions.
// Idempotent: re-runnable; uses ON CONFLICT to skip dupes.
//
// USAGE: npx ts-node scripts/migrate-deals-to-supabase.ts
//        or via tsx: npx tsx scripts/migrate-deals-to-supabase.ts

import { readFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

interface OldDealPayment {
    phase: number;
    percentage: number;
    amount: number;
    status: "pending" | "paid";
    sessionId?: string;
    paidAt?: number;
}

interface OldDeal {
    token: string;
    name: string;
    company: string;
    totalPrice?: number;
    payments?: OldDealPayment[];
    phaseData?: {
        phase3?: { advanceRazorpayOrderId?: string; advanceRazorpayPaymentId?: string };
        phase4?: { midRazorpayOrderId?: string;     midRazorpayPaymentId?: string     };
        phase6?: { finalRazorpayOrderId?: string;   finalRazorpayPaymentId?: string   };
    };
}

const PAYMENT_SPLIT: Record<number, { percentage: number }> = {
    3: { percentage: 30 },
    4: { percentage: 30 },
    6: { percentage: 40 },
};

async function main() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        process.exit(1);
    }

    const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false },
        db: { schema: "synapsis" },
    });

    const dealsFile = path.join(process.cwd(), "data", "deals.json");
    const raw = await readFile(dealsFile, "utf8");
    const deals: OldDeal[] = JSON.parse(raw);

    console.log(`Found ${deals.length} deals.`);
    let inserted = 0, skipped = 0, errored = 0;

    for (const deal of deals) {
        if (!deal.payments?.length) continue;

        for (const payment of deal.payments) {
            const phase = payment.phase;
            if (![3, 4, 6].includes(phase)) continue;

            // Look up razorpay order/payment id from phaseData
            const pd = deal.phaseData;
            let orderId: string | undefined;
            let paymentId: string | undefined;
            if (phase === 3) { orderId = pd?.phase3?.advanceRazorpayOrderId; paymentId = pd?.phase3?.advanceRazorpayPaymentId; }
            if (phase === 4) { orderId = pd?.phase4?.midRazorpayOrderId;     paymentId = pd?.phase4?.midRazorpayPaymentId; }
            if (phase === 6) { orderId = pd?.phase6?.finalRazorpayOrderId;   paymentId = pd?.phase6?.finalRazorpayPaymentId; }

            const amountPaise = Math.round(payment.amount * 100);
            const receipt = `deal_${deal.token}_p${phase}`;

            // Check existing
            const { data: existing } = await supabase
                .from("payments")
                .select("id")
                .eq("deal_token", deal.token)
                .eq("phase", phase)
                .in("status", ["pending", "paid"])
                .limit(1);
            if (existing && existing.length > 0) {
                skipped++;
                continue;
            }

            const { data, error } = await supabase
                .from("payments")
                .insert({
                    deal_token: deal.token,
                    phase,
                    percentage: payment.percentage || PAYMENT_SPLIT[phase].percentage,
                    amount_paise: amountPaise,
                    currency: "INR",
                    status: payment.status,
                    method: "razorpay",
                    razorpay_order_id: orderId || (payment.sessionId?.startsWith("order_") ? payment.sessionId : null),
                    razorpay_payment_id: paymentId || null,
                    receipt,
                    paid_at: payment.paidAt ? new Date(payment.paidAt).toISOString() : null,
                    notes: "Migrated from deals.json",
                })
                .select("*")
                .single();

            if (error) {
                console.error(`  ✗ ${deal.token} phase ${phase}: ${error.message}`);
                errored++;
                continue;
            }

            // Audit row
            await supabase.from("platform_transactions").insert({
                deal_token: deal.token,
                payment_id: data.id,
                type: payment.status === "paid" ? `migration.payment.captured.phase${phase}` : `migration.payment.pending.phase${phase}`,
                source: "system",
                amount_paise: amountPaise,
                razorpay_order_id: orderId || null,
                razorpay_payment_id: paymentId || null,
                metadata: { migratedFromJson: true, originalSessionId: payment.sessionId },
            });

            inserted++;
            console.log(`  ✓ ${deal.token} phase ${phase} (${payment.status}) — ${amountPaise} paise`);
        }
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}, Errored: ${errored}`);
}

main().catch(err => { console.error(err); process.exit(1); });
