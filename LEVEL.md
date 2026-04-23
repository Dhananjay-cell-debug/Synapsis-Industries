# LEVEL ARCHITECTURE — Synapsis Client Portal

> This document defines the "Level System" used across all phases of the client portal.
> When implementing a new phase, read this file and apply the same architecture.

---

## Core Concept

The client portal uses a **one-way gate system** for tab navigation.

Think of it like a video game level system:
- You **cannot skip levels** going forward.
- You **can go back** to any level you've already cleared.
- Once you go back, to move forward again you **must go step by step** — no shortcuts.

---

## The Rule (Single Line)

```
A tab is clickable if its index <= the index of the currently active tab.
```

That's it. One rule. No exceptions.

---

## Tabs & Their Order

Each phase has exactly **4 tabs**, always in this order:

| Index | Tab ID | Label | Purpose |
|---|---|---|---|
| 0 | `overview` | Overview | Orientation — what this phase is, what's needed |
| 1 | `process` | Process | Walk through the phase architecture via swipe cards |
| 2 | `questionnaire` | Questionnaire | Client answers key questions for this phase |
| 3 | `chat` | Chat | Live communication channel opens after Q is submitted |

---

## Navigation Rules by Active Tab

| Currently On | Overview | Process | Questionnaire | Chat |
|---|---|---|---|---|
| Overview (0) | ✅ current | 🔒 locked | 🔒 locked | 🔒 locked |
| Process (1) | ✅ clickable | ✅ current | 🔒 locked | 🔒 locked |
| Questionnaire (2) | ✅ clickable | ✅ clickable | ✅ current | 🔒 locked |
| Chat (3) | ✅ clickable | ✅ clickable | ✅ clickable | ✅ current |

---

## How Forward Movement Works

**Forward navigation is NEVER done by clicking the sidebar tab directly.**

It only happens via **content-triggered actions**:

| From | Action That Advances | Navigates To |
|---|---|---|
| Overview | Client clicks "Start Process" button | Process |
| Process | Client swipes through all cards (last card triggers) | Questionnaire |
| Questionnaire | Client submits all answers | Chat |
| Chat | N/A — this is the final tab | — |

This forces the client to actually engage with the content before moving on.

---

## Implementation

### State

```tsx
const [activeTab, setActiveTab] = useState<"overview" | "process" | "questionnaire" | "chat">("overview");

const TAB_ORDER = ["overview", "process", "questionnaire", "chat"];

const canAccessTab = (tabId: string) =>
    TAB_ORDER.indexOf(tabId) <= TAB_ORDER.indexOf(activeTab);
```

### Sidebar Nav (Lock Logic)

```tsx
const isLocked = !canAccessTab(tab.id);

<button
    disabled={isLocked}
    onClick={() => !isLocked && setActiveTab(tab.id)}
>
    {isLocked ? <Lock size={10} /> : tab.label}
</button>
```

### Forward Handlers (Content-Triggered)

```tsx
// Overview → Process
const handleUnlock = () => {
    setActiveTab("process");
    window.scrollTo({ top: 0, behavior: "smooth" });
};

// Process → Questionnaire (called from last swipe card)
const handleQuestionnaireUnlock = () => {
    setActiveTab("questionnaire");
    window.scrollTo({ top: 0, behavior: "smooth" });
};

// Questionnaire → Chat (called after form submit)
const handleChatUnlock = () => {
    setActiveTab("chat");
    window.scrollTo({ top: 0, behavior: "smooth" });
};
```

### Overview Tab — Unlock Gate

The Overview tab always renders an unlock gate button at the bottom.
This is the ONLY way to enter Process.

```tsx
// In OverviewTab component:
// Always pass unlocked={false} — the gate is always visible when on Overview.
// The button calls onUnlock() → setActiveTab("process")
<OverviewTab unlocked={false} onUnlock={handleUnlock} ... />
```

---

## What NOT to Do

- ❌ Do not add a `processUnlocked`, `chatUnlocked` boolean per tab — one `activeTab` state is enough
- ❌ Do not let sidebar tab clicks advance the user forward
- ❌ Do not add a `useEffect` to re-lock tabs on navigation — the `canAccessTab` function handles this automatically
- ❌ Do not skip this architecture for "simpler" phases — consistency across phases is the point

---

## Applying to a New Phase

When Claude is asked to implement Phase N (e.g. Phase 2 — Blueprint):

1. Use the same 4-tab structure: `overview`, `process`, `questionnaire`, `chat`
2. Copy the `canAccessTab` logic exactly
3. The Overview content will be different (Phase 2 info, complexity, etc.)
4. The Process cards will be different (Phase 2 swipe cards)
5. The Questionnaire questions will be different (Phase 2-specific questions)
6. The Chat tab stays the same (same component, just different phase context)
7. Do NOT invent a new locking mechanism — this one works

---

## Example Walkthrough (Phase 1 — Discover)

```
Client opens portal for the first time
→ activeTab = "overview"
→ Process, Questionnaire, Chat = all locked

Client reads Overview, clicks "Start Process"
→ handleUnlock() called
→ activeTab = "process"
→ Now Overview is clickable (back), Process/Q/Chat still — Q & Chat locked

Client swipes through all 11 process cards
→ Last card triggers handleQuestionnaireUnlock()
→ activeTab = "questionnaire"
→ Overview + Process = clickable (back), Chat still locked

Client fills all 6 questions, clicks Submit
→ handleChatUnlock() called
→ activeTab = "chat"
→ All 4 tabs now fully accessible

Client clicks Overview to re-read something
→ activeTab = "overview"
→ Process, Questionnaire, Chat = LOCKED again in sidebar

Client clicks Process (locked — can't do it)
→ Must click "Start Process" button in Overview content
→ Goes to Process, then Q, then Chat step by step again
```

---

*This file is the source of truth for portal navigation architecture.*
*Do not deviate from it without updating this document.*
