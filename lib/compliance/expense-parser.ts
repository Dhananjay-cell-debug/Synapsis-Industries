// ─── EXPENSE PARSER — raw text → structured expense drafts via LLM ─────────
// User pastes anything: email body, GPay confirmation, bank statement chunk,
// invoice PDF text. We extract each expense as a structured draft, which
// the UI lets the user review/edit before bulk-creating.

import "server-only";
import { callAiJson, extractJsonObject } from "./ai-call";

export interface ExpenseDraft {
    expense_date: string;          // YYYY-MM-DD
    vendor: string;
    description: string | null;
    category_code: string;          // must match expense_categories.code
    amount_rupees: number;         // total amount (incl GST)
    gst_rupees: number;            // GST portion (0 if not separately mentioned)
    vendor_gstin: string | null;
    confidence: "high" | "medium" | "low";
    source_reference: string | null;  // a hash/snippet for dedup if same text re-pasted
    raw_snippet: string;            // the slice of input that produced this row
    notes: string | null;
}

const CATEGORIES = [
    { code: "saas_dev_tools", label: "Dev Tools / SaaS — GitHub, Vercel, Supabase, Anthropic, OpenAI, Cursor" },
    { code: "saas_business", label: "Business SaaS — Razorpay/Stripe fees, accounting, email, CRM" },
    { code: "equipment_it", label: "IT Equipment — laptop, monitor, phone, peripherals" },
    { code: "domain_hosting", label: "Domain & Hosting" },
    { code: "professional", label: "Professional Fees — CA, lawyer, consultants" },
    { code: "marketing", label: "Marketing — ads, paid promotion" },
    { code: "telecom", label: "Telecom & Internet — mobile, broadband" },
    { code: "travel", label: "Travel for Client" },
    { code: "office_supplies", label: "Office Supplies" },
    { code: "books_courses", label: "Books & Courses" },
    { code: "bank_charges", label: "Bank Charges" },
    { code: "rent", label: "Rent (business)" },
    { code: "other", label: "Other" },
];

const SYSTEM_PROMPT = `You are an expense-extraction agent for an Indian business compliance system. You receive a raw text dump (email body, bank statement chunk, GPay confirmation, invoice text, mixed text). Extract every distinct business expense as a structured row.

Available categories (use the CODE only, never the label):
${CATEGORIES.map(c => `  - ${c.code} — ${c.label}`).join("\n")}

Rules:
- Output strictly valid JSON in the exact shape requested. No prose, no markdown fences. No trailing commas.
- One row per distinct charge/transaction. Combine line-items only if they're the same vendor+date+invoice.
- "amount_rupees" is the total amount paid (inclusive of GST).
- "gst_rupees" is the GST portion ONLY if separately mentioned. If not, set to 0.
- "expense_date" must be YYYY-MM-DD. If you can't determine, use today.
- "category_code" must be one of the codes above. Choose the best match.
- "vendor_gstin" only if visibly present (15-char alphanumeric); else null.
- "confidence" — your own assessment:
    "high" if vendor, amount, and date are all explicit;
    "medium" if one is inferred;
    "low" if multiple inferred.
- "raw_snippet" is the slice of the input text (≤ 200 chars) that produced this row.
- "notes" is null unless something noteworthy (FX involved, partial info, etc.).
- If text contains NO valid expenses, return { "expenses": [] }.

Output schema (strict):
{
  "expenses": [
    {
      "expense_date": "YYYY-MM-DD",
      "vendor": "string",
      "description": "string | null",
      "category_code": "saas_dev_tools | ...",
      "amount_rupees": number,
      "gst_rupees": number,
      "vendor_gstin": "string | null",
      "confidence": "high | medium | low",
      "raw_snippet": "string",
      "notes": "string | null"
    }
  ]
}`;

export interface ParseResult {
    expenses: ExpenseDraft[];
    provider: string;
    model: string;
}

export async function parseExpenseText(rawText: string): Promise<ParseResult> {
    if (!rawText || rawText.trim().length < 5) {
        throw new Error("Paste something — at least a few words of an expense.");
    }
    if (rawText.length > 20000) {
        throw new Error("Text too long (max 20,000 chars). Paste in smaller chunks.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const userPrompt = `Today's date: ${today}\n\nRaw input text:\n---\n${rawText}\n---\n\nReturn the JSON object.`;

    const result = await callAiJson(
        [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
        ],
        { temperature: 0.1, maxTokens: 3000, responseFormatJson: true },
    );

    let parsed: unknown;
    try {
        parsed = extractJsonObject(result.content);
    } catch (e) {
        throw new Error(`AI returned non-JSON: ${result.content.slice(0, 200)}`);
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { expenses?: unknown }).expenses)) {
        throw new Error(`AI response missing 'expenses' array.`);
    }

    const validCodes = new Set(CATEGORIES.map(c => c.code));
    const rawExpenses = (parsed as { expenses: Record<string, unknown>[] }).expenses;
    const expenses: ExpenseDraft[] = rawExpenses
        .map((r): ExpenseDraft | null => {
            try {
                const expense_date = typeof r.expense_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.expense_date)
                    ? r.expense_date : today;
                const vendor = typeof r.vendor === "string" && r.vendor.trim().length > 0
                    ? r.vendor.trim() : "Unknown";
                const description = typeof r.description === "string" && r.description.trim().length > 0
                    ? r.description.trim() : null;
                const code = typeof r.category_code === "string" && validCodes.has(r.category_code)
                    ? r.category_code : "other";
                const amount = Number(r.amount_rupees);
                if (!Number.isFinite(amount) || amount <= 0) return null;
                const gst = Math.max(0, Math.min(amount, Number(r.gst_rupees) || 0));
                const gstin = typeof r.vendor_gstin === "string" && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/.test(r.vendor_gstin.trim().toUpperCase())
                    ? r.vendor_gstin.trim().toUpperCase() : null;
                const confidence = r.confidence === "high" || r.confidence === "medium" || r.confidence === "low"
                    ? r.confidence : "low";
                const snippet = typeof r.raw_snippet === "string" ? r.raw_snippet.slice(0, 200) : "";
                const notes = typeof r.notes === "string" && r.notes.trim().length > 0 ? r.notes.trim() : null;

                // Dedup signature: vendor|date|amount
                const source_reference = `paste:${vendor.toLowerCase()}|${expense_date}|${amount.toFixed(2)}`;

                return {
                    expense_date, vendor, description, category_code: code,
                    amount_rupees: amount, gst_rupees: gst,
                    vendor_gstin: gstin, confidence,
                    source_reference, raw_snippet: snippet, notes,
                };
            } catch {
                return null;
            }
        })
        .filter((e): e is ExpenseDraft => e !== null);

    return { expenses, provider: result.provider, model: result.model };
}
