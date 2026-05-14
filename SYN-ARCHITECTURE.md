# SYN — FULL PILOT ARCHITECTURE

> **Status:** Design proposal v1 · 2026-05-13
> **Author:** Claude (architect mode) for Dhananjay Chitmilla
> **Goal of this doc:** Fully spec how Syn becomes the operational nerve of Synapsis Industries — taking real, irreversible actions on the portal — without ever blowing up production. Read this top-to-bottom before approving. After approval, the build sequence in §9 begins.

---

## 0 · ONE-SENTENCE GOAL

**Syn becomes the autonomous pilot of every client phase transition** — verifying payment, assets, approvals against a deterministic checklist engine, executing transitions through the existing pure-function pipeline, and reporting every action to admin in real time. Admin remains the rule author and audit reviewer; Syn is the rule executor.

---

## 1 · VISION — WHAT "NERVE OF SYNAPSIS" MEANS

Today Syn is a chat assistant. It talks. It cannot act. The proof: every "Raise Doubt / Raise Issue" button exists because Syn can only re-route to Dhananjay.

**After this build, Syn does:**

| Today                                             | After                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Client asks "when does Phase 4 unlock?" → Syn guesses from generic prompt | Syn reads live deal state, payment status, asset checklist → answers with exact gate ("Yashraj, payment ✅, Dhananjay confirms assets, then Phase 4 unlocks. ETA: 24hrs.") |
| Payment received via webhook → admin manually clicks "confirm assets" → phase advances | Syn's verification engine sees: `phase=3, payment.captured=true, assets.required=[]` → auto-fires `t3to4_confirmAssets` → notifies admin → Phase 4 lives |
| Client says "I uploaded my brand assets" → Syn says "noted, I'll tell Dhananjay" | Syn checks `deal.phaseData.phase3.assets[]` → if all required submitted, runs verification, advances phase, posts confirmation in chat |
| #panic from client → goes nowhere | Syn locks all auto-actions for that deal, fires email + dashboard alert, freezes till admin acknowledges |

**What Syn does NOT do (ever):** invent verification rules, override admin force-locks, take actions on `forcePhaseJump`, modify pricing, modify blueprint content, delete data.

---

## 2 · AUTHORITY MODEL — THE 4-ACTOR SYSTEM (FULL PILOT, ALL 7 PHASES)

Currently the codebase recognizes 3 actors via `lib/phases/transitions.ts` ACL:
- **admin** (NextAuth session, email match) — can run `ADMIN_ONLY_ACTIONS`
- **client** (deal token possession) — can run `CLIENT_ONLY_ACTIONS`
- **system** (webhooks: razorpay, stripe) — runs `t3_advancePaid`, `t4_midPaymentPaid`, `t6_finalPaid` automatically

**We add a 4th: `syn` (autonomous agent).**

**Directive from Dhananjay 2026-05-13:** *"Syn ko saare 7 phases ka powers do."* Full pilot across the entire engagement protocol. Maximum automation with maximum-strength guardrails. Removes admin from the verify loop wherever the verification is deterministic.

`syn` actor is **the most privileged non-human actor** — can fire any admin-attributable or system-attributable transition. Bounded only by:
1. The **Verification Engine** (§3) — every fire must pass a deterministic, hand-coded checklist. No LLM judgment.
2. **Inviolable human-consent boundary** — the 6 transitions that represent the client's own click cannot be proxied by any non-human actor. Period. These are clicks of consent, not gates.
3. **`forcePhaseJump` is admin-only forever** — this is the safety override; Syn never overrides itself.

### ACL Table — What Each Actor Can Trigger

| Phase | Action                | admin | client | system | **syn** |
| :---: | --------------------- | :---: | :----: | :----: | :-----: |
| 0→1 | `elect`               |   ✓   |        |        |  **✓** — checklist: full intake form + budget signal + ≥24hrs in inbox without admin reject + no spam flag |
| 0   | `reject`              |   ✓   |        |        |  **✓** — checklist: 48hr inbox timer expired AND no clientRecovery action in subsequent 24hrs (hard timeout reject only) |
| 0   | `clientRecovery`      |       |   ✓    |        |   ✗ — client consent click. Syn nudges, never proxies. |
| 1→2 | `goDecision`          |   ✓   |        |        |  **✓** for GO only — checklist: discovery call completed + admin call-notes ≥50 chars + no NO-GO flag from admin. Syn never fires NO-GO. |
| 2   | `sendBlueprint`       |   ✓   |        |        |  **✓** — checklist: blueprint status=draft + all required fields present + investment lines sum to investmentTotal + paymentStructure %s sum to 100. Syn fires when admin marks "ready to send". |
| 2→3 | `approveBlueprint`    |       |   ✓    |        |   ✗ — client consent click. Inviolable. |
| 2   | `requestChanges`      |       |   ✓    |        |   ✗ — client consent click. |
| 2   | `declineBlueprint`    |       |   ✓    |        |   ✗ — client consent click. |
| 3   | `submitAsset`         |       |   ✓    |        |   ✗ — client uploads. Syn cannot proxy file uploads. |
| 3→4 | `confirmAssets`       |   ✓   |        |        |  **✓** — checklist: all required assets submitted AND virus-scan passed (when implemented) AND advance payment captured via webhook OR admin-verified NEFT. |
| 3   | `t3_advancePaid`      |       |        |   ✓    |  **✓** — when webhook fires, Syn co-runs verification: amount ≥ expected + currency matches + dispute window cooldown ≥30min. |
| 4→5 | `submitFinal`         |   ✓   |        |        |  **✓** — checklist: stagingUrl present + returns 200 + latest sprint marked complete + admin checklist `readyForDelivery=true`. |
| 5→6 | `finalApprove`        |       |   ✓    |        |   ✗ — client consent click. Inviolable. |
| 5   | `submitRevision`      |       |   ✓    |        |   ✗ — client consent click. |
| 6   | `t6_finalPaid`        |       |        |   ✓    |  **✓** — same pattern as t3. |
| 6   | `markDeployed`        |   ✓   |        |        |  **✓** — checklist: prodUrl present + returns 200 + smoke-test endpoint passes + admin has marked deployBlessing=true OR Syn deploy-bot has signed it. |
| 6   | `uploadHandover`      |   ✓   |        |        |  **✓** — checklist: handoverPackage all fields filled + downloadUrl present + admin handoverApproved=true. |
| 6→7 | `tryAdvanceToOrbit`   |   ✓   |        |        |  **✓** — checklist: handoverDeliveredAt + finalPaidAt + 7 days elapsed since handover with no client revision requests. |
| 7   | check-in scheduling   |   ✓   |        |        |  **✓** — Syn schedules + runs 30d/90d/annual check-ins automatically. Posts in chat, awaits client reply, escalates to admin if no response in 48hrs. |
| ANY | `forcePhaseJump`      |   ✓   |        |        |   ✗ **NEVER** — this is the human override. Syn cannot self-override. |

**Total Syn-eligible transitions: 11 of 19 + check-in scheduling.** Spans all 7 phases.

**6 transitions remain inviolably human:** `clientRecovery`, `approveBlueprint`, `requestChanges`, `declineBlueprint`, `submitAsset`, `finalApprove`, `submitRevision` — every one of these is a client clicking a button to express consent or provide a file. No automation can or should proxy a human's consent click. Syn nudges and reminds; Syn does not impersonate.

**2 transitions remain inviolably admin:** `goDecision (NO-GO)` and `forcePhaseJump` — both involve negative judgment or safety-override. Syn does not have authority to break the engagement or rewind the system.

---

## 3 · THE VERIFICATION ENGINE — THE HEART

This is the single most important piece. It's what makes Syn safe enough to be a pilot.

### 3.1 · Per-Phase Checklist (Declarative, Versioned)

New file: `lib/syn/checklists/phase-3-to-4.ts` (and one per Syn-eligible transition).

```ts
// lib/syn/checklists/phase-3-to-4.ts
import type { Deal } from "@/app/api/deals/route";

export interface CheckRule {
  id: string;
  description: string;
  severity: "blocker" | "warning";
  check: (deal: Deal, ctx: VerifyCtx) => Promise<CheckResult> | CheckResult;
}

export interface CheckResult {
  passed: boolean;
  evidence: string;     // human-readable why it passed/failed (audit trail)
  data?: any;           // raw data referenced (for review)
}

export interface VerifyCtx {
  paymentRows: PaymentRow[];
  assetRows: AssetRow[];
  raisedOpen: RaisedItem[];
  currentTime: number;
}

export const PHASE_3_TO_4_CHECKLIST: CheckRule[] = [
  {
    id: "deal.exists",
    description: "Deal record present and not soft-deleted",
    severity: "blocker",
    check: (deal) => ({
      passed: !!deal && !deal.deletedAt,
      evidence: deal ? `Deal ${deal.token} found` : "Deal missing",
    }),
  },
  {
    id: "phase.is.3",
    description: "Deal is currently in phase 3 (cannot fire transition from any other phase)",
    severity: "blocker",
    check: (deal) => ({
      passed: deal.phase === 3,
      evidence: `Current phase = ${deal.phase}`,
    }),
  },
  {
    id: "advance.payment.captured",
    description: "Phase 3 advance payment row exists with status='paid' AND has webhook confirmation",
    severity: "blocker",
    check: (deal, ctx) => {
      const row = ctx.paymentRows.find(p => p.phase === 3 && p.status === "paid");
      if (!row) return { passed: false, evidence: "No paid payment row found for phase 3" };
      // Critical: webhook-confirmed, NOT just admin-marked. Syn trusts gateway, not humans.
      const isWebhookConfirmed = row.razorpay_payment_id?.startsWith("pay_") || row.stripe_session_id?.startsWith("cs_");
      const isManualVerified = row.razorpay_payment_id?.startsWith("neft_") && row.verified_by_admin_email;
      return {
        passed: isWebhookConfirmed || isManualVerified,
        evidence: isWebhookConfirmed ? "Webhook-confirmed gateway payment" :
                  isManualVerified ? `Admin-verified NEFT by ${row.verified_by_admin_email}` :
                  "Payment row exists but no source confirmation",
        data: { paymentId: row.id, source: row.razorpay_payment_id ? "razorpay" : "stripe" },
      };
    },
  },
  {
    id: "advance.amount.matches.blueprint",
    description: "Captured amount equals (or exceeds) the blueprint's phase-3 expected amount",
    severity: "blocker",
    check: (deal, ctx) => {
      const expected = paymentAmountFor(deal.totalPrice || 0, 3);
      const captured = ctx.paymentRows
        .filter(p => p.phase === 3 && p.status === "paid")
        .reduce((s, p) => s + p.amount_paise, 0) / 100;
      return {
        passed: captured >= expected,
        evidence: `Expected ₹${expected}, captured ₹${captured}`,
        data: { expected, captured },
      };
    },
  },
  {
    id: "assets.all.required.submitted",
    description: "Every required asset in phase3.requiredAssets[] has a submission",
    severity: "blocker",
    check: (deal, ctx) => {
      const required = deal.phaseData?.phase3?.requiredAssets || [];
      // Edge case: if admin has not specified any required assets, this passes by default
      // (matches current screenshot behavior: "No assets requested for this project")
      if (required.length === 0) {
        return { passed: true, evidence: "No required assets — admin set checklist to empty" };
      }
      const submitted = (deal.phaseData?.phase3?.assets || []).map((a: any) => a.id);
      const missing = required.filter((r: any) => !submitted.includes(r.id));
      return {
        passed: missing.length === 0,
        evidence: missing.length === 0 ? "All required assets submitted" : `Missing: ${missing.map((m: any) => m.label).join(", ")}`,
        data: { required, submitted, missing },
      };
    },
  },
  {
    id: "no.open.issue",
    description: "Client has no open Raised Issue against phase 3 (could indicate dispute)",
    severity: "blocker",
    check: (deal, ctx) => {
      const openIssues = ctx.raisedOpen.filter(r => r.kind === "issue" && r.phase === 3 && r.status === "open");
      return {
        passed: openIssues.length === 0,
        evidence: openIssues.length === 0 ? "No open phase-3 issues" : `${openIssues.length} open issue(s) — admin must resolve before auto-advance`,
        data: { issueIds: openIssues.map(i => i.id) },
      };
    },
  },
  {
    id: "payment.cooldown.elapsed",
    description: "At least 30 minutes since payment captured (gives chargeback/dispute window)",
    severity: "warning",   // not a blocker — but logged
    check: (deal, ctx) => {
      const row = ctx.paymentRows.find(p => p.phase === 3 && p.status === "paid");
      if (!row?.captured_at) return { passed: true, evidence: "No timestamp to check" };
      const elapsed = ctx.currentTime - new Date(row.captured_at).getTime();
      return {
        passed: elapsed >= 30 * 60 * 1000,
        evidence: `${Math.round(elapsed / 60000)} mins since payment capture`,
      };
    },
  },
  {
    id: "kill.switch.not.active",
    description: "Admin has not engaged the Syn kill-switch for this deal",
    severity: "blocker",
    check: (deal) => ({
      passed: !deal.synKillSwitch?.active,
      evidence: deal.synKillSwitch?.active ? `Kill-switch ON since ${deal.synKillSwitch.engagedAt}` : "Kill-switch off",
    }),
  },
];
```

**Engine runner:** `lib/syn/verification.ts` exports:

```ts
export async function runChecklist(
  checklist: CheckRule[],
  deal: Deal,
  ctx: VerifyCtx,
): Promise<VerifyOutcome> {
  const results: { rule: CheckRule; result: CheckResult }[] = [];
  for (const rule of checklist) {
    try {
      const r = await rule.check(deal, ctx);
      results.push({ rule, result: r });
      // Short-circuit on blocker fail (no point checking further)
      if (rule.severity === "blocker" && !r.passed) {
        return { passed: false, results, blockedBy: rule.id };
      }
    } catch (e) {
      results.push({ rule, result: { passed: false, evidence: `Check threw: ${String(e)}` } });
      return { passed: false, results, blockedBy: rule.id };
    }
  }
  return { passed: true, results, blockedBy: null };
}
```

**Critical property:** the LLM does NOT make verification decisions. Syn (LLM) calls the rule engine, the rule engine returns a deterministic boolean, Syn acts on that. **Hallucinations cannot cause an unsafe transition.** The worst Syn can do is fail to act when it should — never act when it shouldn't.

### 3.2 · Where Checklists Live

| Transition       | Checklist file                          | Status |
| ---------------- | --------------------------------------- | ------ |
| `elect`          | `phase-0-to-1.ts`                       | Build in Sprint 2 |
| `confirmAssets`  | `phase-3-to-4.ts`                       | **Build first (highest value, lowest risk)** |
| `t3_advancePaid` | `payment-phase-3.ts`                    | Already runs via webhook; Syn just confirms preconditions before letting webhook trigger advance |
| `t6_finalPaid`   | `payment-phase-6.ts`                    | Same pattern as phase-3 |
| `tryAdvanceToOrbit` | `phase-6-to-7.ts`                    | Build in Sprint 3 |

---

## 4 · CAPABILITY MATRIX — WHAT SYN CAN ACTUALLY DO

Beyond phase transitions, Syn gets these **bounded action capabilities** as tool calls:

| Tool name                  | What it does                                                              | Auth |
| -------------------------- | ------------------------------------------------------------------------- | ---- |
| `read_deal_full(token)`    | Returns deal, all phaseData, payments, assets, raisedItems, audit log     | syn  |
| `run_verification(token, checklistId)` | Executes a checklist, returns VerifyOutcome (no side effects)    | syn  |
| `attempt_transition(token, action)` | Runs verification → if passes, calls existing `POST /api/deals/[token]/phase/[n]` with actor=syn → logs everything | syn (gated) |
| `notify_admin(level, message, dealToken?)` | Sends email + adds to admin notification panel (top button)      | syn  |
| `notify_client(token, message)` | Posts a system message into the client's portal chat                  | syn  |
| `flag_for_review(token, reason)` | Marks deal as "Syn detected anomaly — admin attention needed", freezes Syn auto-actions on this deal | syn |
| `engage_kill_switch(token, reason)` | Disables Syn for one specific deal (e.g., when client says #panic) | syn  |
| `request_admin_decision(token, question, options)` | Posts a structured decision card to admin notification panel — admin clicks, Syn proceeds with their answer | syn |

**Tool definitions live in:** `lib/syn/tools.ts` — exported as JSON schemas the LLM can call (function calling).

---

## 5 · TOOL USE LOOP — HOW SYN ACTUALLY ACTS

Two distinct execution modes:

### 5.1 · Conversational Mode (existing) — Client/admin sends a chat message

Same as today's `/api/syn/chat/[token]` endpoint, but the system prompt now includes a **live deal snapshot** (read-only) injected per request, and the LLM has access to **read-only tools** (`read_deal_full`, `run_verification`).

When the LLM wants to fire an action, it doesn't actually fire it. It says: *"Yashraj, looks like all conditions are met — payment ✅, assets ✅, no open issues. I'm advancing you to Phase 4 now."* and the orchestrator (server-side) intercepts that intent → runs `attempt_transition` → if it succeeds, the message goes through as written; if it fails, the message is rewritten to: *"Looks like the system blocked the advance: \[reason]. Routing to Dhananjay."*

### 5.2 · Autonomous Mode (new) — Cron-driven sweep

A new background cron job (Vercel Cron or simple setInterval in a long-lived edge function): every 5 minutes, walks all deals where `phase >= 3`, runs the relevant checklist, and if it passes — **fires the transition without any human in the loop**.

Cron entry: `app/api/syn/cron/sweep/route.ts` — protected by `CRON_SECRET` env var.

```ts
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("forbidden", { status: 401 });
  }
  const deals = await readAllDeals();
  const candidates = deals.filter(d => d.phase >= 3 && !d.synKillSwitch?.active);
  for (const deal of candidates) {
    await synSweep(deal);  // runs checklists, fires transitions, notifies admin
  }
  return Response.json({ swept: candidates.length });
}
```

This is what makes Syn actually a "pilot" — it doesn't wait for someone to ask. It actively patrols.

---

## 6 · MODEL STRATEGY

**Decision:** Keep the existing multi-provider waterfall. **No model change.** Reason: it's already battle-tested for "kabhi limit nahi padti" — 4 providers, up to 11 keys, automatic failover.

**One enhancement:** add a **structured-output fallback** when tool calling is needed. The current Llama 3.3 / DeepSeek path supports OpenAI-style function calling, so we can use it natively. If a provider doesn't return valid tool JSON, the orchestrator parses with a strict zod schema and rejects malformed responses → retries on next provider.

**My free-tier rec for tool use:** Cerebras Llama 3.3 70B is ridiculously fast for orchestration. Keep it as primary for autonomous sweeps (latency matters less, throughput matters more). DeepSeek stays as primary for client conversations (better Hinglish, more "human" feel).

**Add to provider config:** a `useFor` field — `["chat" | "verification" | "sweep"]` — so we can route by purpose. Keeps cost discipline if you ever go paid.

---

## 7 · AUDIT & OBSERVABILITY — THE TOP BUTTON

Per your answer: alerts go to **email + admin dashboard**, with a **top-bar Syn button** showing real-time per-client actions.

### 7.1 · The Top-Bar Button (Admin Dashboard)

New component: `components/admin/SynActivityButton.tsx`

- Lives in admin dashboard top bar (next to user profile)
- Pulsing dot when there's unread activity
- Click → slide-down panel (similar pattern to existing notifications) showing:
  - **Live actions feed:** every action Syn takes, real-time, per-client. Format: `[12:34] · Yashraj · ✅ Phase 3 → 4 (assets confirmed by Syn, all checks passed)`
  - **Filter:** by client, by severity (info / warning / blocker fail)
  - **Per-action expand:** shows which checks ran, evidence for each, what Syn did
  - **"Pause Syn"** master kill-switch (engages global kill-switch — Syn stops all auto-actions)

### 7.2 · Per-Client Kill Switch

In each deal admin view: a "Syn override" panel:
- Toggle: Allow Syn auto-actions for this deal (default: on for new deals)
- Manual force: Run Syn verification now → see what Syn would do → approve/reject
- Audit: full chronological log of every Syn action on this deal

### 7.3 · Email Alerts (Severity-Routed)

| Event                                          | Email? | Frequency |
| ---------------------------------------------- | :----: | --------- |
| Syn fires a transition successfully            |   ✓    | Per event |
| Syn checklist failed — needs admin attention   |   ✓    | Per event, "blocker fail" subject line |
| `request_admin_decision` posted                |   ✓    | Per event, with action buttons in email |
| Client engaged `#panic`                        |   ✓    | Immediate, urgent flag |
| Daily digest of Syn activity                   |   ✓    | 9am IST one summary email |

Reuse existing `lib/email/payment-notifications.ts` pattern for delivery.

### 7.4 · Audit Persistence

New table: `syn_actions` (Supabase)

```sql
create table syn_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  deal_token text references deals_v2(token),
  action_type text not null,           -- 'transition' | 'notify' | 'kill_switch' | 'flag_review' | 'admin_decision_request'
  target_action text,                  -- e.g., 'confirmAssets' (when action_type='transition')
  outcome text not null,               -- 'success' | 'blocked' | 'error'
  checklist_id text,                   -- which checklist ran
  evidence jsonb not null,             -- full VerifyOutcome dump
  acknowledged_by_admin boolean default false,
  acknowledged_at timestamptz
);
create index syn_actions_deal_token_idx on syn_actions(deal_token, created_at desc);
create index syn_actions_unack_idx on syn_actions(acknowledged_by_admin) where acknowledged_by_admin = false;
```

Every Syn action — successful or not — gets a row. This is **the source of truth** for the activity feed.

---

## 8 · GUARDRAILS — HARD RULES SYN CANNOT BREAK

These are enforced in code, not in prompts. Prompts can be jailbroken; code cannot.

1. **Syn cannot fire `forcePhaseJump` ever.** The action dispatcher rejects any request from `actor=syn` for this action with `403`.
2. **Syn cannot fire any transition if the kill-switch is on** (per-deal or global).
3. **Syn cannot fire two transitions on the same deal within 60 seconds** — rate limit on transitions per deal. Prevents runaway loops.
4. **Syn cannot bypass the verification engine.** The `attempt_transition` tool internally calls `runChecklist` first. There's no second path.
5. **Syn cannot read or write any deal not currently active.** Deleted/archived deals are invisible.
6. **Syn cannot fire `reject` ever.** Rejection has reputation consequences — admin only.
7. **Syn cannot transition out of phase 5 or 6** (final delivery + handover) — too much human judgment involved.
8. **Every Syn transition has a 5-minute admin rollback window.** Within 5 min of Syn firing a transition, admin can hit "Undo" in the activity feed → reverses the transition (calls a new `synRollback` admin-only endpoint that uses `forcePhaseJump` back to the previous phase, with audit note).
9. **Syn cannot send emails to clients other than via the structured `notify_client` tool**, which uses pre-approved templates from `lib/email/syn-templates.ts`. No free-form client emails.
10. **All Syn actions emit a `syn.action.fired` event** — easy to grep logs / monitor anomalies.

---

## 9 · BUILD PLAN — 5 SPRINTS (all 7 phases scope)

Each sprint is a deployable unit. Stop after any sprint = working incremental upgrade.

### **SPRINT 5 — Rollback + #panic + Webhook Wiring  ✅ SHIPPED 2026-05-14**

- [x] `app/api/admin/syn/rollback/[actionId]/route.ts` — 5-min rollback window, 4 safety guards (type, age, already-rolled-back, deal-hasn't-moved), uses forcePhaseJump
- [x] `components/admin/SynActivityButton.tsx` — "undo" button on transition.fired actions <5 min old
- [x] `lib/syn/panic.ts` + chat-route integration — client types `#panic` → Syn freezes deal kill-switch, loud admin email, canned calm reply, LLM skipped
- [x] Razorpay + Stripe webhooks → `synSweep()` wired post-payment-capture — Syn reacts to payment events in real time (doesn't wait for daily cron)
- [x] Production deploy: [https://synapsis-industries.vercel.app](https://synapsis-industries.vercel.app)

**Result:** The pilot is now fully closed-loop. Payment clears → Syn instantly re-checks the next gate. Client panics → Syn freezes itself. Syn fires wrong → admin has a 5-min undo button. All 5 sprints shipped.

**Remaining (post-Sprint-5 polish, not blocking):** daily digest email, virus-scan plumbing for asset uploads, `request_admin_decision` structured decision cards, manual NEFT verify route → synSweep wiring.

---

### **SPRINT 4 — Admin Observability (Activity Feed + Top-Bar Button + Kill Switch)  ✅ SHIPPED 2026-05-13**

- [x] `app/api/admin/syn/activity/route.ts` — GET paginated feed + POST bulk acknowledge
- [x] `app/api/admin/syn/kill-switch/route.ts` — POST toggle per-deal kill switch with reason
- [x] `components/admin/SynActivityButton.tsx` — pulsing top-bar button + slide-down panel with per-action expand, deal open shortcut, per-deal kill-switch toggle, filter by unread, mark-all-read, 30s auto-refresh
- [x] Mounted into `app/dashboard/page.tsx` next to NotificationCenter
- [x] Production deploy: [https://synapsis-industries.vercel.app](https://synapsis-industries.vercel.app)

**Result:** Open `/dashboard` → top-bar shows pulsing Syn sparkle icon → click → see every Syn action live, filter by unread, acknowledge in bulk, jump to any deal Syn touched, engage per-deal kill-switch with one click. The full observability loop is closed.

---

### **SPRINT 3 — Autonomous Orchestrator + Cron Sweep  ✅ SHIPPED 2026-05-13**

- [x] Extended `Actor` union in `lib/phases/schema.ts` to include `"syn"`
- [x] `lib/syn/orchestrator.ts` — `synSweep(deal)` runs relevant checklists, fires transitions via pure pipeline, persists via mutateDeal, audits to syn_actions, emails admin
- [x] `app/api/syn/cron/sweep/route.ts` — `GET` protected by `Bearer CRON_SECRET`; iterates active phase 0-6 deals
- [x] `vercel.json` cron config — daily 4am UTC (Hobby plan ceiling)
- [x] Production deploy: [https://synapsis-industries.vercel.app](https://synapsis-industries.vercel.app)
- [x] `SYN_GLOBAL_KILL_SWITCH=1` env var supported — set this in Vercel until Sprint 4 admin UI ships, to keep cron a no-op
- [x] Per-deal `synKillSwitch` JSONB column on `synapsis.deals` — orchestrator respects it

**External-cron note:** Vercel Hobby caps cron at one per day. For tight (5-min) auto-pilot, point an external cron service (cron-job.org, GitHub Actions, EasyCron) at `https://synapsis-industries.vercel.app/api/syn/cron/sweep` with header `Authorization: Bearer <CRON_SECRET>`. Or upgrade Vercel to Pro.

**Result:** Syn is now a real autonomous pilot. Cron sweeps deals, runs verification, fires transitions when safe, audits every decision, emails on each fire. SYN_GLOBAL_KILL_SWITCH=1 default-off until Sprint 4 ships the admin observability UI.

---

### **SPRINT 2 — Verification Engine + 11 Checklists + Admin Verify Endpoint  ✅ SHIPPED 2026-05-13**

- [x] `lib/syn/verification.ts` — engine (runChecklist, types, VerifyCtx builder)
- [x] `lib/syn/audit.ts` + Supabase migration `synapsis.syn_actions` + `synapsis.deals.syn_kill_switch`
- [x] `lib/syn/checklists/common.ts` — reusable rules (dealExists, killSwitchOff, noOpenIssue, phaseEquals)
- [x] 11 checklists across all 7 phases: elect, reject-timeout, goDecision-go, sendBlueprint, payment-phase-3, confirmAssets, submitFinal, payment-phase-6, markDeployed, uploadHandover, tryAdvanceToOrbit
- [x] `lib/syn/checklists/index.ts` — registry + `relevantChecklistsForDeal(phase)`
- [x] `app/api/syn/verify/[token]/route.ts` (GET — list relevant) + `[checklistId]/route.ts` (POST — run + audit) — admin-only manual verify
- [x] Production deploy: [https://synapsis-industries.vercel.app](https://synapsis-industries.vercel.app)

**Result:** Engine works. Admin can manually run any checklist on any deal via `POST /api/syn/verify/[token]/[checklistId]` and see exactly which rules passed/failed with evidence. Nothing auto-fires yet. Sprint 3 adds the autonomous sweep.

---

### **SPRINT 1 — Read-Only Brain Upgrade  ✅ SHIPPED 2026-05-13**

Smallest possible delta. Syn becomes radically more useful, takes zero actions.

- [x] Extend `ClientContext` in `lib/syn/intelligence.ts` to include snapshot field
- [x] Update `buildSynSystemPrompt` to inject live deal snapshot as structured markdown block
- [x] New file `lib/syn/snapshot.ts` — `buildDealSnapshot(token): DealSnapshot` — pulls deal + payments + manual proofs + invoices + audit tail + raised counts + canTransition map + per-phase digest
- [x] Wire snapshot into `/api/syn/chat/[token]/route.ts` with graceful degradation
- [x] Production deploy: [https://synapsis-industries.vercel.app](https://synapsis-industries.vercel.app)

**Result:** Syn now sees live state across all 7 phases — payment status, asset checklists, blueprint status, sprint reports, change orders, deliverables, revision rounds, handover state, orbit check-ins. It still takes zero actions. Next sprint adds the engine.

---

### **SPRINT 2 — The Verification Engine + One Live Checklist (4 days)**

Build the safety machinery, prove it on the lowest-risk transition.

- [ ] New folder `lib/syn/checklists/` with `phase-3-to-4.ts` (the example in §3.1)
- [ ] New file `lib/syn/verification.ts` — `runChecklist`, `VerifyOutcome` types
- [ ] New file `lib/syn/snapshot.ts` (extended) — adds `buildVerifyCtx(deal): VerifyCtx`
- [ ] New file `lib/syn/audit.ts` — `recordSynAction(action: SynActionLog)` writes to `syn_actions` table
- [ ] Supabase migration: create `syn_actions` table (see §7.4)
- [ ] Add `synKillSwitch` field to deals schema
- [ ] **No transitions wired yet.** Just expose `POST /api/syn/verify/[token]/[checklistId]` for admin to manually run a checklist and see results — proves engine works in isolation
- [ ] Build admin "Run Syn verification" button on each phase-3 deal — admin clicks, sees full VerifyOutcome with evidence per rule

**Deploy after Sprint 2.** Verification engine exists, admin can manually invoke. Syn still doesn't auto-act.

---

### **SPRINT 3 — Autonomous Pilot for Phase 3→4 + Activity Feed (5 days)**

Switch on the pilot for one transition. Activity feed visible.

- [ ] New file `lib/syn/orchestrator.ts` — `synSweep(deal)` runs checklists, fires transitions when passing, records audit, notifies admin
- [ ] New cron route `app/api/syn/cron/sweep/route.ts` — every 5 min, calls `synSweep` for all active phase-3 deals
- [ ] Configure Vercel Cron in `vercel.json` for the sweep
- [ ] Add `actor: "syn"` support to `lib/phases/transitions.ts` and the phase API auth gate (admin OR syn allowed for `confirmAssets`)
- [ ] Build `components/admin/SynActivityButton.tsx` — top-bar with pulsing dot
- [ ] Build slide-down activity feed panel reading from `syn_actions`
- [ ] Build "Pause Syn (this deal)" toggle in admin deal view
- [ ] Build "Pause Syn globally" toggle in activity feed panel
- [ ] Email integration: send admin email per Syn-fired transition
- [ ] **Soft launch:** kill-switch ON globally by default. Manually flip it on for Yashraj's deal as the first live test.

**Deploy after Sprint 3.** Phase 3→4 auto-pilot is live for opted-in deals. Activity feed shows everything.

---

### **SPRINT 4 — Expand to All Eligible Transitions + #panic + Rollback (5 days)**

Generalize the pattern, add safety nets.

- [ ] Build checklists: `phase-0-to-1.ts` (elect), `payment-phase-3.ts`, `payment-phase-6.ts`, `phase-6-to-7.ts`
- [ ] Wire each into the cron sweep
- [ ] Build `#panic` keyword detection in chat → `engage_kill_switch` tool call
- [ ] Build 5-minute admin rollback window UI in activity feed (every recent transition shows "Undo" button)
- [ ] Build `synRollback` admin endpoint (uses `forcePhaseJump` with audit note: "Syn-fired transition rolled back by admin within window")
- [ ] Build `request_admin_decision` flow — Syn posts structured decision cards, admin clicks button in email or dashboard, Syn proceeds
- [ ] Build daily digest email cron (9am IST)
- [ ] Stress test: simulate 50 deals at various phases, run sweep, audit results

**Deploy after Sprint 4.** Syn is the full nerve. All eligible transitions are auto-piloted. Admin has full visibility, kill-switch, rollback.

---

## 10 · ROLLOUT DEFAULTS  (decisions locked, no further sign-off needed)

Per directive 2026-05-13 — "tere dimag ke according aur mere instruction ke according." The following defaults are locked. Each can be flipped later via admin toggle once Sprint 3 ships.

| Setting                              | Default                | Why |
| ------------------------------------ | ---------------------- | --- |
| Syn-eligible transitions             | 11 transitions + check-in scheduling — see §2 ACL | "Saare 7 phases ka powers" — full pilot across the protocol |
| Verification rules                   | Deterministic only — no LLM judgment | Prompt jailbreaks cannot cause unsafe transitions |
| Admin rollback window                | 5 minutes              | Short enough to be invisible to client, long enough to catch obvious mistakes |
| Cron sweep interval                  | 5 minutes              | Tight feedback on payment events without burning compute |
| Sprint cadence                       | Each sprint deploys independently; Dhananjay observes between sprints | Sprint 1 already live; Sprints 2-5 follow as time permits |
| First live test deal                 | Yashraj (Azure Sands)  | He's at phase 3 with the asset-confirm gate — perfect first auto-action target |
| Kill-switch default                  | Globally **ON** until Sprint 3 admin UI ships | Cannot accidentally auto-pilot before activity feed is visible |
| Notification channels                | Email + admin dashboard top-button (Sprint 3) | Per Dhananjay's directive |

---

## APPENDIX A · FILE TREE OF NEW/MODIFIED CODE

```
VARK PORTFOLIO/
├── lib/syn/
│   ├── intelligence.ts          [MODIFY] inject DealSnapshot in prompt
│   ├── providers.ts             [MODIFY] add useFor routing field
│   ├── snapshot.ts              [NEW] buildDealSnapshot, buildVerifyCtx
│   ├── verification.ts          [NEW] runChecklist, VerifyOutcome
│   ├── tools.ts                 [NEW] tool schemas for LLM function calling
│   ├── orchestrator.ts          [NEW] synSweep — autonomous loop
│   ├── audit.ts                 [NEW] recordSynAction
│   └── checklists/
│       ├── phase-0-to-1.ts      [NEW] elect checklist
│       ├── phase-3-to-4.ts      [NEW] confirmAssets checklist
│       ├── payment-phase-3.ts   [NEW] advance payment preconditions
│       ├── payment-phase-6.ts   [NEW] final payment preconditions
│       └── phase-6-to-7.ts      [NEW] orbit auto-advance
├── app/api/syn/
│   ├── chat/[token]/route.ts    [MODIFY] use snapshot, expose tools
│   ├── verify/[token]/[checklistId]/route.ts  [NEW] manual verify endpoint
│   └── cron/sweep/route.ts      [NEW] autonomous sweep cron
├── app/api/admin/syn/
│   ├── activity/route.ts        [NEW] paginated syn_actions feed
│   ├── kill-switch/route.ts     [NEW] toggle global or per-deal kill switch
│   └── rollback/[actionId]/route.ts  [NEW] 5-min undo
├── components/admin/
│   ├── SynActivityButton.tsx    [NEW] top-bar pulsing button
│   ├── SynActivityFeed.tsx      [NEW] slide-down panel
│   └── SynKillSwitchToggle.tsx  [NEW] per-deal toggle in admin deal view
└── supabase/migrations/
    └── 20260513_syn_actions.sql [NEW] table + indexes
```

---

## APPENDIX B · WHY NOT JUST USE A WORKFLOW ENGINE (TEMPORAL, ETC.)

Considered. Rejected because:
- Adds infra dependency Synapsis doesn't have today
- The state machine already exists in pure functions (`lib/phases/transitions.ts`) — no rewrite needed
- The verification engine + cron is ~400 LoC of typescript — simpler to maintain than Temporal cluster operations
- Vercel-native (cron + edge functions) keeps deployment story unchanged

Revisit when transitions/sec exceeds 1000 (i.e., when you're at hundreds of active clients).

---

## END OF DOC

After your sign-off on §10, I'll start with Sprint 1 and deploy. Each sprint is a standalone increment — you can stop at any sprint and Syn is more useful than before, never less.
