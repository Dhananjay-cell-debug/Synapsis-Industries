# Initial Prompt For Claude

Use this as the first GST-compliance message to Claude.

```text
You are helping Synapsis Industries plan a GST compliance automation layer inside the existing app.

This is separate from the Razorpay international payment work.

First read:

1. docs/compliance/gst-handoff/00_README_FOR_CLAUDE.md
2. docs/compliance/gst-handoff/01_CURRENT_STATE_AUDIT.md
3. docs/compliance/gst-handoff/02_TARGET_ARCHITECTURE.md
4. docs/compliance/gst-handoff/03_PHASED_ROADMAP.md
5. docs/compliance/gst-handoff/04_RISKS_UNKNOWNS.md

Start in audit/planning mode only. Do not edit code yet.

Context:

- Synapsis is moving toward becoming a real business.
- The owner is currently working through GST registration.
- The app already has payment capture, invoice generation, business config, and invoice tables.
- The app does not yet have a GST compliance engine.

Your task:

- Verify current GST/invoice/payment readiness in the codebase.
- Identify exact schema gaps.
- Identify exact invoice PDF gaps.
- Identify exact admin data collection gaps.
- Propose the smallest safe implementation sequence.
- Clearly mark which decisions require CA/tax professional confirmation.

Guardrails:

- Do not provide legal/tax advice as fact.
- Do not hard-code GST rates from memory.
- Do not assume export-of-services/LUT eligibility.
- Do not rewrite issued invoices silently.
- Do not expose full PAN or sensitive identity values to the browser.
- Preserve existing payment and invoice numbering behavior.

Return:

- confirmed current state with file references
- required CA-confirmed policy inputs
- proposed data model
- phased implementation plan
- what should not be implemented yet
```

