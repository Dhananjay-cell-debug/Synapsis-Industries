import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readFile } from "fs/promises";
import path from "path";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const DATA_FILE = path.join(process.cwd(), "data", "deals.json");

const PAYMENT_PHASES = {
    3: { label: "Advance Payment",     percentage: 30, phase: 3 },
    4: { label: "Milestone Payment",   percentage: 30, phase: 4 },
    6: { label: "Final Payment",       percentage: 40, phase: 6 },
} as const;

export async function POST(req: NextRequest) {
    try {
        const { token, paymentPhase } = await req.json();

        if (!token || !paymentPhase) {
            return NextResponse.json({ error: "Missing token or paymentPhase" }, { status: 400 });
        }

        const phaseConfig = PAYMENT_PHASES[paymentPhase as keyof typeof PAYMENT_PHASES];
        if (!phaseConfig) {
            return NextResponse.json({ error: "Invalid payment phase" }, { status: 400 });
        }

        // Load deal
        const raw = await readFile(DATA_FILE, "utf8");
        const deals = JSON.parse(raw);
        const deal = deals.find((d: { token: string }) => d.token === token);

        if (!deal) {
            return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        }

        if (!deal.totalPrice) {
            return NextResponse.json({ error: "Project price not set by admin yet" }, { status: 400 });
        }

        // Check if already paid
        const existingPayment = deal.payments?.find(
            (p: { phase: number; status: string }) => p.phase === paymentPhase && p.status === "paid"
        );
        if (existingPayment) {
            return NextResponse.json({ error: "This payment has already been made" }, { status: 400 });
        }

        const amountUSD = Math.round((deal.totalPrice * phaseConfig.percentage) / 100);
        const amountCents = amountUSD * 100; // Stripe uses cents

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: `Synapsis Industries — ${phaseConfig.label}`,
                            description: `${phaseConfig.percentage}% of project total ($${deal.totalPrice.toLocaleString()} USD) · ${deal.name} · ${deal.company}`,
                        },
                        unit_amount: amountCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                token,
                paymentPhase: String(paymentPhase),
                percentage: String(phaseConfig.percentage),
                clientName: deal.name,
                company: deal.company,
            },
            success_url: `${baseUrl}/client/${token}?payment=success&phase=${paymentPhase}`,
            cancel_url:  `${baseUrl}/client/${token}?payment=cancelled`,
        });

        return NextResponse.json({ url: session.url, sessionId: session.id });
    } catch (err) {
        console.error("Stripe checkout error:", err);
        return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
}
