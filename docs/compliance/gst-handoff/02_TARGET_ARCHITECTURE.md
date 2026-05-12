# Target Architecture

## Mental Model

GST automation should be a compliance layer over payments and invoices.

```text
Deal
  -> Client tax profile
  -> Payment capture
  -> Tax classification
  -> GST-aware invoice
  -> Reconciliation record
  -> Return-period readiness
  -> Admin compliance dashboard
```

## Core Entities

### Business Tax Profile

Represents Synapsis itself.

Fields to plan:

- legal name
- trade name
- constitution type
- PAN reference
- GSTIN
- GST state code
- principal place of business
- registration effective date
- filing frequency
- LUT status
- LUT ARN/reference
- default SAC/service code
- default GST rate policy

Do not store full PAN in client-shipped config.

### Client Tax Profile

Represents the buyer.

Fields to plan:

- client legal name
- client trade name
- client GSTIN if Indian B2B
- billing address
- state
- country
- place of supply
- recipient type: Indian registered, Indian unregistered, international business, international individual
- tax residency/country

### Invoice Tax Snapshot

Every issued invoice should store immutable tax decisions.

Fields to plan:

- invoice currency
- taxable value
- GST rate
- CGST amount
- SGST amount
- IGST amount
- zero-rated flag
- exempt/non-GST flag
- reverse-charge flag if applicable
- place of supply
- SAC/service code
- tax treatment reason
- CA rule version or policy version
- return period

### Compliance Tasks

Admin-facing reminders and exceptions.

Examples:

- GSTIN missing but GST invoice requested.
- Client GSTIN missing for Indian B2B invoice.
- International invoice marked export but LUT not configured.
- Invoice missing place of supply.
- Monthly/quarterly return period needs review.
- Payment captured but invoice tax snapshot missing.

## Domestic Invoice Logic

Must be CA-validated before implementation.

Likely categories:

- Maharashtra client and Synapsis registered in Maharashtra: CGST + SGST.
- Other Indian state client: IGST.
- Indian unregistered client: still needs place-of-supply treatment.

## International Invoice Logic

Must be CA-validated before implementation.

Likely categories:

- Export of services with LUT: zero-rated invoice without charging IGST.
- Export of services without LUT: tax/payment/refund treatment depends on CA guidance.
- Non-qualifying international supply: do not auto-classify.

## Integration Points

Existing code to extend later:

- `lib/synapsis-config.ts`
- `lib/invoice/generate.ts`
- `lib/payments/db.ts`
- `app/api/deals/route.ts`
- admin deal/payment screens
- Supabase migrations for invoices/client profiles/compliance tasks

## Guardrail

The software should support compliance decisions. It should not pretend to be the CA.

