// ─── GSTR-1 BUILDER — GSTN-spec JSON + UI prep data ────────────────────────
// Reads invoices + tax snapshots + client profiles for a quarter under QRMP,
// classifies each row into the GSTR-1 sections (B2B / B2CS / Exports), and
// emits:
//   • a UI-friendly `prep` summary (cards, totals, warnings)
//   • a `json` object that serializes to the GSTN GSTR-1 specification
//
// SPEC NOTE: This follows the public GSTN GSTR-1 JSON spec (offline-utility
// compatible). Field names, dd-mm-yyyy dates, INR-rupee amounts (not paise).
// HONEST CAVEAT: first portal upload after deploying this is the real test —
// if the offline utility rejects, log the message and patch. The shape below
// is verified against multiple public references but small spec drift happens.

import "server-only";
import { supabase } from "@/lib/supabase";
import { getBusinessTaxProfile } from "./business-profile";

// ─── Types ─────────────────────────────────────────────────────────────────

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export interface B2BInvoiceRow {
    invoice_id: string;
    invoice_number: string;
    invoice_date: string;       // ISO yyyy-mm-dd
    client_name: string | null;
    client_gstin: string;
    place_of_supply_code: string;  // 2-digit state code
    invoice_value_paise: number;
    taxable_value_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    cess_paise: number;
    rate: number;
    sac_code: string;
    treatment: "intra_state" | "inter_state";
}

export interface B2CSConsolidatedRow {
    supply_type: "INTRA" | "INTER";
    rate: number;
    place_of_supply_code: string;
    taxable_value_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    cess_paise: number;
    invoice_count: number;
}

export interface ExportInvoiceRow {
    invoice_id: string;
    invoice_number: string;
    invoice_date: string;
    invoice_value_paise: number;       // INR equivalent
    taxable_value_paise: number;       // INR equivalent
    igst_paise: number;                // 0 if LUT (WOPAY), else 18%
    cess_paise: number;
    rate: number;
    export_type: "WOPAY" | "WPAY";     // WOPAY=with LUT, WPAY=with IGST
    client_country: string;
    sac_code: string;
}

export interface HSNSummaryRow {
    hsn_sc: string;
    description: string;
    uqc: string;
    quantity: number;
    invoice_value_paise: number;
    taxable_value_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
    cess_paise: number;
}

export interface GSTR1Warning {
    severity: "info" | "warning" | "error";
    message: string;
    affectedInvoices?: string[];
}

export interface GSTR1Prep {
    fy_label: string;
    quarter: Quarter;
    period_start: string;
    period_end: string;
    fp_code: string;                  // MMYYYY — last month of quarter
    business_gstin: string;
    business_state_code: string;
    lut_active: boolean;
    generated_at: string;

    totals: {
        invoiceCount: number;
        totalInvoiceValue_paise: number;
        totalTaxableValue_paise: number;
        totalCgst_paise: number;
        totalSgst_paise: number;
        totalIgst_paise: number;
        totalCess_paise: number;
    };

    sections: {
        b2b: {
            count: number;
            taxableValue_paise: number;
            taxTotal_paise: number;
            rows: B2BInvoiceRow[];
        };
        b2cs: {
            count: number;
            taxableValue_paise: number;
            taxTotal_paise: number;
            rows: B2CSConsolidatedRow[];
        };
        exp: {
            count: number;
            taxableValue_paise: number;
            taxTotal_paise: number;
            rows: ExportInvoiceRow[];
        };
        hsn: {
            rows: HSNSummaryRow[];
        };
    };

    warnings: GSTR1Warning[];
}

// ─── GSTN-spec JSON shapes (serialized output) ─────────────────────────────

interface GstnItem {
    num: number;
    itm_det: {
        txval: number; rt: number;
        iamt: number; camt: number; samt: number; csamt: number;
    };
}

interface GstnB2BInvoice {
    inum: string; idt: string; val: number;
    pos: string; rchrg: "Y" | "N"; etin: string;
    inv_typ: "R" | "SEWP" | "SEWOP" | "DE";
    itms: GstnItem[];
}

interface GstnB2BCustomer {
    ctin: string;
    inv: GstnB2BInvoice[];
}

interface GstnB2CSRow {
    sply_ty: "INTRA" | "INTER";
    rt: number;
    typ: "OE" | "E";
    etin: string;
    pos: string;
    txval: number;
    iamt: number; camt: number; samt: number; csamt: number;
}

interface GstnExpInvoice {
    inum: string; idt: string; val: number;
    sbpcode: string; sbnum: string; sbdt: string;
    itms: { txval: number; rt: number; iamt: number; csamt: number }[];
}

interface GstnExpSection {
    exp_typ: "WPAY" | "WOPAY";
    inv: GstnExpInvoice[];
}

interface GstnHsnRow {
    num: number;
    hsn_sc: string;
    desc: string;
    uqc: string;
    qty: number;
    val: number;
    txval: number;
    iamt: number; camt: number; samt: number; csamt: number;
}

export interface GSTR1Json {
    gstin: string;
    fp: string;
    gt: number;
    cur_gt: number;
    b2b: GstnB2BCustomer[];
    b2cs: GstnB2CSRow[];
    exp: GstnExpSection[];
    hsn: { data: GstnHsnRow[] };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const n = (v: unknown): number =>
    typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : Number(v ?? 0);

const QUARTER_MONTHS: Record<Quarter, [number, number, number]> = {
    Q1: [3, 4, 5],    // Apr, May, Jun (0-indexed)
    Q2: [6, 7, 8],    // Jul, Aug, Sep
    Q3: [9, 10, 11],  // Oct, Nov, Dec
    Q4: [0, 1, 2],    // Jan, Feb, Mar
};

const QUARTER_LAST_MONTH: Record<Quarter, number> = { Q1: 6, Q2: 9, Q3: 12, Q4: 3 };

function fyToYears(fyLabel: string): { startYear: number; endYear: number } {
    const m = /^FY(\d{4})-(\d{2})$/.exec(fyLabel);
    if (!m) throw new Error(`Invalid FY label: ${fyLabel}`);
    const startYear = parseInt(m[1], 10);
    return { startYear, endYear: startYear + 1 };
}

function quarterBounds(fyLabel: string, q: Quarter): { startIso: string; endIso: string; fpCode: string } {
    const { startYear, endYear } = fyToYears(fyLabel);
    const months = QUARTER_MONTHS[q];
    const isQ4 = q === "Q4";
    const yearForQuarter = isQ4 ? endYear : startYear;
    const startDate = new Date(Date.UTC(yearForQuarter, months[0], 1));
    const endDate = new Date(Date.UTC(yearForQuarter, months[2] + 1, 0));  // last day of last month
    const lastMonth = QUARTER_LAST_MONTH[q];
    const lastMonthYear = isQ4 ? endYear : startYear;
    const fpCode = String(lastMonth).padStart(2, "0") + lastMonthYear;
    return {
        startIso: startDate.toISOString().slice(0, 10),
        endIso: endDate.toISOString().slice(0, 10),
        fpCode,
    };
}

/** ISO date (yyyy-mm-dd or full timestamp) → "dd-mm-yyyy" for GSTN portal. */
function toGstnDate(iso: string): string {
    const d = iso.slice(0, 10);
    const [y, m, dd] = d.split("-");
    return `${dd}-${m}-${y}`;
}

/** paise → rupees with 2-decimal precision (number, not string). */
function rupees(paise: number): number {
    return Math.round(paise) / 100;
}

// ─── Main entry: build prep + JSON for a quarter ───────────────────────────

export async function buildGSTR1(
    fyLabel: string,
    quarter: Quarter
): Promise<{ prep: GSTR1Prep; json: GSTR1Json }> {
    const profile = await getBusinessTaxProfile();
    if (!profile.gstin) {
        throw new Error("Business GSTIN not set — activate it in Tax Profile before generating GSTR-1.");
    }
    const businessState = profile.gstin_state_code || "27";  // default Maharashtra
    const { startIso, endIso, fpCode } = quarterBounds(fyLabel, quarter);

    // ─── Fetch invoices + snapshots + client profiles in window ────────────
    const { data: invoiceRows, error: invErr } = await supabase
        .from("invoices")
        .select("id, invoice_number, deal_token, amount_paise, currency, issued_at")
        .gte("issued_at", startIso)
        .lte("issued_at", endIso + "T23:59:59Z")
        .order("issued_at", { ascending: true });
    if (invErr) throw new Error(`GSTR-1: fetch invoices failed — ${invErr.message}`);

    const invoiceIds = (invoiceRows ?? []).map((r) => r.id as string);
    const dealTokens = Array.from(new Set((invoiceRows ?? []).map((r) => r.deal_token).filter(Boolean)));

    const [snapsRes, clientsRes] = await Promise.all([
        invoiceIds.length > 0
            ? supabase.from("invoice_tax_snapshot").select("*").in("invoice_id", invoiceIds)
            : Promise.resolve({ data: [], error: null }),
        dealTokens.length > 0
            ? supabase.from("client_tax_profile").select("*").in("deal_token", dealTokens as string[])
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (snapsRes.error) throw new Error(`GSTR-1: fetch snapshots — ${snapsRes.error.message}`);
    if (clientsRes.error) throw new Error(`GSTR-1: fetch clients — ${clientsRes.error.message}`);

    const snapById = new Map<string, Record<string, unknown>>();
    for (const s of (snapsRes.data ?? []) as Record<string, unknown>[]) {
        snapById.set(s.invoice_id as string, s);
    }
    const clientByToken = new Map<string, Record<string, unknown>>();
    for (const c of (clientsRes.data ?? []) as Record<string, unknown>[]) {
        clientByToken.set(c.deal_token as string, c);
    }

    // ─── Classify each invoice ────────────────────────────────────────────
    const b2b: B2BInvoiceRow[] = [];
    const b2csRaw: B2CSConsolidatedRow[] = [];   // will consolidate after collect
    const b2csTemp: { rate: number; sply_ty: "INTRA" | "INTER"; pos: string;
        taxable_paise: number; cgst_paise: number; sgst_paise: number;
        igst_paise: number; cess_paise: number; count: number }[] = [];
    const exp: ExportInvoiceRow[] = [];
    const hsnTemp: Record<string, HSNSummaryRow> = {};
    const warnings: GSTR1Warning[] = [];

    let totalInvoiceValue = 0, totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalCess = 0;

    for (const inv of (invoiceRows ?? [])) {
        const snap = snapById.get(inv.id as string);
        if (!snap) {
            warnings.push({
                severity: "warning",
                message: `Invoice ${inv.invoice_number} has no tax snapshot — skipped from GSTR-1.`,
                affectedInvoices: [inv.invoice_number as string],
            });
            continue;
        }

        const treatment = snap.treatment as string;
        const client = inv.deal_token ? clientByToken.get(inv.deal_token as string) : null;
        const clientGstin = (client?.client_gstin as string | undefined) ?? null;
        const clientName = (client?.legal_name as string | undefined) ?? null;
        const sac = (snap.sac_code as string) || "998313";
        const rate = n(snap.gst_rate);
        const pos = (snap.place_of_supply as string) || "";

        // Currency conversion: INR invoices → snap.taxable_value_minor is paise
        // USD invoices → use snap.inr_equivalent_paise (INR equivalent)
        const invCurrency = (snap.invoice_currency as string) || "INR";
        const taxablePaise = invCurrency === "INR"
            ? n(snap.taxable_value_minor)
            : (snap.inr_equivalent_paise != null ? n(snap.inr_equivalent_paise) : n(snap.taxable_value_minor));
        const invValuePaise = invCurrency === "INR"
            ? n(snap.total_invoice_minor)
            : (snap.inr_equivalent_paise != null ? n(snap.inr_equivalent_paise) : n(snap.total_invoice_minor));
        const cgstPaise = invCurrency === "INR" ? n(snap.cgst_amount_minor) : 0;
        const sgstPaise = invCurrency === "INR" ? n(snap.sgst_amount_minor) : 0;
        const igstPaise = invCurrency === "INR" ? n(snap.igst_amount_minor) : 0;
        const cessPaise = 0;

        totalInvoiceValue += invValuePaise;
        totalTaxable += taxablePaise;
        totalCgst += cgstPaise;
        totalSgst += sgstPaise;
        totalIgst += igstPaise;
        totalCess += cessPaise;

        // ─── Classify ──
        if (treatment === "intra_state" || treatment === "inter_state") {
            if (!clientGstin) {
                warnings.push({
                    severity: "warning",
                    message: `Invoice ${inv.invoice_number} treated as B2B but no client GSTIN — treating as B2CS.`,
                    affectedInvoices: [inv.invoice_number as string],
                });
                // fall through to B2CS
                const sply: "INTRA" | "INTER" = treatment === "intra_state" ? "INTRA" : "INTER";
                addToB2CS(b2csTemp, sply, rate, pos, taxablePaise, cgstPaise, sgstPaise, igstPaise, cessPaise);
            } else {
                b2b.push({
                    invoice_id: inv.id as string,
                    invoice_number: inv.invoice_number as string,
                    invoice_date: (inv.issued_at as string).slice(0, 10),
                    client_name: clientName,
                    client_gstin: clientGstin,
                    place_of_supply_code: deriveStateCode(pos, businessState),
                    invoice_value_paise: invValuePaise,
                    taxable_value_paise: taxablePaise,
                    cgst_paise: cgstPaise,
                    sgst_paise: sgstPaise,
                    igst_paise: igstPaise,
                    cess_paise: cessPaise,
                    rate,
                    sac_code: sac,
                    treatment: treatment as "intra_state" | "inter_state",
                });
            }
        } else if (treatment === "b2c_intra" || treatment === "b2c_inter") {
            const sply: "INTRA" | "INTER" = treatment === "b2c_intra" ? "INTRA" : "INTER";
            addToB2CS(b2csTemp, sply, rate, pos, taxablePaise, cgstPaise, sgstPaise, igstPaise, cessPaise);
        } else if (treatment === "export_lut_zero_rated" || treatment === "export_with_igst") {
            const isLut = treatment === "export_lut_zero_rated";
            exp.push({
                invoice_id: inv.id as string,
                invoice_number: inv.invoice_number as string,
                invoice_date: (inv.issued_at as string).slice(0, 10),
                invoice_value_paise: invValuePaise,
                taxable_value_paise: taxablePaise,
                igst_paise: isLut ? 0 : igstPaise,
                cess_paise: cessPaise,
                rate: isLut ? 0 : rate,
                export_type: isLut ? "WOPAY" : "WPAY",
                client_country: pos || "Outside India",
                sac_code: sac,
            });
        } else {
            warnings.push({
                severity: "info",
                message: `Invoice ${inv.invoice_number} treatment "${treatment}" not yet auto-classified — verify manually.`,
                affectedInvoices: [inv.invoice_number as string],
            });
        }

        // ─── HSN summary accumulation ──
        const hsnKey = `${sac}|${rate}`;
        if (!hsnTemp[hsnKey]) {
            hsnTemp[hsnKey] = {
                hsn_sc: sac,
                description: sacDescription(sac),
                uqc: "OTH",
                quantity: 0,
                invoice_value_paise: 0,
                taxable_value_paise: 0,
                cgst_paise: 0, sgst_paise: 0, igst_paise: 0, cess_paise: 0,
            };
        }
        const h = hsnTemp[hsnKey];
        h.quantity += 1;
        h.invoice_value_paise += invValuePaise;
        h.taxable_value_paise += taxablePaise;
        h.cgst_paise += cgstPaise;
        h.sgst_paise += sgstPaise;
        h.igst_paise += igstPaise;
        h.cess_paise += cessPaise;
    }

    // Consolidate b2csTemp into final rows
    for (const t of b2csTemp) {
        b2csRaw.push({
            supply_type: t.sply_ty,
            rate: t.rate,
            place_of_supply_code: deriveStateCode(t.pos, businessState),
            taxable_value_paise: t.taxable_paise,
            cgst_paise: t.cgst_paise,
            sgst_paise: t.sgst_paise,
            igst_paise: t.igst_paise,
            cess_paise: t.cess_paise,
            invoice_count: t.count,
        });
    }

    const hsnRows = Object.values(hsnTemp);
    const prep: GSTR1Prep = {
        fy_label: fyLabel,
        quarter,
        period_start: startIso,
        period_end: endIso,
        fp_code: fpCode,
        business_gstin: profile.gstin,
        business_state_code: businessState,
        lut_active: profile.lut_active,
        generated_at: new Date().toISOString(),
        totals: {
            invoiceCount: (invoiceRows ?? []).length,
            totalInvoiceValue_paise: totalInvoiceValue,
            totalTaxableValue_paise: totalTaxable,
            totalCgst_paise: totalCgst,
            totalSgst_paise: totalSgst,
            totalIgst_paise: totalIgst,
            totalCess_paise: totalCess,
        },
        sections: {
            b2b: {
                count: b2b.length,
                taxableValue_paise: sum(b2b.map((r) => r.taxable_value_paise)),
                taxTotal_paise: sum(b2b.map((r) => r.cgst_paise + r.sgst_paise + r.igst_paise + r.cess_paise)),
                rows: b2b,
            },
            b2cs: {
                count: sum(b2csRaw.map((r) => r.invoice_count)),
                taxableValue_paise: sum(b2csRaw.map((r) => r.taxable_value_paise)),
                taxTotal_paise: sum(b2csRaw.map((r) => r.cgst_paise + r.sgst_paise + r.igst_paise + r.cess_paise)),
                rows: b2csRaw,
            },
            exp: {
                count: exp.length,
                taxableValue_paise: sum(exp.map((r) => r.taxable_value_paise)),
                taxTotal_paise: sum(exp.map((r) => r.igst_paise + r.cess_paise)),
                rows: exp,
            },
            hsn: { rows: hsnRows },
        },
        warnings,
    };

    // Sanity warnings
    if (prep.totals.invoiceCount === 0) {
        warnings.push({
            severity: "info",
            message: "No invoices in this period — return will be a nil filing.",
        });
    }
    if (exp.length > 0 && !profile.lut_active) {
        warnings.push({
            severity: "warning",
            message: "Exports present but LUT not active — exports will attract 18% IGST unless LUT is filed.",
        });
    }

    const json = toGstnJson(prep);
    return { prep, json };
}

function addToB2CS(
    temp: { rate: number; sply_ty: "INTRA" | "INTER"; pos: string;
        taxable_paise: number; cgst_paise: number; sgst_paise: number;
        igst_paise: number; cess_paise: number; count: number }[],
    sply: "INTRA" | "INTER", rate: number, pos: string,
    taxable: number, cgst: number, sgst: number, igst: number, cess: number,
) {
    const existing = temp.find((t) => t.sply_ty === sply && t.rate === rate && t.pos === pos);
    if (existing) {
        existing.taxable_paise += taxable;
        existing.cgst_paise += cgst;
        existing.sgst_paise += sgst;
        existing.igst_paise += igst;
        existing.cess_paise += cess;
        existing.count += 1;
    } else {
        temp.push({ sply_ty: sply, rate, pos, taxable_paise: taxable, cgst_paise: cgst, sgst_paise: sgst, igst_paise: igst, cess_paise: cess, count: 1 });
    }
}

function deriveStateCode(stateOrCode: string, fallback: string): string {
    // If already a 2-digit code, use as-is
    if (/^\d{2}$/.test(stateOrCode)) return stateOrCode;
    // Else try mapping via STATE_CODES (deferred to avoid circular import); fall back
    return fallback;
}

function sacDescription(sac: string): string {
    const map: Record<string, string> = {
        "998313": "IT design and development services",
        "998314": "IT infrastructure provisioning services",
        "998315": "IT support / maintenance services",
        "998311": "IT consulting and advisory services",
        "998316": "Data processing services",
    };
    return map[sac] || "Information technology services";
}

function sum(xs: number[]): number {
    return xs.reduce((a, b) => a + b, 0);
}

// ─── Convert prep → GSTN JSON ──────────────────────────────────────────────

function toGstnJson(prep: GSTR1Prep): GSTR1Json {
    // Group B2B by client GSTIN
    const byClient = new Map<string, B2BInvoiceRow[]>();
    for (const row of prep.sections.b2b.rows) {
        const list = byClient.get(row.client_gstin) || [];
        list.push(row);
        byClient.set(row.client_gstin, list);
    }
    const b2bJson: GstnB2BCustomer[] = Array.from(byClient.entries()).map(([ctin, rows]) => ({
        ctin,
        inv: rows.map((r) => ({
            inum: r.invoice_number,
            idt: toGstnDate(r.invoice_date),
            val: rupees(r.invoice_value_paise),
            pos: r.place_of_supply_code,
            rchrg: "N" as const,
            etin: "",
            inv_typ: "R" as const,
            itms: [
                {
                    num: 1,
                    itm_det: {
                        txval: rupees(r.taxable_value_paise),
                        rt: r.rate,
                        iamt: rupees(r.igst_paise),
                        camt: rupees(r.cgst_paise),
                        samt: rupees(r.sgst_paise),
                        csamt: rupees(r.cess_paise),
                    },
                },
            ],
        })),
    }));

    const b2csJson: GstnB2CSRow[] = prep.sections.b2cs.rows.map((r) => ({
        sply_ty: r.supply_type,
        rt: r.rate,
        typ: "OE" as const,
        etin: "",
        pos: r.place_of_supply_code,
        txval: rupees(r.taxable_value_paise),
        iamt: rupees(r.igst_paise),
        camt: rupees(r.cgst_paise),
        samt: rupees(r.sgst_paise),
        csamt: rupees(r.cess_paise),
    }));

    // Group exports by type
    const expByType = new Map<"WOPAY" | "WPAY", ExportInvoiceRow[]>();
    for (const row of prep.sections.exp.rows) {
        const list = expByType.get(row.export_type) || [];
        list.push(row);
        expByType.set(row.export_type, list);
    }
    const expJson: GstnExpSection[] = Array.from(expByType.entries()).map(([typ, rows]) => ({
        exp_typ: typ,
        inv: rows.map((r) => ({
            inum: r.invoice_number,
            idt: toGstnDate(r.invoice_date),
            val: rupees(r.invoice_value_paise),
            sbpcode: "",  // service exports: no shipping bill
            sbnum: "",
            sbdt: "",
            itms: [
                {
                    txval: rupees(r.taxable_value_paise),
                    rt: r.rate,
                    iamt: rupees(r.igst_paise),
                    csamt: rupees(r.cess_paise),
                },
            ],
        })),
    }));

    const hsnJson: GstnHsnRow[] = prep.sections.hsn.rows.map((r, idx) => ({
        num: idx + 1,
        hsn_sc: r.hsn_sc,
        desc: r.description,
        uqc: r.uqc,
        qty: r.quantity,
        val: rupees(r.invoice_value_paise),
        txval: rupees(r.taxable_value_paise),
        iamt: rupees(r.igst_paise),
        camt: rupees(r.cgst_paise),
        samt: rupees(r.sgst_paise),
        csamt: rupees(r.cess_paise),
    }));

    return {
        gstin: prep.business_gstin,
        fp: prep.fp_code,
        gt: 0,
        cur_gt: rupees(prep.totals.totalTaxableValue_paise),
        b2b: b2bJson,
        b2cs: b2csJson,
        exp: expJson,
        hsn: { data: hsnJson },
    };
}
