# QUESTIONNAIRE STRATEGY — Phase 1 (Strent defines WHAT to ask, WHY to ask it, and HOW to structure
> the Phase 1 questionnaire for maximum project intelligence.
> Written on 20ategic Discovery)

> This docum26-03-27 based on current portal position.

---

## Our Current Position

- Client has been **elected** — deal is confirmed.
- Client has gone through **Overview** (knows what we do, sees the complexity map).
- Client has gone through **Process** (understands the 7-phase architecture).
- Client is now in **Questionnaire** — this is the first time they're giving us real input.

**This is not a sales conversation anymore. This is an intelligence-gathering session.**

We are not trying to convince them. We are trying to understand their world deeply enough to build the right thing.

---

## What We Actually Need to Know

As a full-stack developer building a real system, here is what determines success or failure:

### AREA 1 — The Problem (Real, Specific, Unfiltered)
We need to understand the problem from the USER's perspective, not the client's business perspective.
- What breaks in their current workflow?
- What does the person using this system hate most right now?
- Where does time/money leak?

**Why this matters:** Without this, we build what the client THINKS they need, not what actually solves the problem.

### AREA 2 — Definition of Success (Specific, Measurable)
Not "it should look good" — actual metrics.
- What changes in 6 months if this works?
- What number moves? (Users, revenue, hours saved, errors reduced?)
- How will they know it worked?

**Why this matters:** Scope creep happens when success is undefined. With clear metrics, we know when we're done.

### AREA 3 — What Has Been Tried Before
- Tools, agencies, DIY attempts
- What worked partially, what failed completely
- Why did previous attempts not stick?

**Why this matters:** We don't repeat failed experiments. We learn what the real constraint is.

### AREA 4 — Technical Reality (What Exists Today)
- Current stack, tools, existing software in their workflow
- Brand assets (logo, colors, fonts — do they exist?)
- Domain, hosting, existing accounts we'll need access to
- Any integrations that are non-negotiable (CRM, payment, auth)

**Why this matters:** This is the actual technical scoping session. This determines complexity, timeline, and dependencies.

### AREA 5 — Constraints & Non-Negotiables
- What cannot change no matter what?
- Features that are fixed (must have)
- Things that are completely off the table

**Why this matters:** Every project has sacred cows. Finding them early prevents painful late-stage pivots.

### AREA 6 — People & Process (Who's Involved)
- Who gives feedback during the build?
- How fast does approval happen? (1 person or committee?)
- Who has final say on design, on copy, on features?

**Why this matters:** A 1-person decision maker = fast project. A 5-person committee = slow, difficult, and expensive.

---

## The 6 Questions (New Set)

Based on the 6 areas above, here are the final questions:

---

**Q1 — The Problem (Area 1)**
> "Describe the exact moment your current system/process fails — what is happening, who is frustrated, and what does it cost each time it happens?"

*Why this phrasing:* Forces specificity. "My system is slow" becomes "our team manually exports 200 rows every Monday morning and it takes 3 hours." That is buildable.

---

**Q2 — Definition of Success (Area 2)**
> "When this is built and running — what is the one metric or outcome that tells you it worked? Be specific: a number, a process, a before/after."

*Why this phrasing:* Anchors the entire project to a single measurable outcome. Prevents scope creep and misaligned expectations.

---

**Q3 — What Was Tried (Area 3)**
> "What have you already tried to solve this — tools, agencies, freelancers, or internal builds? For each, what happened and why did it not stick?"

*Why this phrasing:* Direct. We need the real story, not the polished version. The word "not stick" is softer than "fail" — gets more honest answers.

---

**Q4 — Technical Reality (Area 4)**
> "Walk me through what you currently use — software, tools, platforms, accounts. What must we integrate with, and what do you already have (domain, hosting, brand assets)?"

*Why this phrasing:* Opens up the full technical landscape. This answer determines 40% of our architecture decisions.

---

**Q5 — Non-Negotiables (Area 5)**
> "What are the 2-3 things about this project that are completely fixed — features, rules, or constraints that cannot change regardless of timeline or cost?"

*Why this phrasing:* Every client has these. Most don't say them upfront. This forces the conversation early.

---

**Q6 — People & Approvals (Area 6)**
> "Who else is involved in reviewing and approving work during this build — and how quickly can decisions get made when we need a yes or no?"

*Why this phrasing:* Not "who approves budget" (pre-sales). This is about workflow velocity. Knowing this upfront sets realistic expectations for both sides.

---

## Tone Guidelines for Questions

- Direct but not aggressive
- Curious, not interrogatory
- Each question should feel like it's asked by someone who genuinely wants to build the right thing — not someone filling out a form
- No jargon. No corporate language.
- Short questions. The detail comes from the answer.

---

## What We Do With These Answers

| Area | What We Extract | Where It Goes |
|---|---|---|
| Q1 — Problem | Core user pain, specific failure point | Informs architecture, prioritization |
| Q2 — Success metric | Definition of done | Scope document, milestone markers |
| Q3 — Prior attempts | What to avoid, real constraint | Technical decisions, risk areas |
| Q4 — Tech reality | Integrations, existing stack | Architecture plan, dependencies |
| Q5 — Non-negotiables | Fixed scope items | Contract, phase planning |
| Q6 — Stakeholders | Decision speed, who's in the room | Communication plan, timeline buffers |

---

## Implementation Notes

- 6 questions, one at a time (chosen creative format from ideation session)
- Minimum answer length before "Next" activates: ~50 characters (prevents "yes" answers)
- All 6 must be answered before Submit unlocks
- After submit → Chat tab unlocks (per LEVEL.md architecture)
- Admin sees answers in the workspace questionnaire tab (already built)
