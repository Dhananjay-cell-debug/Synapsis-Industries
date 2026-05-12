# Risks And Unknowns

## Legal/Tax Risks

- GST rules must be validated by a CA/tax professional.
- GSTIN registration date affects invoice treatment from that date onward.
- Voluntary GST registration creates compliance duties even below threshold.
- Export-of-services treatment depends on facts, not just USD payment.
- LUT status matters for zero-rated export invoicing.
- Incorrect GST invoices can create tax, penalty, and client trust issues.

## Software Risks

- Current invoice PDF has static tax wording in some cases.
- GST fields are not stored immutably in invoice rows.
- Client address/GSTIN/place-of-supply data is incomplete.
- Public config must not leak full PAN or sensitive identifiers.
- Existing invoice numbers should remain stable and sequential.
- Retrofitting old invoices needs a clear policy; do not silently rewrite issued invoices.

## Unknowns To Resolve

- Final legal structure of Synapsis.
- GSTIN application status and effective date.
- Business state of registration.
- Whether LUT will be filed.
- Correct SAC/service classification.
- GST treatment for each service package.
- Whether invoices need digital signature.
- Whether international clients need additional export documentation.
- Who owns monthly/quarterly return filing: owner, CA, or later automation.

## Recommended Rule

Build the system to collect, classify, and export. Do not auto-file or auto-decide complex GST treatment until the business has a stable CA-approved policy.

