# SYNAPSIS INDUSTRIES — PHASE ARCHITECTURE
> Living document. Each phase defined, refined as we build.
> Last updated: 2026-03-19

---

## THE PREMIER PRO MODEL

Home Panel → Click Project → Workspace Opens → All tools for THAT project only → Close → Back to Home

Each phase = one game level. Client completes it, moves forward. Cannot go back.
Admin can access any phase, any client, anytime.

---

## PHASE 0 — SIGNAL *(invisible to client)*

**Client knows:** They submitted the form. They see "Message Received."
**You see:** Their inbox card — name, company, need, budget, message, business problem.

**What happens here:**
- Client submits form → lands in your Inbox
- Client gets a unique portal link: `/client/[token]`
- On their portal: a **48-hour countdown timer** starts immediately
- You review the card — 3 possible outcomes:

**Outcome A — ELECT (before 48hrs):**
- You click ELECT on the inbox card
- Timer stops on client's portal
- Client sees: "You've been selected. Proceed to Phase 1 →" button
- Client clicks Proceed → Phase 1 opens for both admin and client

**Outcome B — REJECT (before 48hrs):**
- You click REJECT on the inbox card (with optional note)
- Client portal shows polite rejection message
- Case closed

**Outcome C — TIMER EXPIRES (48hrs, no response):**
- Client portal shows 3 options:
  1. "My budget is more flexible" → input to update budget → admin notified
  2. "Let me clarify my vision" → textarea to add details → admin notified
  3. "Give me 3 more hours" → timer extends 3hrs → auto-reject after that
- If none selected / 3hr extension also expires → auto-rejection message shown

**Admin options:** ELECT, REJECT (with note), Archive
**Client sees:** Countdown timer → then one of the 3 outcomes above

**Status indicator:** `SIGNAL` → `ELECTED` / `REJECTED` / `EXPIRED`

---

## PHASE 1 — DISCOVER

**Client knows:** They've been accepted. They have access to their dashboard for the first time.
**You see:** Their Phase 1 workspace opens on your admin side.

**The Big Reveal moment:**
When client enters Phase 1 for the first time — they see the full journey map.
Not in detail, just visually: "Phase 1 → 2 → 3 → 4 → 5 → 6 → 7"
They know where they are. They know there's a structured path ahead.
This alone signals: *"this person operates differently."*

**What happens here:**
- Client fills a structured Discovery Questionnaire (inside the dashboard)
- Questions are sharp — reveal pain, urgency, seriousness:
  - "What is breaking right now in your business?"
  - "What have you already tried?"
  - "Who else is involved in making this decision?"
  - "What happens if this doesn't get built in the next 3 months?"
  - "What does success look like to you specifically?"
- You schedule a 45-min Discovery Call
- You lead the call — you listen more than you talk
- Post-call: your internal GO / NO-GO decision
- If GO → Phase 2 unlocks
- If NO-GO → you decline with a note

**Admin options (6):** View questionnaire, Schedule call, Add notes, Go decision, No-go decision, Message client
**Client options (4):** Fill questionnaire, View journey map, Message, View status

**Data collected here that feeds future phases:**
- Real problem (not stated problem)
- Decision-making structure
- Budget reality check
- Urgency level
- What assets they have (brand, existing systems)

**Status indicator:** `DISCOVER`

---

## PHASE 2 — BLUEPRINT

**Client knows:** You've reviewed everything and you're preparing their system design.
**You see:** Blueprint builder workspace.

**What happens here:**
- You go silent for 48-72 hours (client sees "Blueprint in preparation")
- You build the System Blueprint Document:
  - Problem Statement (in your words — proves you understood)
  - Proposed Solution Architecture
  - Scope — what's IN, what's explicitly OUT
  - Tech stack + rationale
  - Timeline (sprints, not dates)
  - Investment breakdown
  - Payment structure (advance / milestone / final %)
  - What you need from them to start
- Blueprint delivered inside the dashboard (not email)
- Client reviews — 3 options: Approve, Request Changes, Decline
- Negotiation happens here — tracked, documented
- Once approved → Phase 3 unlocks

**Admin options (6):** Build blueprint, Preview as client, Send blueprint, Track negotiation, Approve/lock, Notes
**Client options (4):** View blueprint, Request changes, Approve, Message

**Status indicator:** `BLUEPRINT`

---

## PHASE 3 — IGNITION

**Client knows:** Blueprint approved. One thing left before work begins — advance payment.
**You see:** Payment pending indicator.

**What happens here:**
- Advance invoice generated inside dashboard
- Client sees payment amount, payment link, deadline
- **Nothing moves until advance is received. This is the hard gate.**
- Advance received → system auto-triggers:
  - Project workspace fully activates
  - Kickoff Summary generated and sent
  - Asset collection checklist appears for client
  - Timeline locks in
  - Phase 4 unlocks automatically
- Client submits required assets (brand files, credentials, references)
- You confirm assets received → BUILD begins

**Admin options (6):** Generate invoice, Mark paid, Request assets, Review assets, Confirm kickoff, Notes
**Client options (4):** View invoice, Pay, Upload assets, Message

**Payment gate:** ⚡ ADVANCE (40-50% of total)
**Status indicator:** `IGNITION`

---

## PHASE 4 — BUILD

**Client knows:** Work is happening. They can see weekly updates inside their dashboard.
**You see:** Full build management workspace.

**What happens here:**
- Weekly Sprint Cycle:
  - Every Friday → Sprint Report posted inside dashboard
  - ✅ Done this week / 🔄 Next week / ❓ Need from you
  - Client has 48hrs to respond to "Need from you" items
  - No response = you proceed with best judgment (documented)
- Change Request system:
  - Client wants something new → Change Order created
  - Impact on scope, timeline, cost shown clearly
  - Client approves/declines → documented
  - No verbal change requests accepted
- Progress visible to client (%, screenshots, staging links)
- Mid-milestone delivery (if large project):
  - Staging URL delivered
  - Client signs off on direction
  - Mid-payment invoice sent
- Client cannot modify anything directly — only through Change Orders

**Admin options (6):** Post sprint update, Create change order, Upload deliverable, Request mid-payment, Message, Notes
**Client options (4):** View updates, Submit change request, View staging, Message

**Payment gate:** ⚡ MID-PAYMENT (20-30%, large projects only)
**Status indicator:** `BUILDING`

---

## PHASE 5 — DELIVER

**Client knows:** Final build is ready for their review.
**You see:** Delivery management workspace.

**What happens here:**
- Final build delivered on staging/preview URL inside dashboard
- Client Review Period: 5 business days
- Revision rounds: 2 included, tracked inside dashboard
- Each revision request documented
- "One more thing" requests → Change Order (not free)
- Final approval in writing (button inside dashboard: "I Approve This")
- Approval received → Phase 6 unlocks

**Admin options (6):** Submit final build, Track revisions, Create change order, Request approval, Message, Notes
**Client options (4):** View final build, Submit revision request, Approve, Message

**Status indicator:** `REVIEW`

---

## PHASE 6 — HANDOVER

**Client knows:** Approved. Final payment → they get everything.
**You see:** Handover checklist workspace.

**What happens here:**
- Final invoice generated
- **Payment before deployment — always**
- Final payment received → deployment happens
- Handover Package delivered inside dashboard:
  - What was built (with screenshots)
  - How to use it (non-technical language)
  - Access credentials
  - Architecture overview
  - Emergency contact / what to do if something breaks
  - 30-day bug support window (bugs only, no new features)
- Project marked COMPLETE
- Phase 7 automatically schedules

**Admin options (6):** Generate final invoice, Mark paid, Deploy, Upload handover package, Mark complete, Notes
**Client options (4):** View invoice, Pay, Download handover package, Message

**Payment gate:** ⚡ FINAL PAYMENT (remaining %)
**Status indicator:** `HANDOVER`

---

## PHASE 7 — ORBIT

**Client knows:** Project is done. But the relationship isn't.
**You see:** Relationship management workspace.

**What happens here:**
- Auto-scheduled check-ins:
  - 30-day: "How's it running?" (bugs fixed free)
  - 90-day: Referral ask + retainer offer
  - Annual: "Here's what your system did this year"
- Maintenance Retainer offer:
  - ₹X/month
  - 4hrs of updates/improvements
  - Priority response
  - Monthly performance report
- Referral Program:
  - Client refers someone who becomes paying client
  - They get credit/benefit (to be decided)
- Client stays in ORBIT indefinitely
- If new project emerges → new workspace created, new Phase 0 begins

**Admin options (6):** Log check-in, Send retainer offer, Track referral, Create new project, Notes, Archive
**Client options (4):** View project summary, Request support, Refer someone, Message

**Status indicator:** `ORBIT`

---

## PHASE PROGRESSION RULES

| Rule | Admin | Client |
|---|---|---|
| Can go back to previous phases | ✅ Yes | ❌ No |
| Can skip phases | ✅ Yes | ❌ No |
| Can see all clients | ✅ Yes | ❌ No (only their own) |
| Max options visible per phase | 6 | 4 |
| Chat always visible | ✅ Yes | ✅ Yes |
| Phase unlocked by | Admin action | Completing requirements |

---

## OPEN QUESTIONS (to be decided)

- [ ] What exactly are the 4 client options in each phase?
- [ ] What are the 6 admin options in each phase?
- [ ] How does the Journey Map look visually in Phase 1?
- [ ] Payment gateway integration — Razorpay or Stripe?
- [ ] How does the chat work — real-time or async?
- [ ] Client login system — email/password or magic link?
- [ ] What happens if client goes inactive mid-phase?
