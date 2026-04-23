# SYNAPSIS INDUSTRIES — SYSTEM ROADMAP
> Living document. Updated continuously as architecture evolves.
> Last updated: 2026-03-19

---

## THE CORE IDEA — THE MAGNUS CARLSON MOVE

Inspired by **Adobe Premiere Pro's Home Panel** — not the complexity inside, but the concept outside.

- Premiere Pro Home = you see all your projects as cards
- Click a project = entire workspace opens, dedicated to that project
- Close = back to home panel

**Applied here:**
- Home Panel = all clients visible as cards (Inbox)
- Click "Elect" on a client = dedicated workspace opens
- Admin workspace = 6 options
- Client workspace = 4 options
- Phase progression = LINEAR for client (forward only, no going back)
- Admin = God mode, can jump anywhere, any client, any phase

**The Anti-Premiere-Pro rule:**
Premiere Pro is cluttered inside. We do the opposite — max 4 buttons per phase for client. Zero confusion. Guided like a game level.

---

## THE TWO DASHBOARDS

### Admin Dashboard (Dhananjay)
- Sees ALL clients
- Sees ALL phases
- Can jump to any client, any phase
- 6 options per workspace
- Full control

### Client Dashboard
- Sees ONLY their project
- Sees ONLY their current phase
- Cannot go back to previous phases (locked)
- 4 options per phase
- 1 chat box always visible
- Feels like a structured game — "what's my next step?"

---

## THE ELECT BUTTON

When Dhananjay reviews a client from Inbox and clicks **ELECT**:
- Client's full workspace is created
- Phase 1 automatically activates
- Client receives access to their dashboard
- Admin's workspace for that client opens simultaneously
- The engagement officially begins

---

## WHAT'S BUILT SO FAR

- [x] Portfolio showcase (Work section)
- [x] Services section
- [x] Start a Project form (lead capture)
- [x] Inbox (Phase 0 — SIGNAL)
- [x] Admin Projects manager
- [x] Google Auth + role-based access (admin/visitor)
- [x] Email notification on form submit
- [x] File upload system (images/video for projects)

## WHAT'S NEXT

- [ ] ELECT button on inbox cards
- [ ] Phase 1 workspace (admin + client view)
- [ ] Home Panel redesign (Premier Pro style)
- [ ] Phase 2 — BLUEPRINT
- [ ] Phase 3 — IGNITION (payment gate)
- [ ] Phase 4 — BUILD (sprint updates, change requests)
- [ ] Phase 5 — DELIVER
- [ ] Phase 6 — HANDOVER
- [ ] Phase 7 — ORBIT (retainer, referrals)
- [ ] Supabase integration (persist data across sessions)
- [ ] Client portal (unique login per client)

---

## TECH STACK

- Next.js 14 App Router
- TypeScript
- Framer Motion
- NextAuth (Google OAuth)
- Tailwind CSS
- Nodemailer (email notifications)
- Supabase (planned — persistence)
- Vercel (deployment)

---

## NAMING / BRAND LANGUAGE

- Framework name: **The Vark Engagement Protocol**
- Process feel: Surgical. Inevitable. Premium.
- Client experience: Feels like a game. Structured. No confusion.
- Admin experience: God mode. Full visibility. Full control.
