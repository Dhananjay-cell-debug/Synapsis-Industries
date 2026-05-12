# Synapsis GST Compliance Automation Handoff

Date: 2026-05-12
Owner: Synapsis Industries
Purpose: prepare Claude to plan a GST compliance automation system inside Synapsis Industries without rushing into unsafe tax/legal implementation.

## Read Order

1. `01_CURRENT_STATE_AUDIT.md`
2. `02_TARGET_ARCHITECTURE.md`
3. `03_PHASED_ROADMAP.md`
4. `04_RISKS_UNKNOWNS.md`
5. `05_INITIAL_PROMPT_FOR_CLAUDE.md`

## Position

Synapsis is becoming a real business. GSTIN planning is now a serious business-operating concern, separate from the Razorpay international payment work.

This handoff does not give legal or tax advice. It defines software planning, data model gaps, workflow needs, and implementation guardrails. A CA/tax professional must validate GST treatment before production tax automation is trusted.

## Non-Negotiables

- Do not implement tax logic from assumptions.
- Do not hard-code GST rates without a CA-validated rule source.
- Do not treat GSTIN registration as company incorporation.
- Do not assume export-of-services zero-rating/LUT is valid for every international client.
- Do not generate final GST invoices unless the business identity, GSTIN, place of supply, tax treatment, and invoice fields are validated.
- Preserve existing payments, invoice numbering, and phase transition logic.
- Build auditability: every tax decision should have data, reason, and timestamp.

## Current Context

Synapsis already has:

- A business config file with GSTIN placeholder.
- Invoice PDF generation.
- Sequential invoice numbers.
- Razorpay/manual/Stripe-aware payment storage.
- INR/USD invoice formatting.
- Some export-service wording in invoice generation.

The system is not yet a GST compliance engine.

## Target Outcome

Build a future Synapsis compliance layer that can:

- Store GST business identity.
- Capture client GST and place-of-supply data.
- Classify domestic vs export invoices.
- Calculate taxable value and GST components when applicable.
- Generate GST-aware invoices.
- Track returns/reconciliation readiness.
- Surface compliance reminders and exceptions to admin.

