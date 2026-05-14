# Synapsis Compliance OS — Master Architecture

> **Status:** Live spec (supersedes `gst-handoff/` planning docs which remain as historical reference).
> **Owner:** Synapsis Industries (Dhananjay Chitmilla, Sole Proprietor).
> **Last revision:** 2026-05-13.
> **Operating mode:** Self-file (no engaged CA). System is the brain; human is the executor.

---

## 1. Mission of this System

Run all government-side obligations of Synapsis Industries on auto-pilot, end-to-end, so that the founder can:

1. Never miss a statutory deadline.
2. Never overpay tax due to ignorance of a legal lever.
3. Never lose a receipt, FIRC, or filing acknowledgement.
4. Generate invoices that are correct on tax treatment without human classification.
5. Hand a CA a clean monthly package the day they are needed (audit, notice, scale-up).

This is **not** a tax-advice engine. It is a **compliance operations layer**. Every tax decision is data-driven, auditable, reversible.

---

## 2. Founder Context (load-bearing assumptions)

| Fact | Value | Source |
|---|---|---|
| Legal entity | Sole Proprietorship | GST application filed as such |
| Proprietor | Dhananjay Chitmilla | `synapsis-config.ts` |
| State | Maharashtra | `synapsis-config.ts` |
| GSTIN status | ARN issued, GSTIN pending (as of 2026-05-13) | User confirmation |
| Banking | Savings account (personal) — current account deferred until alert | User decision |
| Annual turnover (FY 2026-27) | ₹10–20L base, up to ₹50L stretch | User projection |
| Service mix | IT services + AI automation + agentic workflows | `syna_core.md` |
| Client mix | Domestic (India) + International | `syna_core.md` |
| Tax strategy | Section 44ADA presumptive (50% deemed profit) | This system's decision |
| GST regime | Regular (not composition) — exports require regular | This system's decision |
| Filing frequency | QRMP (quarterly GSTR-1, monthly GSTR-3B) — turnover < ₹5Cr | This system's decision |
| CA engagement | None — self-filed | User decision |

> **Trigger to revisit these assumptions:** turnover crossing ₹40L, first GST notice, first international client > $10k, first Indian B2B client deducting TDS, or any of the user-facing alerts the system fires.

---

## 3. Strategy Pillars (the four levers we pull)

### Pillar 1 — Section 44ADA Presumptive Taxation
50% of gross receipts declared as taxable income. No books needed. No audit under ₹75L (digital receipts). See `TAX-STRATEGY.md` for full math + qualifying logic.

### Pillar 2 — LUT for Export of Services
Zero-rated international invoices (no IGST). LUT filed annually on GST portal. Day-1 action when GSTIN arrives.

### Pillar 3 — Deduction Stack
80C (₹1.5L) + 80CCD(1B) (₹50k NPS) + 80D (₹25k health insurance) + 80TTA (₹10k savings interest). Stacked on top of 44ADA. See `TAX-STRATEGY.md`.

### Pillar 4 — GST Input Tax Credit (ITC)
Every SaaS/equipment/professional fee with GST → ITC against output GST liability. Requires vendor invoice in Synapsis name with GSTIN. Tracked per expense row.

---

## 4. Module Map

The system breaks into 9 cooperating modules. Each module owns one concern. UI lives under `/admin/compliance/*`. Logic lives under `lib/compliance/*`. Persistence lives in Supabase `synapsis` schema.

| # | Module | UI route | Library | Tables touched |
|---|---|---|---|---|
| M1 | **Business Tax Profile** | `/admin/compliance/profile` | `business-profile.ts` | `business_tax_profile` |
| M2 | **Client Tax Profile** | `/admin/compliance/clients` | `client-profile.ts` | `client_tax_profile` |
| M3 | **GST Workspace** | `/admin/compliance/gst` | `gst-classifier.ts`, `gstr-prep.ts` | `invoice_tax_snapshot`, `tax_filings` |
| M4 | **Expense Tracking** | `/admin/compliance/expenses` | `expenses.ts`, `email-parser.ts` | `expenses`, `expense_categories` |
| M5 | **Books of Accounts** | `/admin/compliance/books` | `books.ts` | reads M3 + M4 |
| M6 | **Tax Estimate Engine** | `/admin/compliance/tax-estimate` | `tax-engine.ts` | `deductions`, `advance_tax_payments` |
| M7 | **Forex / FIRC Tracker** | `/admin/compliance/forex` | `forex.ts` | `forex_inward` |
| M8 | **Deadline Engine** | `/admin/compliance/calendar` | `deadline-engine.ts` | `compliance_tasks` |
| M9 | **Document Vault** | `/admin/compliance/vault` | `vault.ts` | Supabase Storage |
| M10 | **CA Handoff (optional)** | `/admin/compliance/ca-handoff` | `ca-export.ts` | reads all |

The **Compliance Dashboard** (`/admin/compliance`) is the home screen that surfaces a health score, next 3 deadlines, alerts, and quick actions.

---

## 5. Data Model Overview

All tables live in the `synapsis` schema (same as existing payments). All sensitive identifiers (full GSTIN, full PAN, account numbers) stay server-side. Browser sees masked variants only.

### Core tables (defined in migration `20260513_compliance_os.sql`)

- `business_tax_profile` — singleton row for Synapsis identity (GSTIN, LUT status, state, regime choice, registration date).
- `client_tax_profile` — one row per client (legal name, GSTIN if Indian B2B, billing state/country, place of supply).
- `invoice_tax_snapshot` — immutable per-invoice tax decision (taxable value, CGST/SGST/IGST split, SAC, zero-rated flag, treatment reason, rule version). Links to `invoices.id`.
- `expenses` — every business spend (vendor, date, amount, GST amount, ITC eligible, category, receipt URL, source).
- `expense_categories` — controlled vocabulary (SaaS, equipment, professional, travel, etc.).
- `compliance_tasks` — every deadline + reminder (kind, due_date, status, reminded_at_t7/t3/t1, completed_at).
- `forex_inward` — every international payment with FIRC reference (provider, amount, currency, INR equivalent, FIRC URL, purpose code).
- `tax_filings` — every GSTR/ITR submitted with acknowledgement reference + PDF.
- `deductions` — yearly 80C/80D/80CCD(1B)/etc claims with proof URL.
- `advance_tax_payments` — quarterly installments with challan reference.

All tables: `created_at`, `updated_at`, RLS on, service role only. `invoice_tax_snapshot` and `tax_filings` are append-only (triggers block UPDATE/DELETE).

---

## 6. Tax Decision Rules (the policy engine)

These rules are the **only** place tax logic exists. Encoded in `lib/compliance/tax-engine.ts` and `gst-classifier.ts`. Version-stamped (`rule_version` column on `invoice_tax_snapshot`) so future rule changes don't silently rewrite history.

### 6.1 Invoice GST Classification

Input: client tax profile + Synapsis tax profile + invoice currency.

```
if currency == 'USD' or client.country != 'India':
    if business.lut_active:
        → zero-rated export (no GST charged), reason="LUT-export"
    else:
        → IGST 18% charged (refund later via export-refund flow), reason="export-without-LUT"

elif client.country == 'India':
    if not client.gstin:
        treat as B2C (still tax applies)
    if client.state == business.state ('Maharashtra'):
        → CGST 9% + SGST 9%, reason="intra-state"
    else:
        → IGST 18%, reason="inter-state"
```

SAC code default: `998313` (IT design & development). Configurable per invoice.

### 6.2 Income Tax (44ADA)

```
gross_receipts_FY = sum(invoice.taxable_value) over fiscal year
deemed_income     = max(gross_receipts_FY * 0.50, declared_higher_income)
deductions_total  = 80C + 80CCD(1B) + 80D + 80TTA + ...
taxable_income    = deemed_income - deductions_total
tax_old_regime    = slab(taxable_income, OLD_SLABS_FY2026)
tax_new_regime    = slab(deemed_income, NEW_SLABS_FY2026)  // new regime ignores most chap-VIA deductions
recommended       = min(tax_old, tax_new)
```

### 6.3 Advance Tax Schedule (under 44ADA)

44ADA assessees pay 100% by **15 March** (single installment), not the four-quarter schedule. System still surfaces the date 30 days prior.

### 6.4 LUT Renewal

Annual. Auto-task on **1 April** every FY. Reminder T-15 days.

---

## 7. Sources of Truth

| Concept | Source of truth |
|---|---|
| Tax policy version | `lib/compliance/constants.ts` + rule_version on snapshot |
| Synapsis identity | `business_tax_profile` row + server env vars |
| What's due when | `compliance_tasks` table (auto-seeded by deadline engine) |
| What was filed | `tax_filings` table |
| Income for FY | `invoice_tax_snapshot.taxable_value` sum |
| Expenses for FY | `expenses` table |
| ITC available | `expenses` where `itc_eligible = true` |
| Tax owed | `tax-engine.ts` running computation |

---

## 8. Phase Roadmap (execution plan)

> **Each phase is independently shippable.** No phase blocks another except where stated.

### Phase A — Foundation **(this session)**
- This master doc + tax-strategy doc + government-actions playbook.
- DB migration with all compliance tables.
- `lib/compliance/{constants,types,tax-engine}.ts`.
- `synapsis-config.ts` refactor: split server/browser fields.
- CLAUDE.md updated to point at this doc.

### Phase B — Business Tax Profile (admin UI)
- Read/write Synapsis identity (GSTIN, LUT, regime, registration date).
- Visible compliance status badge on every admin page.

### Phase C — Expense Tracking (priority feature)
- Schema (done in Phase A).
- Manual fast-entry form.
- "Paste email body → AI parse" mode using Claude API.
- Gmail auto-fetch architecture doc (implementation in Phase C2).
- Bulk CSV import from bank statement.

### Phase C2 — Gmail Auto-Fetch
- OAuth flow → token storage in Supabase encrypted.
- Daily cron: fetch emails with `expense-receipts` label → parse → store.
- Dedup by message-id.

### Phase D — GST Workspace
- Invoice tax snapshot writer (auto on invoice generation).
- GSTR-1 prep view (read-only export-to-portal-format).
- GSTR-3B calculator (output tax − ITC = net liable).
- LUT status tracker.
- Filing acknowledgement upload.

### Phase E — Tax Estimate Engine
- Running FY liability estimate (44ADA + regime comparison).
- Advance tax planner with countdown to 15 March.
- Deduction tracker with proof upload.
- ITR-4 (Sugam) data export.

### Phase F — Deadline Engine + Reminders
- Cron job (Supabase pg_cron) seeds upcoming tasks.
- Email + WhatsApp reminders T-7, T-3, T-1.
- "Defer" / "Mark filed" actions per task.

### Phase G — Forex Tracker
- One row per international payment.
- FIRC upload.
- Purpose code stamping (P0802 default for IT services).
- Aggregated export view for FEMA peace of mind.

### Phase H — Document Vault
- Supabase Storage bucket `synapsis-compliance`.
- Folder structure: `{fy}/{kind}/{date}_{slug}.{ext}`.
- Auto-indexed table for retrieval.

### Phase I — Compliance Dashboard
- Health score (0-100): completeness of profile, deadlines met, missing receipts, etc.
- Next 3 deadlines widget.
- Active alerts feed.
- Quick actions.

### Phase J — CA Handoff Package
- One-click monthly ZIP: invoices + tax snapshots + expenses + bank recon + GST summary.
- Use case: optional CA review, audit, scale-up moment.

---

## 9. Operating Principles (hard rules)

1. **No silent tax decision.** Every classification logs the rule + reason + version.
2. **Browser never sees full PAN/GSTIN/account.** Server env only.
3. **Append-only audit tables.** `invoice_tax_snapshot`, `tax_filings`, `platform_transactions`.
4. **Auto-deploy after substantive changes** (per `feedback_auto_deploy` memory).
5. **Self-file mode is the default.** CA handoff exists but is opt-in.
6. **Reminders before deadlines, not after.** T-7 / T-3 / T-1 schedule.
7. **No tax logic outside `lib/compliance/`.** Invoice generator must read snapshot, never compute on its own.
8. **Migrations are forward-only.** Never edit a deployed migration; write a new one.
9. **Every form-submission action has a screen-by-screen playbook** in `GOVERNMENT-ACTIONS-PLAYBOOK.md` so the human executor never gets stuck.
10. **The system tells the human exactly what to do, never asks "what should I do".** Defaults are pre-decided. Human overrides only when necessary.

---

## 10. What This System Will Never Do

- Auto-submit any government form. Submission is always a human click after system-prepared data.
- Auto-debit the bank account.
- Charge GST that the business doesn't owe.
- Claim a deduction without proof URL.
- Modify an issued invoice.
- Skip a deadline silently.

---

## 11. Pointer for Future Claude Sessions

If you are a future Claude reading this for the first time:

1. Start here. This is the bible.
2. Then read `TAX-STRATEGY.md` for the *why* of every tax choice.
3. Then read `GOVERNMENT-ACTIONS-PLAYBOOK.md` for every government-portal step.
4. Then read the latest DB migration in `supabase/migrations/`.
5. Then read `lib/compliance/constants.ts` for current rates/rules.

Do not rewrite tax logic from memory. Do not assume rates. Do not invent SAC codes. Everything is encoded; respect the encoding.

---

## 12. Open Questions / Future Decisions

- **Maharashtra Professional Tax.** Solopreneur slab is ~₹2,500/year. Add as auto-task if user wants automation. Currently deferred.
- **Digital signature for invoices.** Not mandatory under 44ADA / current GST rules for B2B sub-₹500Cr. Defer.
- **GSTR-9 annual return.** Optional under ₹2Cr turnover; mandatory above. Auto-add task when sum crosses threshold.
- **Income tax audit (44ADA).** Required only if declaring income < 50% of receipts AND total income > basic exemption. We always declare ≥ 50% → audit not triggered. Re-evaluate if margin assumption changes.
- **Pvt Ltd conversion.** Defer until ₹1Cr+ turnover OR first investor OR liability concern. Proprietorship is cheaper and lighter for current scale.
