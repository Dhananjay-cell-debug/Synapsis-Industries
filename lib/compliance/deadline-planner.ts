// ─── DEADLINE PLANNER — pure compliance-calendar logic ─────────────────────
// Computes the full set of compliance tasks for any fiscal year.
// Pure functions only — NO DB, NO server-only. Fully testable in isolation.
// The DB seeder + read API live in deadline-engine.ts (which imports this).

import type { TaskKind, TaskSeverity } from './types';
import { isoDate, utcDate, addDays } from './date-utils';

export interface FYBounds {
    fy_label: string;        // 'FY2026-27'
    start: Date;             // April 1  (UTC midnight)
    end: Date;               // March 31 next year (UTC midnight)
    end_year: number;        // 2027 for FY2026-27
    start_year: number;      // 2026
}

export function fyBoundsForDate(d: Date = new Date()): FYBounds {
    const month = d.getMonth(); // 0-11
    const year = d.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    return {
        fy_label: `FY${startYear}-${String(endYear).slice(-2)}`,
        start: utcDate(startYear, 3, 1),    // April 1
        end: utcDate(endYear, 2, 31),       // March 31
        start_year: startYear,
        end_year: endYear,
    };
}

/** Parse 'FY2026-27' → bounds. Throws on bad label. */
export function fyBoundsFromLabel(label: string): FYBounds {
    const m = /^FY(\d{4})-(\d{2})$/.exec(label);
    if (!m) throw new Error(`fyBoundsFromLabel: bad FY label "${label}"`);
    const startYear = parseInt(m[1], 10);
    const endYear = startYear + 1;
    return {
        fy_label: label,
        start: utcDate(startYear, 3, 1),
        end: utcDate(endYear, 2, 31),
        start_year: startYear,
        end_year: endYear,
    };
}

export interface PlannedTask {
    kind: TaskKind;
    title: string;
    description: string;
    period: string | null;
    due_date: string;         // ISO yyyy-mm-dd
    severity: TaskSeverity;
}

export interface SchemeConfig {
    gstActive: boolean;
    gstFiling: 'qrmp' | 'monthly' | 'composition';
    lutActive: boolean;
    scheme: '44ADA' | '44AD' | 'regular';
    healthInsuranceMonth?: number;   // 1-12, optional
}

/**
 * Compute every compliance task that should exist for the given FY.
 * Idempotent: calling twice produces the same plan. The DB seeder uses the
 * (kind, period) unique index to avoid duplicates.
 */
export function planFYTasks(fy: FYBounds, scheme: SchemeConfig): PlannedTask[] {
    const tasks: PlannedTask[] = [];

    // ─── LUT renewal ─────────────────────────────────────────────────────
    if (scheme.lutActive || scheme.gstActive) {
        tasks.push({
            kind: 'lut-renewal',
            title: `LUT renewal for ${fy.fy_label}`,
            description: `File Letter of Undertaking on GST portal for export-of-services zero-rated treatment. Services → User Services → Furnish LUT.`,
            period: fy.fy_label,
            due_date: isoDate(fy.start_year, 3, 1), // 1 April
            severity: 'critical',
        });
    }

    // ─── GST returns ─────────────────────────────────────────────────────
    if (scheme.gstActive && scheme.gstFiling !== 'composition') {
        // GSTR-3B is always monthly, even under QRMP
        for (let i = 0; i < 12; i++) {
            const month = (3 + i) % 12;            // start at April (3), wrap
            const year = month >= 3 ? fy.start_year : fy.end_year;
            const dueMonth = (month + 1) % 12;
            const dueYear = dueMonth === 0 ? year + 1 : (dueMonth < month ? year + 1 : year);

            const periodLabel = `${year}-${String(month + 1).padStart(2, '0')}`;
            tasks.push({
                kind: 'gstr-3b',
                title: `GSTR-3B for ${periodLabel}`,
                description: `Monthly summary return + tax payment. Output GST − ITC = net payable.`,
                period: periodLabel,
                due_date: isoDate(dueYear, dueMonth, 20),
                severity: 'critical',
            });
        }

        // GSTR-1: monthly OR quarterly under QRMP
        if (scheme.gstFiling === 'qrmp') {
            const quarters = [
                { label: 'Q1', dueMonth: 6,  dueYear: fy.start_year },   // Apr-Jun → 13 Jul
                { label: 'Q2', dueMonth: 9,  dueYear: fy.start_year },   // Jul-Sep → 13 Oct
                { label: 'Q3', dueMonth: 0,  dueYear: fy.end_year },     // Oct-Dec → 13 Jan
                { label: 'Q4', dueMonth: 3,  dueYear: fy.end_year },     // Jan-Mar → 13 Apr
            ];
            for (const q of quarters) {
                tasks.push({
                    kind: 'gstr-1',
                    title: `GSTR-1 ${q.label} ${fy.fy_label}`,
                    description: `Quarterly outward supply return under QRMP. Report invoices issued in this quarter.`,
                    period: `${fy.fy_label}-${q.label}`,
                    due_date: isoDate(q.dueYear, q.dueMonth, 13),
                    severity: 'critical',
                });
            }
        } else {
            // monthly
            for (let i = 0; i < 12; i++) {
                const month = (3 + i) % 12;
                const year = month >= 3 ? fy.start_year : fy.end_year;
                const dueMonth = (month + 1) % 12;
                const dueYear = dueMonth === 0 ? year + 1 : (dueMonth < month ? year + 1 : year);
                const periodLabel = `${year}-${String(month + 1).padStart(2, '0')}`;
                tasks.push({
                    kind: 'gstr-1',
                    title: `GSTR-1 for ${periodLabel}`,
                    description: `Monthly outward supply return.`,
                    period: periodLabel,
                    due_date: isoDate(dueYear, dueMonth, 11),
                    severity: 'critical',
                });
            }
        }

        // GSTR-9 annual: 31 Dec of AY (surfaced only when turnover > ₹2Cr)
        tasks.push({
            kind: 'gstr-9',
            title: `GSTR-9 annual return ${fy.fy_label} (if applicable)`,
            description: `Annual GST return. Mandatory if turnover > ₹2Cr. Optional below. Auto-skip if not triggered.`,
            period: fy.fy_label,
            due_date: isoDate(fy.end_year, 11, 31), // Dec 31 of FY-end year
            severity: 'informational',
        });
    }

    // ─── Income tax — advance tax + ITR ─────────────────────────────────
    if (scheme.scheme === '44ADA') {
        tasks.push({
            kind: 'advance-tax',
            title: `Advance Tax (44ADA full) — ${fy.fy_label}`,
            description: `Pay 100% of FY tax liability via Challan 280 (advance tax). Single installment under 44ADA.`,
            period: fy.fy_label,
            due_date: isoDate(fy.end_year, 2, 15), // March 15
            severity: 'critical',
        });
        tasks.push({
            kind: 'itr-4',
            title: `ITR-4 (Sugam) filing — ${fy.fy_label}`,
            description: `Annual income tax return under 44ADA. File on incometax.gov.in. Standard deadline 31 July of AY.`,
            period: fy.fy_label,
            due_date: isoDate(fy.end_year, 6, 31), // July 31
            severity: 'critical',
        });
    } else if (scheme.scheme === 'regular') {
        const installments = [
            { label: 'Q1', dueMonth: 5,  dueYear: fy.start_year, pct: 15 },  // 15 Jun
            { label: 'Q2', dueMonth: 8,  dueYear: fy.start_year, pct: 45 },  // 15 Sep
            { label: 'Q3', dueMonth: 11, dueYear: fy.start_year, pct: 75 },  // 15 Dec
            { label: 'Q4', dueMonth: 2,  dueYear: fy.end_year,   pct: 100 }, // 15 Mar
        ];
        for (const inst of installments) {
            tasks.push({
                kind: 'advance-tax',
                title: `Advance Tax ${inst.label} (${inst.pct}% cumulative) — ${fy.fy_label}`,
                description: `Regular advance tax installment.`,
                period: `${fy.fy_label}-${inst.label}`,
                due_date: isoDate(inst.dueYear, inst.dueMonth, 15),
                severity: 'critical',
            });
        }
        tasks.push({
            kind: 'itr-3',
            title: `ITR-3 filing — ${fy.fy_label}`,
            description: `Annual income tax return (regular books). Standard deadline 31 July (tax audit cases: 31 Oct).`,
            period: fy.fy_label,
            due_date: isoDate(fy.end_year, 6, 31),
            severity: 'critical',
        });
    }

    // ─── Tax-saving investments deadline ─────────────────────────────────
    tasks.push({
        kind: 'nps-contribution',
        title: `Tax-saving investment deadline — ${fy.fy_label}`,
        description: `Last day to make 80C / 80CCD(1B) / 80D contributions counted for this FY. Top up PPF / ELSS / NPS / health insurance premium.`,
        period: fy.fy_label,
        due_date: isoDate(fy.end_year, 2, 31), // March 31
        severity: 'critical',
    });

    // ─── Health insurance renewal (if month given) ───────────────────────
    if (scheme.healthInsuranceMonth && scheme.healthInsuranceMonth >= 1 && scheme.healthInsuranceMonth <= 12) {
        const m = scheme.healthInsuranceMonth - 1;
        const yr = m >= 3 ? fy.start_year : fy.end_year;
        tasks.push({
            kind: 'health-insurance-renewal',
            title: `Health insurance renewal — ${fy.fy_label}`,
            description: `Renew policy for next year. Save receipt for 80D claim.`,
            period: fy.fy_label,
            due_date: isoDate(yr, m, 15),
            severity: 'standard',
        });
    }

    // ─── Udyam annual update (self-declaration) ──────────────────────────
    tasks.push({
        kind: 'udyam-update',
        title: `Udyam self-declaration update — ${fy.fy_label}`,
        description: `Annual Udyam update with turnover/employment data. Self-service on udyamregistration.gov.in.`,
        period: fy.fy_label,
        due_date: isoDate(fy.end_year, 3, 30), // April 30 (after FY close)
        severity: 'informational',
    });

    return tasks;
}

// ─── Reminder offset computation ─────────────────────────────────────────

export function computeRemindAt(dueDateIso: string): { t7: string; t3: string; t1: string } {
    const due = new Date(dueDateIso + 'T09:00:00Z'); // 9am UTC of due-day
    return {
        t7: addDays(due, -7).toISOString(),
        t3: addDays(due, -3).toISOString(),
        t1: addDays(due, -1).toISOString(),
    };
}
