// ─── DATE UTILS — timezone-safe calendar-date helpers ──────────────────────
// Government deadlines are calendar dates (no time component).
//
// THE BUG THESE AVOID:
//   `new Date(2027, 2, 15)` builds a date in LOCAL time. In IST (UTC+5:30),
//   `.toISOString()` then renders it as the PREVIOUS day (2027-03-14).
//   Every deadline would silently be one day early. Caught by tax-engine
//   tests on 2026-05-14.
//
// Rule: never round-trip a locally-constructed Date through toISOString().
// Use these helpers instead.

/** Format year + 0-indexed month + day directly to 'yyyy-mm-dd'. No TZ math. */
export function isoDate(year: number, monthZeroIdx: number, day: number): string {
    const mm = String(monthZeroIdx + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

/** Date object pinned to UTC midnight — safe for arithmetic AND toISOString(). */
export function utcDate(year: number, monthZeroIdx: number, day: number): Date {
    return new Date(Date.UTC(year, monthZeroIdx, day));
}

/** 'yyyy-mm-dd' from a Date, using its UTC components. */
export function toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from a → b (b minus a). */
export function daysBetween(a: Date, b: Date): number {
    return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

/** Add n days to a date, returning a new UTC-midnight Date. */
export function addDays(d: Date, n: number): Date {
    return new Date(d.getTime() + n * DAY_MS);
}
