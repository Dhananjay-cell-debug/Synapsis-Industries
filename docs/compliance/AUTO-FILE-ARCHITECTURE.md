# Direct Portal Auto-Submit — Architecture & Honest Tradeoffs

> **Question:** Can Synapsis directly submit GST returns to gst.gov.in on the founder's behalf, with zero human clicks?
> **Short answer:** **Not legitimately at our current scale without paying a licensed gateway.** Below: four paths, what each costs, what each breaks, and the staged recommendation.
> **Last revision:** 2026-05-15 (day after GSTIN activated).

---

## 1. Why "full auto-submit" is hard

Three blockers that apply to any custom-built submission flow:

1. **OTP at submit time** — the GST portal mandates an SMS OTP to the registered mobile (or EVC via Aadhaar OTP / DSC) for every return file action. This is a regulatory feature, not a UI quirk. No tool can submit without that human-controlled OTP.
2. **Captcha at login** — the portal has reCAPTCHA which kills naive scrapers/automation.
3. **Terms of Service** — the GST portal ToS prohibits automated / scripted access outside of officially licensed channels (GSPs).

You cannot remove these from the outside. The only legitimate path that bypasses (1) and (2) and (3) is the **GSP API**, which is licensed by GSTN itself.

---

## 2. Four paths, ranked

### Path A — Browser automation (Playwright/Puppeteer on gst.gov.in with stored credentials)

What it sounds like: spin up a headless browser, log in with username/password, click through the return, submit.

**Why it does not work for production filing:**

| Blocker | Reality |
|---|---|
| Captcha | Breaks login. Solvable services exist but unreliable + against ToS. |
| OTP | The submit step still requires the mobile OTP. Founder must hand it over manually anyway → no real automation. |
| ToS | Account suspension risk. The portal can detect headless browsers and flag the GSTIN. |
| Portal HTML changes | Selectors break monthly. High maintenance cost. |
| DSC requirement | Some flows require a hardware DSC; cannot be automated. |
| Audit trail | If something goes wrong (wrong amount filed), there's no clean reversal — your GSTIN, your liability. |

**Verdict:** **Do not build.** The blast radius of a flagged GSTIN dwarfs the savings of ~20 min/month of clicks.

### Path B — Direct GSP API integration

GSTN runs an official API ecosystem (the "GSP–ASP architecture"). Licensed GSPs (GST Suvidha Providers) hold the API keys. You either:

- **B1.** Partner with a GSP directly (becoming an ASP — Application Service Provider) — non-trivial onboarding, KYC, technical compliance, ~₹2-5L setup + annual fees. Real engineering project.
- **B2.** Sign up with a ready ASP that exposes its GSP-backed API to small users (ClearTax Cleartax-API, Cygnet GSP, IRIS GST, Tally Cloud, etc.). Costs ₹5-30k/year typical entry plans.

**What this unlocks:** programmatic `POST` of GSTR-1 + GSTR-3B JSON to the API. Submission still needs an OTP/EVC token the founder generates once per session — but you skip the captcha, the brittle browser scraping, the ToS risk.

**Verdict:** **The right answer when volume justifies.** For Synapsis right now (~₹0-20L FY): overkill. Re-evaluate when (a) monthly returns become genuinely painful, (b) turnover crosses ₹40L, or (c) you take on clients whose volume justifies the GSP cost.

### Path C — Ready-to-paste / offline-utility JSON (build this next) ⭐

The GST portal has an official **offline utility** that accepts pre-formatted JSON for GSTR-1, etc. Anyone can prepare that JSON outside the portal, then import + submit.

**The shape:**

```
Synapsis Compliance OS
   └─ generates GSTR-1.json (per quarter)
      └─ founder downloads
         └─ opens GST offline tool, imports JSON
            └─ generates upload file
               └─ uploads on gst.gov.in
                  └─ submits with OTP
```

**What this saves:** the ~30 min of manual invoice-by-invoice typing per quarter shrinks to ~5 min of click-import-upload-submit.

**What we'd build inside Synapsis Compliance OS:**

- `GET /api/compliance/gstr/[period]/json` → returns the GSTN-spec JSON for that period, computed from `invoice_tax_snapshot`.
- A "Download GSTR-1 JSON" button in the GST Workspace view.
- A small in-app guide ("How to upload this JSON on the portal" — links from the calendar task).
- For **GSTR-3B**: the portal accepts manual numeric entry, not JSON. We'd render a "summary card" view with the exact numbers per section, copy-friendly.

**Verdict:** **Build this in the next phase.** Pure win, zero cost, fully legal, materially reduces effort.

### Path D — Hand-off via existing tax-tech platform

Sign up for ClearTax or Zoho Books or similar. Use them as the actual filer. Synapsis stays the **source of truth** for data; the platform becomes the **delivery channel** for filing.

**The shape:**

```
Synapsis (data) → export bundle → ClearTax (files via their GSP)
```

**Pros:** zero engineering, immediate, legit. **Cons:** subscription fee, your data lives in two systems.

**Verdict:** **A reasonable shortcut** for ~₹500–2000/month if Path C effort still feels too high. Compatible with our system — we just generate the bundle they consume.

---

## 3. Recommendation, by scale

| Scale (FY turnover) | Recommended path | Effort / cost |
|---|---|---|
| **₹0–20L** (now) | **Path C** — ready-to-paste JSON in Compliance OS | Engineering: ~1-2 days. Cost: ₹0. Founder time: ~5 min/return. |
| ₹20–40L | Path C + optional Path D (ClearTax for ITR) | ~₹500-1500/mo |
| ₹40L–₹2Cr | Path B2 (ASP API like ClearTax-API) | ~₹10-30k/yr, API integration ~3-5 days |
| > ₹2Cr | Path B1 (direct GSP partnership) or full ASP stack | Real engineering project |

---

## 4. Why we are not building Path A even though we have his credentials

The credentials Dhananjay shared (`synapsis_ind` / portal password) **must never be**:

- committed to git
- placed in any browser bundle
- stored in any non-encrypted store
- used by a headless browser script

The **correct home** for portal credentials, if a future server-side integration needs them, is:
- Vercel environment variables (`GST_PORTAL_USER`, `GST_PORTAL_PASSWORD`) — encrypted at rest, server-only
- Or a managed secrets vault (Vercel Secrets, AWS Secrets Manager)

**Action item for Dhananjay:** rotate the portal password ASAP because it has been shared in chat. Use a strong password manager.

---

## 5. The "auto" Synapsis Compliance OS already provides

Even without auto-submission, the system removes 95% of the mental load:

- **Auto-classification** — every invoice gets stamped with the right tax treatment (intra/inter/export) immutably.
- **Auto-aggregation** — by the time a return is due, the system has summed all the inputs, computed the exact tax owed, and reconciled ITC.
- **Auto-reminders** — T-7 / T-3 / T-1 email + dashboard alerts.
- **Auto-records** — every action, filing, payment audited.

The founder's contribution shrinks to: **read the prepared numbers → log in to portal → paste/upload → OTP → done.** ~5-20 min per return.

---

## 6. Build order (when we get back to this)

1. **Phase 1 — GSTR-1 JSON export** (Path C, ~½ day)
   - New endpoint `/api/compliance/gstr/[period]/gstr-1.json` returning the GSTN-spec JSON.
   - "Download GSTR-1 JSON" CTA in GST Workspace.
   - Step-by-step "upload this on the portal" mini-flow in the guided tour.

2. **Phase 2 — GSTR-3B summary card** (Path C, ~½ day)
   - A copy-friendly summary screen showing the exact numbers per portal section.
   - "Mark filed" with the portal ARN linking the filing into `tax_filings`.

3. **Phase 3 — Re-evaluate Path D / B2** (when turnover ≥ ₹40L OR monthly returns feel painful)
   - Pick a vendor (ClearTax-API typically cleanest), wire a one-direction sync.
   - Compliance OS remains the source of truth; vendor is the delivery surface.

---

## 7. Open questions / future research

- **e-Invoicing** — currently mandatory only for turnover > ₹5Cr. Not relevant now; flag if scale crosses.
- **DSC for ITR** — not mandatory under 44ADA self-filing; Aadhaar EVC works. Re-check if Pvt Ltd later.
- **API access cost trend** — GSTN periodically reduces GSP entry barriers. Re-survey annually.

---

## 8. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-15 | Reject Path A (browser automation) | ToS risk + OTP/captcha block + GSTIN suspension risk > 20-min monthly saving |
| 2026-05-15 | Defer Path B / D | Scale (₹0-20L) does not justify subscription/integration cost yet |
| 2026-05-15 | Adopt Path C as next build | Free, legal, materially reduces effort, fits existing Compliance OS architecture |
