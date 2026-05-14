# Synapsis Tax Strategy — FY 2026-27 onward

> **Audience:** This Claude (future sessions), and Dhananjay when he wants to learn the *why*.
> **Status:** Strategy of record. Update by adding a dated revision section at bottom; never delete history.
> **Disclaimer:** This is an informed self-file strategy, not professional tax advice. The strategy is conservative-aggressive (well-trodden legal positions). When a notice arrives or turnover crosses ₹40L, engage a CA for review.

---

## 1. The Four Levers

We minimize tax legally using four levers, stacked. Each is independently valid; together they compound.

| Lever | Mechanism | Estimated saving at ₹20L receipts |
|---|---|---|
| **L1 — Section 44ADA presumptive** | Declare 50% of receipts as income; the other 50% is legally presumed expense | ~₹1.5–2.5L tax saved vs full-receipts route |
| **L2 — LUT export** | Zero-rated international invoices; no IGST collection | Avoids 18% blocked-cashflow refund cycle |
| **L3 — Deduction stack** | 80C + 80CCD(1B) + 80D + 80TTA on top of L1 | ₹35-60k tax saved depending on slab |
| **L4 — GST ITC** | Reclaim GST paid on SaaS, equipment, professional fees | Reduces GSTR-3B net liability monthly |

End result at ₹20L receipts, ₹2.35L deductions claimed, old regime, 44ADA, ITC tracked: **total income tax ≈ ₹35-50k for the year.** Compare against a salary-route equivalent of ₹20L which would attract ₹3.5–4L tax — that is the legal saving Synapsis captures by being a 44ADA proprietorship.

---

## 2. Lever L1 — Section 44ADA Presumptive Taxation

### What it is
A scheme under the Income Tax Act that lets eligible professionals declare a **fixed 50% of gross receipts as taxable income**, with the other 50% legally deemed to be expense — no proof required.

### Why Synapsis qualifies
Section 44AA(1) lists "specified professions" eligible for 44ADA: legal, medical, engineering, architectural, accountancy, technical consultancy, interior decoration, "any other notified profession". **IT services consulting falls under "technical consultancy"** — this is a well-established interpretation in CBDT clarifications and ITAT jurisprudence (e.g., classifications around software consultancy, IT-enabled services).

### Limits and conditions
- Gross receipts in the FY ≤ **₹75 lakh** (when ≥ 95% of receipts are digital — Synapsis is 100% digital via Razorpay/Stripe).
- If receipts cross ₹75L → forced into regular books + audit. System alerts at ₹60L (T-15 lakh).
- Income declared must be ≥ 50% of receipts. Declaring less triggers mandatory books + audit.
- Profession (not "business") — must be the predominant nature of receipts.

### Why this is overwhelmingly better than regular books
| Aspect | Regular books | 44ADA |
|---|---|---|
| Book-keeping | Mandatory under sec 44AA | Exempt |
| Tax audit | Required if turnover > ₹50L (profession) | Not required under ₹75L digital |
| Expense proof burden | Every rupee needs receipt; AO can disallow | Zero; 50% is deemed |
| Audit risk | High — disallowance battles | Low — formulaic |
| CA dependency | Mandatory for audit | Self-file possible |
| ITR form | ITR-3 (long) | ITR-4 (Sugam — short) |

### The income computation under 44ADA

```
gross_receipts (FY)         = ₹X (all client payments received, INR-equivalent)
deemed_taxable_income       = max(0.50 * X, actual_higher_income_if_declared)
chap_VIA_deductions         = 80C + 80CCD(1B) + 80D + 80TTA (etc.)
net_taxable_income          = deemed_taxable_income - chap_VIA_deductions
income_tax                  = slab(net_taxable_income) under chosen regime
+ cess 4%
+ surcharge if applicable (₹50L+ income)
```

### Worked example — ₹20L receipts
```
gross_receipts              = 20,00,000
deemed_taxable_income (50%) = 10,00,000
deductions:
  80C  (PPF/ELSS/LIC etc.)  = 1,50,000
  80CCD(1B) (NPS Tier 1)    =   50,000
  80D  (health insurance)   =   25,000
  80TTA (savings interest)  =   10,000
  --------------------------------
  total deductions          = 2,35,000

net_taxable_income          = 10,00,000 - 2,35,000 = 7,65,000

old regime tax:
  0-2.5L:    nil
  2.5-5L:    5% of 2.5L = 12,500
  5-7.65L:   20% of 2.65L = 53,000
  subtotal:  65,500
  less rebate u/s 87A (if income ≤ 5L): N/A here (income > 5L)
  cess 4%:   2,620
  TOTAL:     ~ 68,120

new regime tax (on 10L, deductions mostly ignored except std-deduct N/A for biz):
  0-3L:      nil
  3-7L:      5% of 4L = 20,000
  7-10L:     10% of 3L = 30,000
  subtotal:  50,000
  rebate u/s 87A (if income ≤ 7L): N/A here
  cess 4%:   2,000
  TOTAL:     ~ 52,000

Recommended: new regime (lower at this income level + this deduction set).
```

### Worked example — ₹40L receipts
```
deemed_income           = 20,00,000
- 2,35,000 deductions   = 17,65,000 (old regime taxable)

old regime tax:
  0-2.5L:    nil
  2.5-5L:    12,500
  5-10L:     1,00,000
  10-17.65L: 30% of 7.65L = 2,29,500
  subtotal:  3,42,000
  cess 4%:   13,680
  TOTAL:     ~ 3,55,680

new regime tax (on 20L, no deductions):
  0-3L:      nil
  3-7L:      20,000
  7-10L:     30,000
  10-12L:    30,000
  12-15L:    45,000
  15-20L:    1,00,000
  subtotal:  2,25,000
  cess 4%:   9,000
  TOTAL:     ~ 2,34,000

Recommended: new regime (still lower; deductions don't outweigh slab benefit at this level).
```

**Insight:** new regime tends to win when receipts are clean and deductions are modest. Old regime wins when deductions exceed ~₹3.5L (e.g., home loan + 80C + 80D maxed). System will recommend per-FY based on actuals.

---

## 3. Lever L2 — LUT for Export of Services

### What
**Letter of Undertaking** filed annually on the GST portal. Allows export of services (international clients) without charging IGST at invoice time.

### Why it matters
Without LUT, every international invoice must include 18% IGST. Client pays it; you remit it to government; later you file a refund claim. Money stuck for months. With LUT: zero-rated invoice from day one. Clean cashflow.

### Eligibility for export-of-services treatment (must all be true)
1. Supplier (Synapsis) is in India.
2. Recipient is outside India.
3. Place of supply is outside India.
4. Payment received in convertible foreign exchange (USD via Stripe qualifies).
5. Supplier and recipient are not merely establishments of one entity.

All five hold for Synapsis's international clients. The system stamps every international payment with a "qualifying export" flag (verified against FIRC for the foreign-exchange condition).

### When to file
Within first 5–10 days of getting GSTIN (do not wait). And renew every **1 April** for the new FY.

### Action
See `GOVERNMENT-ACTIONS-PLAYBOOK.md#lut-filing` for exact portal steps.

---

## 4. Lever L3 — The Deduction Stack

These are Chapter VI-A deductions of the Income Tax Act. Apply only under **old regime** (new regime ignores most of these except 80CCD(2) employer-NPS which doesn't apply to a proprietor).

### 4.1 80C — ₹1.5L
- **PPF** — public provident fund, 7.1% interest, 15-yr lock-in, EEE (exempt-exempt-exempt). The default safe park.
- **ELSS** — equity-linked savings scheme, mutual funds, 3-yr lock-in, market-linked.
- **Life insurance premium** — but term-insurance only (pure protection).
- **NSC** — National Savings Certificate.
- **Tuition fees** for kids (not applicable yet).
- **Principal repayment** on home loan (not applicable yet).

Recommended split for a 20-year-old solopreneur: ₹50k PPF (forced savings) + ₹1L ELSS (equity exposure).

### 4.2 80CCD(1B) — ₹50k (NPS Tier 1)
Extra ₹50k deduction *over and above* 80C, for contributions to **NPS Tier 1**. Two sub-funds: equity (E) + corporate debt (C) + government (G). For age 20, default allocation 75% E / 15% C / 10% G is fine.
Open via eNPS portal (NSDL): https://enps.nsdl.com/

### 4.3 80D — ₹25k (Health Insurance)
Premium for self+spouse+kids health insurance. ₹25k under 60yr age. **Plus** ₹50k more for parents above 60. Premium itself runs ~₹10–15k for a 20-year-old → still gets full ₹25k deduction headroom but only what you actually paid.
Recommended: Star Health Comprehensive / HDFC ERGO Optima Secure / Niva Bupa Aspire.

### 4.4 80TTA — ₹10k (Savings Interest)
Interest from savings bank account is exempt up to ₹10k/year. No filing action — just exclude this portion when computing "other income".

### 4.5 Other potential (skip unless applicable)
- 80E — education loan interest (unlimited, 8 years)
- 80G — donations (50% / 100% based on org)
- 24(b) — home loan interest up to ₹2L (only if owning a house)
- 80EE/EEA — first-time home buyer extra

### Deduction stack target (FY 2026-27)
| Item | Target | Action timing |
|---|---|---|
| 80C — PPF | ₹50,000 | Open PPF, start SIP |
| 80C — ELSS | ₹1,00,000 | Monthly SIP via Groww/Kuvera |
| 80CCD(1B) — NPS Tier 1 | ₹50,000 | Open NPS account, contribute by 31 Mar |
| 80D — health insurance | ₹10–15k actual (claim full premium) | Within 3-4 months (per user) |
| 80TTA — savings interest | Up to ₹10,000 | Automatic |
| **Stack** | **~₹2.10–2.35L** | |

System will surface a "deductions tracker" widget showing actual vs target with proof URL slots.

---

## 5. Lever L4 — GST Input Tax Credit (ITC)

### What
Every GST you pay on business inputs is creditable against the GST you charge clients. Net liable in GSTR-3B = Output GST − ITC.

### Synapsis ITC sources (estimated annual)
| Vendor | Service | Approx GST/year | ITC eligible |
|---|---|---|---|
| Vercel | Hosting | $20/mo → tax in some plans | If billed to Synapsis with GSTIN |
| Supabase | DB | $25/mo | Same |
| Anthropic (Claude API + sub) | AI | Variable | Same |
| OpenAI | AI | Variable | Same |
| GitHub | Repos | $4/mo | Same |
| Figma / Cursor / Replit / others | Tools | Variable | Same |
| Domain registrar | Domain | Annual | Same |
| Razorpay | Payment fees | 2% on INR + 18% GST on that fee | **Always GST'd** |
| Stripe | Payment fees | 4.3% on USD + tax | Vendor outside India — reverse charge nuance |
| Equipment | Laptop/monitor/phone | 18% on purchase | If invoice in Synapsis name |

### Action requirements for ITC to be valid
1. Vendor's invoice must show Synapsis's GSTIN as the recipient. Update every SaaS billing profile after GSTIN arrives.
2. Vendor must have filed their own GSTR-1 reporting the supply to you. System auto-reconciles via GSTR-2B (auto-populated, view-only).
3. Invoice must be in the same FY (carry-over allowed in some cases).

### What the system does
- Every `expenses` row has `itc_eligible` boolean + `gst_amount_paise`.
- GST Workspace shows month-wise ITC available vs claimed.
- GSTR-3B prep view auto-deducts ITC from output liability.

---

## 6. Regime Choice — Old vs New

Recompute **every FY** (and every quarter as a sanity check). System will surface the recommendation; founder decides during ITR filing.

### Quick rule of thumb
- Receipts ≤ ₹15L, modest deductions → **new regime** wins.
- Receipts ₹15-40L, full deduction stack → **toss-up**, compute both.
- Receipts ≥ ₹40L, full deduction stack + home loan → **old regime** wins.

The system always computes both numbers and shows the cheaper one. No guesswork.

---

## 7. Compliance Calendar (annual rhythm)

### Quarterly
- **15 Jun** — Advance tax not applicable under 44ADA (single installment by 15 Mar). System marks as N/A.
- **15 Sep, 15 Dec** — Same, N/A.
- **GSTR-1** (quarterly under QRMP) — 13th of month following quarter end.
- **GSTR-3B** — monthly, 20th of next month, even under QRMP.

### Annual
- **31 Mar** — Tax-saving investments deadline (80C/80D/80CCD(1B)). Advance tax under 44ADA full payment.
- **1 Apr** — LUT renewal for new FY.
- **31 Jul** — ITR-4 filing deadline (44ADA).
- **31 Dec** — GSTR-9 annual return (only if turnover > ₹2Cr; system alerts when crossed).
- **Anytime** — health insurance renewal (annual policy), professional tax (Maharashtra; deferred decision).

---

## 8. Things We Are NOT Doing (and why)

| Option | Why skipped |
|---|---|
| Section 44AD (general business presumptive) | Synapsis is a profession, not business. 44ADA is the right scheme. |
| Composition scheme under GST | Not available for service providers (except some restaurants). Not applicable. |
| Pvt Ltd / LLP conversion | Adds ROC filings, audits, board meetings, ₹15-30k/yr compliance cost. Only worth it past ₹1Cr or first investor. |
| Tax audit | Voluntarily — wasteful expense. 44ADA exempts us under the limits. |
| GST Composition | Same as above. |
| Voluntary deregistration of GST | Once on, makes business unattractive to Indian B2B clients (they can't claim ITC). Stay registered. |
| TDS on payments made | Synapsis pays SaaS vendors abroad — no TDS deduction needed for service imports under threshold. If hiring Indian contractors, TDS u/s 194J at 10% if cumulative > ₹30k/yr to one vendor. System will surface this when applicable. |

---

## 9. The Tax Estimate Math (live FY engine)

The `tax-engine.ts` library exposes:

```typescript
estimateFYTax({
  receipts_inr_paise: bigint,           // running sum from invoices
  declared_higher_income_paise?: bigint, // null = use 50% deemed
  deductions: DeductionStack,
  regime: 'old' | 'new' | 'auto',
}): {
  deemed_income_paise: bigint
  taxable_income_paise: bigint
  tax_old_regime_paise: bigint
  tax_new_regime_paise: bigint
  recommended_regime: 'old' | 'new'
  effective_tax_rate: number
  advance_tax_due_paise: bigint        // payable by 15 Mar
  next_action_date: string             // ISO date
}
```

Dashboard widget calls this hourly. Founder sees a live tax meter ticking up as new invoices land.

---

## 10. Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-13 | Adopt 44ADA presumptive | 50% deemed profit beats book-keeping overhead for IT consulting at ≤ ₹75L |
| 2026-05-13 | Self-file mode | Founder can DIY under 44ADA + ITR-4. Reserve CA for notices/audit/scale |
| 2026-05-13 | Stay on savings account | Defer current account until alert fires (high cashflow / bank scrutiny) |
| 2026-05-13 | QRMP scheme for GST | Turnover well under ₹5Cr; quarterly GSTR-1 = lower admin burden |
| 2026-05-13 | LUT day-1 of GSTIN | Removes export IGST cashflow drag |
| 2026-05-13 | Defer Maharashtra Professional Tax automation | ~₹2.5k/yr; manual handling fine until volume grows |

(Append new rows. Never edit historical rows.)
