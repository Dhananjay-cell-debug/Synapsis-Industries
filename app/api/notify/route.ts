import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, company, need, budget, message, date } = body;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const contactPart = message.includes("— Contact:")
            ? message.split("— Contact:")[1]?.trim()
            : null;
        const messagePart = message.split("\n\n—")[0];

        await transporter.sendMail({
            from: `"Synapsis Industries" <${process.env.GMAIL_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `[Synapsis Inquiry] ${name} — ${need}`,
            html: `
                <div style="font-family: 'Inter', Arial, sans-serif; background: #0A0F1E; color: #ffffff; padding: 40px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
                    <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 24px; margin-bottom: 24px;">
                        <p style="color: #11B8EA; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 8px;">New Project Inquiry</p>
                        <h1 style="font-size: 32px; margin: 0; color: #ffffff;">${name}</h1>
                        <p style="color: rgba(255,255,255,0.4); font-size: 14px; margin: 4px 0 0;">${company || "No company"} · ${date}</p>
                    </div>

                    <div style="display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;">
                        <span style="background: rgba(59,106,232,0.15); color: #3B6AE8; border: 1px solid rgba(59,106,232,0.3); padding: 4px 12px; border-radius: 8px; font-size: 12px;">${need}</span>
                        ${budget ? `<span style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 8px; font-size: 12px;">${budget}</span>` : ""}
                    </div>

                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                        <p style="color: rgba(255,255,255,0.25); font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 12px;">Message</p>
                        <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.7; margin: 0; white-space: pre-line;">${messagePart}</p>
                    </div>

                    ${contactPart ? `
                    <div style="background: rgba(17,184,234,0.04); border: 1px solid rgba(17,184,234,0.15); border-radius: 12px; padding: 20px;">
                        <p style="color: rgba(255,255,255,0.25); font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 8px;">Contact</p>
                        <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0;">${contactPart}</p>
                    </div>
                    ` : ""}
                </div>
            `,
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Email send error:", err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}
