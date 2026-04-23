import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const DATA_FILE = path.join(process.cwd(), "data", "deals.json");

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    // Skip signature verification in test mode if webhook secret is placeholder
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: Stripe.Event;

    try {
        if (webhookSecret && webhookSecret !== "whsec_placeholder_replace_after_setup" && sig) {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        } else {
            // Test mode: parse directly
            event = JSON.parse(body) as Stripe.Event;
        }
    } catch (err) {
        console.error("Webhook signature error:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const { token, paymentPhase, percentage } = session.metadata || {};

        if (!token || !paymentPhase) {
            return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
        }

        try {
            const raw = await readFile(DATA_FILE, "utf8");
            const deals = JSON.parse(raw);
            const idx = deals.findIndex((d: { token: string }) => d.token === token);

            if (idx === -1) {
                return NextResponse.json({ error: "Deal not found" }, { status: 404 });
            }

            const phase = Number(paymentPhase);
            const payments = deals[idx].payments || [];

            // Upsert payment record
            const existingIdx = payments.findIndex((p: { phase: number }) => p.phase === phase);
            const paymentRecord = {
                phase,
                percentage: Number(percentage),
                amount: (session.amount_total || 0) / 100,
                status: "paid",
                sessionId: session.id,
                paidAt: Date.now(),
            };

            if (existingIdx >= 0) {
                payments[existingIdx] = paymentRecord;
            } else {
                payments.push(paymentRecord);
            }

            deals[idx].payments = payments;
            await writeFile(DATA_FILE, JSON.stringify(deals, null, 2));

            console.log(`✅ Payment confirmed: deal ${token}, phase ${phase}`);
        } catch (err) {
            console.error("Error updating deal after payment:", err);
        }
    }

    return NextResponse.json({ received: true });
}
