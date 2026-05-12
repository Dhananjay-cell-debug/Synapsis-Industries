# Phased Roadmap

## Phase 0 - CA Rule Confirmation

Goal: collect validated rules before coding tax logic.

Tasks:

- Confirm legal structure: proprietorship, LLP, private limited, etc.
- Confirm GSTIN registration status and effective date.
- Confirm whether Synapsis services are classified under a specific SAC.
- Confirm domestic tax treatment.
- Confirm export-of-services treatment.
- Confirm LUT requirement and process.
- Confirm invoice format requirements.
- Confirm return filing frequency and data needed.

Acceptance:

- A written CA-validated policy exists before automated GST calculations ship.

## Phase 1 - Business Tax Profile

Goal: replace loose GST placeholders with structured business tax config.

Tasks:

- Add server-safe business tax profile.
- Keep public-safe fields separate from private fields.
- Add GSTIN, registration state, effective date, LUT status.
- Add admin visibility for current compliance status.

Acceptance:

- App can show whether Synapsis is GST-registered and what tax mode is active.
- Full sensitive identifiers are not shipped to the browser.

## Phase 2 - Client Tax Profile

Goal: collect tax data needed for valid invoices.

Tasks:

- Add client billing profile fields.
- Capture Indian client GSTIN where applicable.
- Capture billing state/country/place of supply.
- Add validation warnings before invoice generation.

Acceptance:

- Indian B2B invoice cannot be finalized without required GST fields.
- International invoice cannot be classified as export without required client/location data.

## Phase 3 - GST-Aware Invoice Snapshot

Goal: make each invoice immutable and tax-auditable.

Tasks:

- Add invoice tax fields to DB.
- Store taxable value and GST components separately.
- Store SAC, GST rate, place of supply, and tax treatment reason.
- Keep original payment amount intact.

Acceptance:

- Every issued invoice has a tax snapshot that can be audited later.

## Phase 4 - Invoice PDF Upgrade

Goal: generate GST-compliant invoice output after data model is ready.

Tasks:

- Update invoice PDF layout for GSTIN, recipient GSTIN, place of supply, SAC, tax breakup.
- Support domestic CGST/SGST/IGST display.
- Support export/zero-rated invoice wording only when validated by policy.

Acceptance:

- Invoice PDF matches the stored tax snapshot.
- No PDF-only tax logic exists.

## Phase 5 - Compliance Dashboard

Goal: give Synapsis an operating console for GST hygiene.

Tasks:

- Add admin compliance screen.
- Show missing tax data, invoice issues, return-period readiness, and reconciliation gaps.
- Add manual override notes with audit trail.

Acceptance:

- Admin can see what is blocking clean GST reporting.

## Phase 6 - Filing Export Prep

Goal: prepare data for CA/accounting workflows.

Tasks:

- Export monthly/quarterly invoice summary.
- Export payment vs invoice reconciliation.
- Export domestic/export invoice classification.
- Do not submit GST returns automatically unless explicitly approved later.

Acceptance:

- CA can use Synapsis-exported data for GST return work.

