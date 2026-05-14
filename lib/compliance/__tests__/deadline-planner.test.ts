// ─── DEADLINE PLANNER TESTS ────────────────────────────────────────────────
// Standalone runnable. Run:  npx tsx lib/compliance/__tests__/deadline-planner.test.ts
// Verifies the compliance calendar logic — FY bounds, task generation, reminders.

import {
    fyBoundsForDate,
    fyBoundsFromLabel,
    planFYTasks,
    computeRemindAt,
    type SchemeConfig,
} from '../deadline-planner';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function eq(name: string, actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) { passed++; }
    else { failed++; failures.push(`✗ ${name}\n    expected: ${e}\n    actual:   ${a}`); }
}
function ok(name: string, cond: boolean) {
    if (cond) { passed++; } else { failed++; failures.push(`✗ ${name}`); }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. FY bounds
// ═══════════════════════════════════════════════════════════════════════════

// May 14 2026 → FY2026-27
const fyMay = fyBoundsForDate(new Date('2026-05-14'));
eq('FY bounds: May 2026 → FY2026-27', fyMay.fy_label, 'FY2026-27');
eq('FY bounds: start = 2026-04-01', fyMay.start.toISOString().slice(0, 10), '2026-04-01');
eq('FY bounds: end = 2027-03-31', fyMay.end.toISOString().slice(0, 10), '2027-03-31');
eq('FY bounds: start_year', fyMay.start_year, 2026);
eq('FY bounds: end_year', fyMay.end_year, 2027);

// Jan 2027 still belongs to FY2026-27
const fyJan = fyBoundsForDate(new Date('2027-01-15'));
eq('FY bounds: Jan 2027 → FY2026-27', fyJan.fy_label, 'FY2026-27');

// March 31 2027 still FY2026-27; April 1 2027 → FY2027-28
const fyMar = fyBoundsForDate(new Date('2027-03-31'));
eq('FY bounds: Mar 31 2027 → FY2026-27', fyMar.fy_label, 'FY2026-27');
const fyApr = fyBoundsForDate(new Date('2027-04-01'));
eq('FY bounds: Apr 1 2027 → FY2027-28', fyApr.fy_label, 'FY2027-28');

// fromLabel round-trips
const fromLabel = fyBoundsFromLabel('FY2026-27');
eq('fyBoundsFromLabel: label', fromLabel.fy_label, 'FY2026-27');
eq('fyBoundsFromLabel: start', fromLabel.start.toISOString().slice(0, 10), '2026-04-01');
eq('fyBoundsFromLabel: end', fromLabel.end.toISOString().slice(0, 10), '2027-03-31');

let threw = false;
try { fyBoundsFromLabel('garbage'); } catch { threw = true; }
ok('fyBoundsFromLabel: throws on bad label', threw);

// ═══════════════════════════════════════════════════════════════════════════
// 2. Task generation — Synapsis current config (44ADA, QRMP, GST active, LUT)
// ═══════════════════════════════════════════════════════════════════════════

const synapsisScheme: SchemeConfig = {
    gstActive: true,
    gstFiling: 'qrmp',
    lutActive: true,
    scheme: '44ADA',
    healthInsuranceMonth: 8, // August
};

const tasks = planFYTasks(fyMay, synapsisScheme);

// Count by kind
const byKind: Record<string, number> = {};
for (const t of tasks) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;

eq('tasks: 12 GSTR-3B (monthly)', byKind['gstr-3b'], 12);
eq('tasks: 4 GSTR-1 (quarterly QRMP)', byKind['gstr-1'], 4);
eq('tasks: 1 GSTR-9', byKind['gstr-9'], 1);
eq('tasks: 1 LUT renewal', byKind['lut-renewal'], 1);
eq('tasks: 1 advance-tax (44ADA single)', byKind['advance-tax'], 1);
eq('tasks: 1 ITR-4', byKind['itr-4'], 1);
eq('tasks: 0 ITR-3 (not regular scheme)', byKind['itr-3'] ?? 0, 0);
eq('tasks: 1 nps-contribution deadline', byKind['nps-contribution'], 1);
eq('tasks: 1 health insurance renewal', byKind['health-insurance-renewal'], 1);
eq('tasks: 1 udyam update', byKind['udyam-update'], 1);

// total = 12+4+1+1+1+1+1+1+1 = 23
eq('tasks: total count = 23', tasks.length, 23);

// ─── specific due dates ───
const lut = tasks.find(t => t.kind === 'lut-renewal')!;
eq('LUT due 2026-04-01', lut.due_date, '2026-04-01');

const advTax = tasks.find(t => t.kind === 'advance-tax')!;
eq('Advance tax due 2027-03-15', advTax.due_date, '2027-03-15');

const itr4 = tasks.find(t => t.kind === 'itr-4')!;
eq('ITR-4 due 2027-07-31', itr4.due_date, '2027-07-31');

const nps = tasks.find(t => t.kind === 'nps-contribution')!;
eq('Tax-saving deadline 2027-03-31', nps.due_date, '2027-03-31');

const gstr9 = tasks.find(t => t.kind === 'gstr-9')!;
eq('GSTR-9 due 2027-12-31', gstr9.due_date, '2027-12-31');

// GSTR-3B for April 2026 → due 2026-05-20
const gstr3bApr = tasks.find(t => t.kind === 'gstr-3b' && t.period === '2026-04')!;
ok('GSTR-3B Apr 2026 exists', !!gstr3bApr);
eq('GSTR-3B Apr 2026 due 2026-05-20', gstr3bApr.due_date, '2026-05-20');

// GSTR-3B for March 2027 → due 2027-04-20
const gstr3bMar = tasks.find(t => t.kind === 'gstr-3b' && t.period === '2027-03')!;
ok('GSTR-3B Mar 2027 exists', !!gstr3bMar);
eq('GSTR-3B Mar 2027 due 2027-04-20', gstr3bMar.due_date, '2027-04-20');

// GSTR-1 Q1 → due 2026-07-13
const gstr1q1 = tasks.find(t => t.kind === 'gstr-1' && t.period === 'FY2026-27-Q1')!;
ok('GSTR-1 Q1 exists', !!gstr1q1);
eq('GSTR-1 Q1 due 2026-07-13', gstr1q1.due_date, '2026-07-13');

// GSTR-1 Q3 (Oct-Dec) → due 2027-01-13
const gstr1q3 = tasks.find(t => t.kind === 'gstr-1' && t.period === 'FY2026-27-Q3')!;
eq('GSTR-1 Q3 due 2027-01-13', gstr1q3.due_date, '2027-01-13');

// health insurance August → 2026-08-15
const health = tasks.find(t => t.kind === 'health-insurance-renewal')!;
eq('Health insurance due 2026-08-15', health.due_date, '2026-08-15');

// every task has a non-empty title, description, ISO due_date
ok('all tasks have title', tasks.every(t => t.title.length > 0));
ok('all tasks have description', tasks.every(t => t.description.length > 0));
ok('all tasks have ISO due_date', tasks.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t.due_date)));

// ═══════════════════════════════════════════════════════════════════════════
// 3. Scheme variations
// ═══════════════════════════════════════════════════════════════════════════

// Regular scheme → 4 advance tax + ITR-3, no ITR-4
const regularTasks = planFYTasks(fyMay, {
    gstActive: true, gstFiling: 'monthly', lutActive: false, scheme: 'regular',
});
const regKind: Record<string, number> = {};
for (const t of regularTasks) regKind[t.kind] = (regKind[t.kind] ?? 0) + 1;
eq('regular: 4 advance-tax installments', regKind['advance-tax'], 4);
eq('regular: 1 ITR-3', regKind['itr-3'], 1);
eq('regular: 0 ITR-4', regKind['itr-4'] ?? 0, 0);
eq('regular monthly: 12 GSTR-1', regKind['gstr-1'], 12);

// GST not active → no GST tasks at all
const noGst = planFYTasks(fyMay, {
    gstActive: false, gstFiling: 'qrmp', lutActive: false, scheme: '44ADA',
});
const noGstKind: Record<string, number> = {};
for (const t of noGst) noGstKind[t.kind] = (noGstKind[t.kind] ?? 0) + 1;
eq('no GST: 0 GSTR-3B', noGstKind['gstr-3b'] ?? 0, 0);
eq('no GST: 0 GSTR-1', noGstKind['gstr-1'] ?? 0, 0);
eq('no GST: 0 LUT renewal', noGstKind['lut-renewal'] ?? 0, 0);
eq('no GST: still has ITR-4', noGstKind['itr-4'], 1);

// composition scheme → no GSTR returns
const comp = planFYTasks(fyMay, {
    gstActive: true, gstFiling: 'composition', lutActive: false, scheme: '44ADA',
});
const compKind: Record<string, number> = {};
for (const t of comp) compKind[t.kind] = (compKind[t.kind] ?? 0) + 1;
eq('composition: 0 GSTR-3B', compKind['gstr-3b'] ?? 0, 0);

// no health insurance month → no health task
const noHealth = planFYTasks(fyMay, {
    gstActive: true, gstFiling: 'qrmp', lutActive: true, scheme: '44ADA',
});
const noHealthHas = noHealth.some(t => t.kind === 'health-insurance-renewal');
ok('no healthInsuranceMonth → no health task', !noHealthHas);

// ═══════════════════════════════════════════════════════════════════════════
// 4. Idempotency — same input, same (kind, period) set
// ═══════════════════════════════════════════════════════════════════════════

const run1 = planFYTasks(fyMay, synapsisScheme).map(t => `${t.kind}|${t.period}`).sort();
const run2 = planFYTasks(fyMay, synapsisScheme).map(t => `${t.kind}|${t.period}`).sort();
eq('planFYTasks is deterministic', run1, run2);

// no duplicate (kind, period) pairs
const seen = new Set<string>();
let dupes = 0;
for (const key of run1) { if (seen.has(key)) dupes++; seen.add(key); }
eq('no duplicate (kind,period) pairs', dupes, 0);

// ═══════════════════════════════════════════════════════════════════════════
// 5. Reminder computation
// ═══════════════════════════════════════════════════════════════════════════

const rem = computeRemindAt('2027-03-15');
eq('reminder t7 = 7 days before', rem.t7.slice(0, 10), '2027-03-08');
eq('reminder t3 = 3 days before', rem.t3.slice(0, 10), '2027-03-12');
eq('reminder t1 = 1 day before', rem.t1.slice(0, 10), '2027-03-14');

// ═══════════════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n─── DEADLINE PLANNER TEST RESULTS ───');
if (failures.length) {
    console.log(failures.join('\n'));
    console.log(`\n${passed} passed, ${failed} FAILED\n`);
    process.exit(1);
} else {
    console.log(`✓ all ${passed} assertions passed\n`);
    process.exit(0);
}
