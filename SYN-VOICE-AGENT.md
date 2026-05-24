# SYN VOICE — AUTONOMOUS VOICE LAYER

> **Status:** Vision v1 · 2026-05-16
> **Author:** Claude (architect mode) for Dhananjay Chitmilla
> **Sibling docs:** [`SYN-ARCHITECTURE.md`](./SYN-ARCHITECTURE.md) (the brain), this doc (the voice).
> **Read order:** SYN-ARCHITECTURE first (Syn's authority model + checklist engine), then this. Voice agent does NOT reinvent Syn's authority — it inherits it.

---

## 0 · ONE-SENTENCE GOAL

**Syn gets a mouth and ears.** The same autonomous pilot that already runs 11/19 phase transitions now speaks in Dhananjay's cloned voice, takes inbound calls from clients via the portal, makes outbound calls to Dhananjay to report status, negotiates deal terms within hard guardrails, and locks profitable deals — all on a 100% free infrastructure footprint by skipping PSTN telephony entirely and using WebRTC inside the existing Synapsis portal.

---

## 1 · WHY THIS EXISTS — DHANANJAY'S STATED PROBLEM

Direct quote from Dhananjay (2026-05-16):

> *"Negotiating uplifting that I always lack… I want this voice agent feature to act as my guardian and handle all project operations, client financials, and har phases me Synapsis Industries me kisi bhi chiz me atakne pe sidha khud hi bohot sophisticatedly chize handle kar le. I am fed up because I can't able to lock the deal."*

**Translation into product requirements:**
1. The agent must out-negotiate Dhananjay (his own assessment of his weakness).
2. The agent must out-negotiate seasoned CEOs (his stated bar).
3. The agent must autonomously close high-value deals where appropriate.
4. The agent must handle followups without being told.
5. The agent must report back to Dhananjay in his own voice after every client interaction.
6. The agent must run on **zero recurring cost** to start.

---

## 2 · NON-NEGOTIABLES (HARD CONSTRAINTS)

| # | Constraint | Why |
|---|-----------|-----|
| 1 | **100% free infra at launch.** No Twilio, no Exotel, no paid TTS. | Stated requirement. |
| 2 | **Voice = Dhananjay's cloned voice.** English + Hinglish, both directions. | Stated. Brand consistency, trust. |
| 3 | **Live language detection + switch.** Client switches EN→Hinglish mid-call, agent follows seamlessly. | Stated. |
| 4 | **Negotiation autonomy with guardrails.** Agent can close deals within pre-approved price floor and scope envelope. | Stated, but bounded for legal/financial safety. |
| 5 | **Full Synapsis context.** Agent reads from same DB Syn reads: deals, payment state, blueprints, projects, phase data, compliance, calendar. | Required to be useful. |
| 6 | **Inherits Syn authority model.** Voice agent cannot fire any transition Syn cannot fire. Voice does not unlock new powers. | Safety. SYN-ARCHITECTURE §2 is law. |
| 7 | **Every call logged + transcripted + summarized.** Append-only audit trail in Supabase. | Disputes, compliance, learning loop. |
| 8 | **Dhananjay-callback after every external call.** Agent calls Dhananjay (WebRTC push) to brief him on what happened, decisions taken, items needing approval. | Stated. |

---

## 3 · THE "ZERO-COST" TRICK — WHY WE SKIP TELEPHONY

The single biggest cost in voice agents is **PSTN telephony** (real phone numbers, real call minutes). Retell/Vapi/Bland all ride on Twilio/Plivo and pass that cost through (~$0.07–0.15/min).

**Our cheat:** clients don't call a phone number. They click the **"Voice agent"** button in the portal sidebar (already mocked in screenshot 2026-05-16). That opens a WebRTC session in their browser — mic+speaker directly to our server, no telephone network involved. Outbound to Dhananjay is the same: push notification → he opens dashboard → WebRTC. **Zero per-minute cost forever** at this layer.

**Trade-off:** clients must be logged into the portal to talk to the agent. For Phase 0 (cold inbound prospects) and Phase 7 (long-term clients who don't visit portal daily), we eventually need PSTN — that's the only paid extension, deferred to Sprint 5+.

---

## 4 · THE FREE STACK (END-TO-END)

| Layer | Choice | Why free | Fallback |
|---|---|---|---|
| **Realtime transport** | LiveKit Open Source (self-hosted on existing VPS) | MIT licensed, full WebRTC stack | LiveKit Cloud free tier: 10k participant-min/mo |
| **STT (speech→text)** | Groq Whisper Large v3 Turbo via API | Groq keys already owned (3 keys in API file), free tier very generous, ~200ms latency | Deepgram free tier (45k min/mo) |
| **LLM brain** | Cerebras Llama 3.3 70B + Gemini 2.0 Flash + DeepSeek V4 (3-key rotation via OpenRouter) | All keys already owned, all have free tiers | Groq Llama as backup |
| **TTS (text→speech, cloned voice)** | **Coqui XTTS-v2** (self-hosted) → migrate to **F5-TTS** for quality | Both MIT/Apache, voice clone from 6-sec sample, native multilingual (Hindi + English), runs on consumer GPU or HuggingFace Spaces free tier | Sarvam AI Bulbul-v2 free tier (native Hinglish, Indian) |
| **Language detect** | First 2 seconds of audio → fastText langid or LLM-classified token in transcript | Free, runs in-process | — |
| **Push notification (outbound to Dhananjay)** | ntfy.sh (self-host or free public) → browser notification → WebRTC join | Free, open source | Web Push API direct |
| **Datastore** | Existing Supabase `synapsis` schema (extended with `voice_calls`, `call_turns`, `call_decisions` tables) | Already paid for | — |
| **Hosting** | Existing Vercel for Next.js portal + 1 VPS or HuggingFace Space for LiveKit + TTS GPU | Vercel already used; HF Space free GPU (T4) is enough for XTTS-v2 inference | Modal $30 free credit, Replicate free credit |

**Net monthly cost projection (Phase 1):** ₹0 if HF Space + Groq + Gemini free tiers hold, ₹0–500 if VPS GPU needed.

---

## 5 · VOICE CLONING — THE PIPELINE

**Step 1 — Sample collection (Dhananjay records, one-time):**
- 4 samples × 60–90 seconds each:
  1. **English, calm/professional.** Reading a discovery-call script.
  2. **English, confident/closing.** Reading a price-defense script.
  3. **Hinglish, casual.** Reading a relationship-building script (the way you talk to me).
  4. **Hinglish, firm.** Reading a "this is the price, here's why" script.
- Recording specs: 44.1kHz, mono, WAV, quiet room, single mic, no compression. ~5 min total.

**Step 2 — Model:**
- **XTTS-v2** for v1: zero-shot voice cloning, 6-sec reference is enough, but giving it 4×60s gives much better fidelity. Inference: ~200ms per sentence on T4 GPU, streamable in chunks (~80ms first audio).
- **F5-TTS** for v2 (when v1 latency/quality is bottleneck): better naturalness, similar clone quality, slightly slower.

**Step 3 — Code-switching:**
- XTTS-v2 supports Hindi + English in same generation. We pass language token per sentence based on what STT detected.
- Agent's LLM is instructed: *"Respond in the language the client just spoke. If they switch, you switch on the next turn."*
- Two voice references stored per language for tone match (English-confident sample primes English output, Hinglish-firm primes Hindi-mixed output).

**Step 4 — Streaming:**
- Generate TTS in **sentence chunks**, not full response. First chunk plays while second generates. Perceived latency drops from 2s to ~400ms.

---

## 6 · CAPABILITY MATRIX — WHAT VOICE-SYN DOES AUTONOMOUSLY

Voice-Syn inherits **all 11 Syn-eligible transitions** from SYN-ARCHITECTURE §2. New voice-specific capabilities below.

### A · Inbound from Client (via portal "Voice agent" button)

| Client says / asks | Voice-Syn does autonomously | Needs Dhananjay approval |
|---|---|---|
| "When does Phase 4 unlock?" | Reads live deal state, answers with exact gate + ETA | No |
| "I uploaded my assets" | Verifies in DB, if complete fires `confirmAssets`, advances phase | No |
| "What's the next sprint?" | Reads sprint report from Build phase, summarizes | No |
| "I want to add scope X" | Estimates scope delta from blueprint, proposes change order with price | **Yes** — sends change order to Dhananjay for sign-off before committing |
| "Discount do bhai" | **Negotiates** within pre-set floor (§7). Holds line. Closes if client agrees. | Auto-closes within envelope; escalates outside |
| "Mujhe project cancel karna hai" | Listens, empathizes, surfaces root cause, offers Phase Pause option, escalates to Dhananjay | **Yes** — never approves cancellation |
| "Payment kab tak karna hai?" | Reads payment schedule from blueprint, sends Razorpay link via chat | No |
| "Timeline slip kyu hua?" | Reads sprint history, gives honest reason, commits revised ETA only if within slack budget | If new ETA exceeds contract, escalate |
| "Kya tum AI ho?" | Honest: *"Haan, main Synapsis ka AI agent hoon — Dhananjay ki voice me trained. Sab kuch live record ho raha hai, Dhananjay sun lega."* | No — disclosure is mandatory on direct ask |

### B · Outbound from Voice-Syn (proactive)

| Trigger | Voice-Syn does | Approval |
|---|---|---|
| Phase 3 advance payment pending > 48hrs | Calls client (WebRTC push), reminds, captures objection, offers alternate split | Auto; reports to Dhananjay after |
| Phase 4 sprint missed deadline by 3+ days | Calls client proactively, owns the slip, gives revised commit | Auto |
| Phase 6 final payment overdue > 24hrs | Calls client, firmness escalates with day count, last gate before legal | Auto till day 7, escalate after |
| Phase 7 30d/90d check-in due | Calls client, surveys, surfaces upsell signals | Auto |
| New high-intent lead in #panic or contact form with budget signal ≥ ₹2L | Calls Dhananjay first, briefs, gets green light, then calls lead | **Yes** — Dhananjay clicks "go" |
| Any deal stuck in same phase > 7 days with no client action | Calls client to unstick | Auto |

### C · Dhananjay-callback (after every external call)

After **every** client-facing call, voice-Syn calls Dhananjay (via push → WebRTC) and briefs:
- "Yashraj se baat hui. Phase 4 ka status pucha. Ek scope addition manga — admin dashboard pe analytics widget. Maine ₹35k ka change order draft kar diya hai, tu approve karega tab bhejunga. Call duration 6 min 12 sec. Negotiation moment: usne 20% discount manga, maine 8% pe rok diya floor pe."

Brief structure (always same 6 lines):
1. **Who** + duration
2. **Why they called / what was raised**
3. **What I decided autonomously**
4. **What needs your approval**
5. **Risk flags** (anger, churn signal, payment hesitation)
6. **Upsell signals** detected

---

## 7 · NEGOTIATION FRAMEWORK — HOW VOICE-SYN HOLDS THE LINE

Dhananjay's stated weakness is folding under pressure. Voice-Syn must NOT fold. Rules:

### Pre-call setup (per deal, set once by Dhananjay or auto-derived from blueprint):

| Parameter | Default | Source |
|---|---|---|
| `priceFloor` | 85% of quoted | Blueprint investmentTotal × 0.85 |
| `scopeLockset` | All Blueprint Phase 2 deliverables | Frozen on `approveBlueprint` |
| `maxConcessionAmount` | min(15% discount, ₹25k) | Auto |
| `maxConcessionScope` | 1 small addition OR 1 timeline extension of ≤7 days | Auto |
| `escalationTriggers` | discount > 15%, scope > 1 addition, timeline > 7 days, anger detected, legal threat | Hard rule |

### In-call negotiation playbook (LLM system prompt + tool calls):

1. **Anchor high, never first to move.** If client asks "kitna kam karoge?", agent reflects: *"Pehle samjho kya milta hai is investment me — phir dekhte hain."*
2. **Trade, never give.** Every concession requires a counter-concession (faster payment, longer engagement, referral, testimonial).
3. **Silence > filler.** Agent is trained to pause 2–3 seconds after pricing statements. Awkward silence pressures client to concede.
4. **Stack value, then price.** Always recite scope before defending price.
5. **The "Dhananjay check" technique.** When client pushes hard: *"Dekh, main tujhe seedha bolta hoon — main yeh deal decide kar sakta hoon ek limit tak. Usse aage Dhananjay ke paas jana padega, aur woh aur saath nahi jhukega. Yeh limit hai, isme deal lock kare?"* (uses Dhananjay as bad cop while agent plays empathetic closer)
6. **Walk-away script.** If client below floor: *"Bhai, is price pe hum quality compromise karenge — aur Synapsis ka kaam compromise pe nahi chalta. Mujhe lagta hai abhi fit nahi hai, 3 mahine baad budget allow kare to wapas baat karte hain."* — politely declining is a closing skill, not failure.
7. **Lock when client agrees.** Immediately fire `sendBlueprint` if Phase 1, or create Razorpay link if Phase 3 advance. **The moment of yes is fragile — close it in the call.**

### Negotiation transcript training:
- Initial system prompt seeded with: Chris Voss tactical empathy, Alex Hormozi value stacking, Indian business context (festival timing, payment culture, GST conversations).
- Every call where deal locked > floor is added to RAG store as positive exemplar.
- Every call where deal lost is reviewed (by Dhananjay or by another LLM critic), failure mode tagged, prompt refined.

---

## 8 · ARCHITECTURE — SYSTEM DIAGRAM (DESCRIBED)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SYNAPSIS CLIENT PORTAL (Vercel)                 │
│   /client/[token]   →   [Voice agent button]                        │
│                              │                                      │
│                              ▼                                      │
│              LiveKit JS SDK (browser WebRTC)                        │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ wss://
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│         LIVEKIT SERVER (self-host VPS or LiveKit Cloud free)        │
│         Rooms · SFU · authentication via JWT from portal            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│            VOICE-SYN AGENT WORKER (Python, LiveKit Agents SDK)      │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────────────┐  │
│  │ Audio   │───▶│ Groq     │───▶│ Brain   │───▶│ XTTS-v2 cloned  │  │
│  │ in      │    │ Whisper  │    │ (Cere-  │    │ voice (HF Space │  │
│  │ stream  │    │ STT +    │    │ bras /  │    │ T4 GPU)         │  │
│  │         │    │ langid   │    │ Gemini) │    │ → audio stream  │  │
│  └─────────┘    └──────────┘    └────┬────┘    └────────┬────────┘  │
│                                      │                  │            │
│                                      ▼                  │            │
│                          ┌───────────────────┐          │            │
│                          │ TOOL LAYER        │          │            │
│                          │ · readDealState   │          │            │
│                          │ · advancePhase    │          │            │
│                          │ · sendPaymentLink │          │            │
│                          │ · createChangeOrder│         │            │
│                          │ · escalateToHuman │          │            │
│                          │ · scheduleCallback│          │            │
│                          │ · negotiate(...)  │          │            │
│                          └─────────┬─────────┘          │            │
└────────────────────────────────────┼────────────────────┼────────────┘
                                     │                    │
                ┌────────────────────┴────────┐           │
                ▼                             ▼           ▼
       ┌─────────────────┐         ┌──────────────────┐  audio out
       │ SUPABASE        │         │ EXISTING SYN     │
       │ synapsis schema │         │ verification     │
       │ + voice_calls,  │         │ engine + ACL     │
       │ call_turns,     │         │ (SYN-ARCH §3)    │
       │ call_decisions  │         └──────────────────┘
       └─────────────────┘
```

### Data flow per turn:
1. Client speaks → browser captures audio → LiveKit room
2. Agent worker subscribes to audio track → streams to Groq Whisper
3. Transcript + detected language → brain LLM with full deal context (read from Supabase via `readDealState` tool)
4. LLM decides: respond directly OR call a tool (advancePhase, createChangeOrder, etc.)
5. Tool calls hit existing Syn verification engine — same checklist, same ACL, same audit trail
6. LLM response text → XTTS-v2 with cloned voice reference → audio stream back to client
7. Every turn (audio, text, tool calls, decisions) written to `call_turns` table append-only

---

## 9 · SAFETY GUARDRAILS — WHAT KEEPS THIS FROM EXPLODING

| Risk | Mitigation |
|---|---|
| Agent commits to price below floor | Hard guardrail in tool: `commitPrice(amount)` rejects if `amount < deal.priceFloor`. LLM can't override. |
| Agent commits to scope outside lockset | Same: `createChangeOrder` requires Dhananjay approval if items > maxConcessionScope. |
| Agent impersonates Dhananjay (legal risk) | Mandatory disclosure on direct ask. Mandatory disclosure embedded in opening line: *"Synapsis Industries — Dhananjay ka AI agent bol raha hoon."* Client also sees text label "AI agent (Dhananjay's voice)" on the call UI. |
| Agent agrees to illegal terms (refund, IP transfer, etc.) | Terms-of-service constraints in system prompt + blocked tool calls. Any contract-modifying language triggers escalation. |
| Agent hallucinates project facts | Brain operates strictly on tool-returned data. System prompt: *"If a fact is not in tool output, say 'mujhe abhi check karna padega, 1 minute me bata raha hoon' and call readDealState."* |
| Voice cloning misused (deepfake) | Voice model + reference audio stays on Synapsis-controlled infra. Never exposed via public API. Watermark via inaudible signal in TTS output (Resemble.ai approach). |
| Client records call and shares | Disclosure that calls are recorded by Synapsis. Watermark. Standard. |
| Agent crashes mid-call | Graceful fallback: *"Connection slow ho raha hai, Dhananjay ko message bhej deta hoon, woh aaj wapas call karega."* Voicemail-style. Logs error, fires alert. |
| Force-lock (admin override) | Existing Syn force-lock applies. Dhananjay can disable voice agent for any specific deal with one click — agent refuses calls on that deal. |

---

## 10 · INTEGRATION WITH EXISTING SYNAPSIS STACK

| Existing system | How voice agent uses it |
|---|---|
| `lib/phases/transitions.ts` ACL | Agent's tool calls route through same ACL as `syn` actor |
| `lib/phases/verification-engine.ts` | Every autonomous decision passes through it |
| `lib/compliance/tax-engine.ts` | When discussing prices, agent uses tax-engine for invoice math. Never recomputes. |
| `synapsis.deals` table | Source of truth for everything per-deal |
| `synapsis.payments` + Razorpay infra | Agent uses existing payment template to send links mid-call |
| `app/client/[token]/page.tsx` portal | Adds `<VoiceAgentButton />` component (already mocked in screenshot) |
| Admin dashboard | New `/admin/voice` page: live call monitor, transcripts, decision log, negotiation outcomes |
| Cron / Syn scheduler | Schedules outbound calls based on phase timers |
| Push notification system | New: ntfy.sh channel `synapsis-dhananjay` for callback pings |

---

## 11 · ROLLOUT PLAN — 6 SPRINTS

| Sprint | Scope | Duration | Risk | Cost |
|:------:|---|:---:|:---:|:---:|
| **0** | Voice sample collection + XTTS-v2 clone proof-of-life. Local Python script, plays back Dhananjay's cloned voice saying 4 test sentences in EN + Hinglish. **No client-facing piece.** | 1 day | None | ₹0 |
| **1** | LiveKit room setup + browser button + 1-turn echo agent (client speaks, agent transcribes and plays back). No LLM yet. Validates end-to-end audio pipeline. | 2 days | Low | ₹0 |
| **2** | Brain integration: STT → LLM → cloned TTS. Read-only tools (`readDealState`, `readBlueprint`, `readSprintHistory`). Agent answers questions about the deal, cannot act yet. Deploy to one beta client. | 4 days | Medium | ₹0 |
| **3** | Action tools: `advancePhase`, `createChangeOrder` (with Dhananjay approval flow), `sendPaymentLink`, `scheduleCallback`. Dhananjay-callback brief implemented. | 5 days | High | ₹0 |
| **4** | Negotiation framework live: price floor, scope lockset, walk-away script, Chris Voss + Hormozi system prompt. Test on 3 real negotiation calls with Dhananjay observing. | 4 days | High | ₹0 |
| **5** | Outbound auto-calls (overdue payment reminders, sprint slip ownership, Phase 7 check-ins). Push notification → WebRTC return path. | 3 days | High | ₹0 |
| **6** | PSTN extension (paid): Exotel/Plivo SIP trunk for cold inbound prospects + outbound to non-portal contacts. **Optional, only if proven ROI from Sprints 2–5.** | 5 days | Medium | ₹2–5/min |

---

## 12 · LOCKED DECISIONS (2026-05-16, Dhananjay approved)

All four open questions resolved. No more blockers.

| # | Decision | Locked answer |
|---|---|---|
| 1 | GPU hosting for XTTS-v2 | **Local PC + ngrok tunnel.** Dhananjay keeps laptop powered on 24/7. Zero recurring cost. Migrate to HF Space only if local GPU bottlenecks during a real call. |
| 2 | Negotiation autonomy level | **Conservative for first 5 real deals.** Agent proposes, Dhananjay approves every close. After 5 successful closes, flip to aggressive (agent closes within envelope, reports after). |
| 3 | Voice sample recording | **Scripts already generated** (2026-05-16) at `SYN VOICE TRAINING/`. 5 PDFs: 1 master recording guide + 4 tone-specific scripts (EN calm, EN confident, Hinglish casual, Hinglish firm). Dhananjay records 2 takes per script (8 files total), drops them in `SYN VOICE TRAINING/recordings/`. |
| 4 | Voice variant strategy | **Single Dhananjay cloned voice for ALL contexts** — onboarded clients AND cold prospects. Trust this voice fully. No separate "Synapsis assistant" persona voice. Mandatory AI disclosure on direct ask remains (§9). |

**With these locked, Sprint 0 (sample collection + XTTS-v2 clone proof-of-life) begins immediately. Sprint 1 starts as soon as Dhananjay drops the 8 audio files in `SYN VOICE TRAINING/recordings/`.**

---

## 13 · WHAT I'M COMMITTING TO

If Dhananjay greenlights this doc:

- I will execute Sprint 0 (voice sample scripts + XTTS-v2 local proof-of-life) within this session if he records samples, or write the recording scripts + setup instructions now and resume on next session when samples are in.
- I will not touch `app/client/[token]/page.tsx` for the button until Sprint 1 is ready (architecture-first, not UI-first).
- I will not deploy anything to production until Sprint 2 passes a controlled test with one beta client.
- I will write every line of code with the awareness that this voice represents Dhananjay's reputation to paying clients — if I'm not 80% sure something is correct, I will surface uncertainty rather than ship it.

---

**End of vision doc. Awaiting greenlight to proceed to Sprint 0.**
