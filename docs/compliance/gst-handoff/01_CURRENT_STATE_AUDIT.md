# Current State Audit

Based on local repo inspection on 2026-05-12.

## Existing GST/Invoice Seeds

### Business Config

File: `lib/synapsis-config.ts`

Current fields:

- `legalName`
- `brandName`
- `proprietorshipLine`
- `udyamRegistration`
- `panLast4`
- `gstinStatus`
- `gstin`
- bank/contact/address fields
- invoice prefix/footer/payment terms

Current limitation:

- GSTIN is a placeholder.
- PAN is only last-4 in public config, which is good for browser safety.
- Business constitution is represented as text, not a structured compliance object.
- No GST registration date, state code, legal entity type, LUT status, or GST filing profile.

### Invoice Generator

File: `lib/invoice/generate.ts`

Current behavior:

- Generates branded PDF invoice.
- Shows PAN last-4, Udyam, GSTIN line for INR invoices.
- Shows export-of-services wording for USD invoices.
- Uses INR/USD amount formatting.
- Stores invoice row through payment infrastructure.

Current limitation:

- No CGST/SGST/IGST breakdown.
- No SAC/service code field.
- No GST rate field.
- No taxable value vs tax amount separation.
- No recipient GSTIN/address/place of supply.
- Export wording is currently static for USD, but tax validity depends on actual GST/export rules and CA confirmation.

### Database

Files:

- `supabase/migrations/20260503110452_synapsis_payment_infrastructure.sql`
- `supabase/migrations/20260504000000_add_stripe_dual_provider_support.sql`

Current invoice table has:

- `invoice_number`
- `deal_token`
- `payment_id`
- `phase`
- `amount_paise`
- `tds_received_paise`
- `issued_to_name`
- `issued_to_company`
- `issued_to_email`
- `issued_at`
- `metadata`
- later migration adds `currency`

Current limitation:

- No GST fields in schema.
- No client GST profile.
- No place-of-supply tracking.
- No invoice tax line items.
- No return-period/reconciliation status.

### Payments

Current payment system already tracks:

- provider
- currency
- amount minor
- payment ids
- platform transactions

Current limitation:

- Payment capture does not classify GST treatment.
- Settlement/reconciliation and tax treatment are not connected.

## Important Existing Risk

Invoice code currently has wording like export-of-services/LUT for USD invoices. That must be treated as provisional until CA confirms:

- whether Synapsis has GSTIN
- whether LUT is filed
- whether the service qualifies as export of services
- whether the client location and payment conditions qualify
- whether invoice format meets GST rules

## Summary

The repo has a useful invoice/payment foundation, but GST automation should be planned as a dedicated compliance layer, not a quick text change in the invoice PDF.

