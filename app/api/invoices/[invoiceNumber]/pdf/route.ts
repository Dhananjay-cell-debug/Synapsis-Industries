// ─── INVOICE PDF SERVE ─────────────────────────────────────────────────────
// GET /api/invoices/[invoiceNumber]/pdf
// Returns the stored PDF blob with proper Content-Type and Content-Disposition.
//
// Auth: For now, anyone with the exact invoice number can fetch.
// Sequential numbers are easy to enumerate — V2 should add deal-token check
// or signed URL via Supabase Storage.

import { NextRequest, NextResponse } from "next/server";
import { getInvoiceByNumber } from "@/lib/payments/db";

export const runtime = "nodejs";

export async function GET(
    _req: NextRequest,
    { params }: { params: { invoiceNumber: string } }
) {
    const { invoiceNumber } = params;
    if (!invoiceNumber) return NextResponse.json({ error: "Missing invoice number" }, { status: 400 });

    const inv = await getInvoiceByNumber(invoiceNumber);
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (!inv.pdf_blob) {
        return NextResponse.json({ error: "Invoice PDF not yet generated" }, { status: 404 });
    }

    // pdf_blob may come back as base64 string from PostgREST or bytea hex; coerce to Buffer
    let buf: Buffer;
    const blob = inv.pdf_blob as unknown;
    if (typeof blob === "string") {
        // PostgREST returns bytea as "\x..." hex
        const hex = (blob as string).startsWith("\\x") ? (blob as string).slice(2) : (blob as string);
        try { buf = Buffer.from(hex, "hex"); }
        catch { buf = Buffer.from(hex, "base64"); }
    } else if (blob instanceof Uint8Array) {
        buf = Buffer.from(blob);
    } else if (Array.isArray(blob)) {
        buf = Buffer.from(blob);
    } else {
        return NextResponse.json({ error: "Invoice PDF blob unreadable" }, { status: 500 });
    }

    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return new NextResponse(ab, {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${invoiceNumber}.pdf"`,
            "Cache-Control": "private, max-age=3600",
        },
    });
}
