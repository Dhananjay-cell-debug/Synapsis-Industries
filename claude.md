# VARK PORTFOLIO - Synapsis Industries

## CORE INSTRUCTIONS

1. **Never disturb Dhananjay** — I will do everything myself
2. **If impossible happens** — I will solve it myself
3. **Never disturb Dhananjay in life** — I follow instructions directly
4. **Always give clickable links** — Use markdown format

## WORKFLOW

- Check files first before doing anything
- Build/compile to verify errors
- Fix issues without asking unless critical
- Give progress updates concisely

## PROJECT

- Next.js 14 on port 3001
- Synapsis Industries portfolio
- Blue/white color system
- 3D hero scene with React Three Fiber

## COMPLIANCE OS (load before any tax/GST/invoice work)

Read **in this exact order**, then do not improvise:

1. [`docs/compliance/COMPLIANCE-OS-MASTER.md`](docs/compliance/COMPLIANCE-OS-MASTER.md) — architecture bible, module map, data model.
2. [`docs/compliance/TAX-STRATEGY.md`](docs/compliance/TAX-STRATEGY.md) — Section 44ADA, deduction stack, regime choice, decision log.
3. [`docs/compliance/GOVERNMENT-ACTIONS-PLAYBOOK.md`](docs/compliance/GOVERNMENT-ACTIONS-PLAYBOOK.md) — click-by-click portal guides.
4. Latest migration `supabase/migrations/2026*_compliance_os.sql` — current DB schema.
5. [`lib/compliance/constants.ts`](lib/compliance/constants.ts) — rates/slabs/SAC; bump `RULE_VERSION` if you change anything.
6. [`lib/compliance/tax-engine.ts`](lib/compliance/tax-engine.ts) — pure-function tax brain (no DB).

**Hard rules:**
- Tax logic only inside `lib/compliance/`. Never recompute in invoice generator.
- Source of truth for tax identity is `synapsis.business_tax_profile` (DB row), not `synapsis-config.ts`.
- Append-only tables: `invoice_tax_snapshot`, `tax_filings`, `platform_transactions`. Triggers block edits.
- Self-file mode; no engaged CA. System guides the founder through every government action.
- Auto-deploy after substantive changes (see memory `feedback_auto_deploy`).