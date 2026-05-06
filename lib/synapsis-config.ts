// ─── SYNAPSIS BUSINESS CONFIG ──────────────────────────────────────────────
// All business identity + bank details for invoice/NEFT instructions live here.
// Update this once. Every invoice + manual-payment instruction reads from here.
//
// SECURITY: This file is read on both server and client.
// → ONLY put values that are safe to ship to the browser.
// → Bank account number: store last-4 ONLY here. Full number in env (server-only).
// → PAN: store last-4 ONLY here. Full PAN in env if needed.

export const SYNAPSIS_CONFIG = {
    // ─── Identity ──────────────────────────────────────────────────────────
    legalName: "Dhananjay Chitmilla",                    // sole proprietor name
    brandName: "Synapsis Industries",
    tagline: "Systems engineered. Outcomes delivered.",
    proprietorshipLine: "Sole Proprietor — Dhananjay Chitmilla",

    // ─── Registration / Compliance ─────────────────────────────────────────
    udyamRegistration: process.env.NEXT_PUBLIC_SYNAPSIS_UDYAM || "UDYAM-XX-XX-XXXXXXX",
    panLast4:          process.env.NEXT_PUBLIC_SYNAPSIS_PAN_LAST4 || "XXXX",
    gstinStatus: "Not Applicable — Turnover below ₹20L threshold (Sole Proprietor)",
    gstin: "" as string,                                  // empty until threshold crossed; THEN fill

    // ─── Bank Details (for NEFT/RTGS instructions to clients) ──────────────
    // ⚠ Last-4 only here. Full account number lives in SERVER ENV: SYNAPSIS_BANK_ACCOUNT_FULL
    bank: {
        accountHolderName: "Dhananjay Chitmilla",
        accountType:       "Savings",                     // change to "Current" when current account opened
        bankName:          process.env.NEXT_PUBLIC_SYNAPSIS_BANK_NAME || "BANK_NAME",
        branch:            process.env.NEXT_PUBLIC_SYNAPSIS_BANK_BRANCH || "BRANCH",
        ifsc:              process.env.NEXT_PUBLIC_SYNAPSIS_IFSC || "IFSC0000000",
        accountLast4:      process.env.NEXT_PUBLIC_SYNAPSIS_ACCOUNT_LAST4 || "XXXX",
        upiId:             process.env.NEXT_PUBLIC_SYNAPSIS_UPI || "",  // optional, leave "" to hide
    },

    // ─── Contact ───────────────────────────────────────────────────────────
    contact: {
        email:    "dhananjaychitmila@gmail.com",
        phone:    "+91-8652106713",
        whatsapp: "+91-8652106713",
        website:  "https://synapsis.industries",          // update when domain connected
    },

    // ─── Address (registered business address) ─────────────────────────────
    address: {
        line1: process.env.NEXT_PUBLIC_SYNAPSIS_ADDR1 || "Registered Address Line 1",
        line2: process.env.NEXT_PUBLIC_SYNAPSIS_ADDR2 || "Address Line 2",
        city:  process.env.NEXT_PUBLIC_SYNAPSIS_CITY  || "Mumbai",
        state: process.env.NEXT_PUBLIC_SYNAPSIS_STATE || "Maharashtra",
        pincode: process.env.NEXT_PUBLIC_SYNAPSIS_PIN || "400001",
        country: "India",
    },

    // ─── Branding (for invoice PDF) ────────────────────────────────────────
    brand: {
        primaryHex:  "#0A0F1E",   // deep navy
        accentHex:   "#11B8EA",   // azure
        accent2Hex:  "#3B6AE8",   // royal
        textHex:     "#0A0F1E",
        mutedHex:    "#475569",
    },

    // ─── Invoice settings ──────────────────────────────────────────────────
    invoice: {
        prefix: "SYNAP",                                  // SYNAP-2026-0001
        footer: "This is a system-generated invoice. No physical signature required.",
        paymentTerms: "Per Synapsis Engagement Protocol — Phase-gated milestone payments.",
    },
} as const;

export type SynapsisConfig = typeof SYNAPSIS_CONFIG;

// Helper — pretty bank string for invoice "Pay To" block
export function formatBankInstructions(): string {
    const b = SYNAPSIS_CONFIG.bank;
    return [
        `Account Name: ${b.accountHolderName}`,
        `Bank: ${b.bankName}, ${b.branch}`,
        `Account Type: ${b.accountType}`,
        `Account Number: ****${b.accountLast4}`,
        `IFSC: ${b.ifsc}`,
        b.upiId ? `UPI: ${b.upiId}` : "",
    ].filter(Boolean).join("\n");
}
