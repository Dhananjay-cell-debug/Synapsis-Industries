"use client";

import { useEffect, useRef } from "react";

/**
 * SynapsisHomepage
 * 7-section atelier design imported from Claude Design bundle (Synapsis Homepage.html).
 * Sections 03–09: Manifesto, Services, Method, Selected Work, Studio, Field Notes, Begin.
 * All CSS scoped under `.syn-home` so it does not bleed into the rest of the site.
 */
export default function SynapsisHomepage() {
    const blankRef = useRef<HTMLSpanElement>(null);

    // "Begin" section typewriter — cycles through fill-in-the-blank words
    useEffect(() => {
        const el = blankRef.current;
        if (!el) return;
        const words = ["under-spec'd", "too quiet", "almost there", "still on paper", "firing wrong"];
        let wi = 0, ci = 0, deleting = false, alive = true;
        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            if (!alive) return;
            const w = words[wi];
            if (!deleting) {
                el.textContent = w.slice(0, ci++);
                if (ci > w.length) { deleting = true; timer = setTimeout(tick, 1800); return; }
            } else {
                el.textContent = w.slice(0, ci--);
                if (ci < 0) { deleting = false; wi = (wi + 1) % words.length; }
            }
            timer = setTimeout(tick, deleting ? 40 : 90);
        };
        tick();
        return () => { alive = false; clearTimeout(timer); };
    }, []);

    // Reveal-on-view for .reveal elements
    useEffect(() => {
        const ro = new IntersectionObserver(
            (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }),
            { threshold: 0.15 }
        );
        document.querySelectorAll(".syn-home .reveal").forEach((el) => ro.observe(el));
        return () => ro.disconnect();
    }, []);

    return (
        <div className="syn-home">
            <style>{SYN_HOME_CSS}</style>

            {/* ===== SECTION 03 / MANIFESTO ===== */}
            <section id="s03" data-section="03">
                <div className="manifesto-wrap">
                    <div className="manifesto-head">
                        <div>
                            <div className="section-num">03 / Manifesto</div>
                            <div className="phase-chip reveal"><span className="phase-chip-dot" />POST-DESCENT · ABOVE GROUND</div>
                            <h1 className="manifesto-statement reveal" style={{ marginTop: 32 }}>
                                We build the <em>thinking layer</em><br />
                                of modern software.
                            </h1>
                        </div>
                        <div className="manifesto-side reveal">
                            Synapsis is a small atelier of engineers, designers, and voice-systems specialists. We take the part of your product that needs to <em>reason</em>, <em>listen</em>, or <em>respond</em> — and we ship it into production.
                        </div>
                    </div>

                    <div className="manifesto-grid">
                        {MANIFESTO_CARDS.map((c) => (
                            <div className="manifesto-card reveal" key={c.n}>
                                <div className="manifesto-card-num">{`// ${c.n} · Belief`}</div>
                                <div className="manifesto-card-title">{c.title}</div>
                                <div className="manifesto-card-body">{c.body}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== SECTION 04 / SERVICES ===== */}
            <section id="s04" data-section="04">
                <div className="head-band">
                    <div>
                        <div className="section-num">04 / Services</div>
                        <div className="phase-chip reveal"><span className="phase-chip-dot" />PHASE / SERVICES</div>
                        <h2 className="head-title reveal">Eleven disciplines.<br /><em>One ledger.</em></h2>
                    </div>
                    <div className="head-meta reveal">
                        <div className="head-meta-row">
                            <div className="head-meta-key">[ Format ]</div>
                            <div className="head-meta-val">Each line item is a fully scoped capability — quoted, staffed, and delivered as a unit.</div>
                        </div>
                        <div className="head-meta-row">
                            <div className="head-meta-key">[ Bundling ]</div>
                            <div className="head-meta-val">Pick one. Or hand us the whole stack and we run it as a single engagement.</div>
                        </div>
                    </div>
                </div>

                <div className="ledger">
                    <div className="ledger-header">
                        <div>No.</div><div>Discipline</div><div>Stack</div><div>Typical Range</div><div />
                    </div>
                    {SERVICES.map((s) => (
                        <a className="ledger-row" data-hover key={s.no}>
                            <div className="ledger-num">{s.no}</div>
                            <div>
                                <div className="ledger-name">{s.name}</div>
                                <div className="ledger-blurb">{s.blurb}</div>
                            </div>
                            <div className="ledger-tags">{s.stack.map((t) => <span className="ledger-tag" key={t}>{t}</span>)}</div>
                            <div className="ledger-stat">{s.range}<span className="unit">{s.unit}</span></div>
                            <div className="ledger-arrow">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7H11M7 3L11 7L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                        </a>
                    ))}
                </div>

                <div className="bundle">
                    <div className="bundle-text">
                        Or bundle the whole stack into a single engagement — <em>one team, one workspace, one weekly demo</em> until it's live.
                    </div>
                    <a className="bracket-btn" data-hover href="#s09">Scope an engagement</a>
                </div>
            </section>

            {/* ===== SECTION 05 / METHOD ===== */}
            <section id="s05" data-section="05">
                <div className="method-wrap">
                    <div className="method-head">
                        <div className="section-num">05 / Method</div>
                        <div className="phase-chip reveal" style={{ marginBottom: 24 }}><span className="phase-chip-dot" />HOW WE WORK</div>
                        <h2 className="head-title reveal" style={{ marginTop: 0 }}>Seven phases.<br /><em>One continuous arc.</em></h2>
                    </div>

                    <div className="method-track">
                        <div className="method-phases">
                            {METHOD_PHASES.map((p) => (
                                <div className="method-phase" key={p.num}>
                                    <div className="method-phase-num"><em>{p.num}</em></div>
                                    <div className="method-phase-node" />
                                    <div className="method-phase-title">{p.title}</div>
                                    <div className="method-phase-dur">{p.dur}</div>
                                    <div className="method-phase-body">{p.body}</div>
                                    <div className="method-phase-deliv">
                                        <div className="method-phase-deliv-label">[ Deliverable ]</div>
                                        <div className="method-phase-deliv-list">{p.deliv}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== SECTION 06 / SELECTED WORK ===== */}
            <section id="s06" data-section="06">
                <div className="work-wrap">
                    <div className="section-num">06 / Selected Work</div>
                    <div className="phase-chip reveal" style={{ marginBottom: 24 }}><span className="phase-chip-dot" />OUTCOMES — NOT SLIDEWARE</div>
                    <h2 className="head-title reveal" style={{ marginTop: 0 }}>Things we've <em>shipped.</em></h2>

                    <div className="work-grid">
                        <div className="work-index">
                            <div className="work-index-label">[ Index ]</div>
                            {WORK_INDEX.map((w, i) => (
                                <div className={`work-index-item${i === 0 ? " active" : ""}`} data-hover key={w.name}>
                                    <span>{w.name}</span><span className="num">{w.year}</span>
                                </div>
                            ))}
                        </div>

                        <div className="work-feature">
                            <div>
                                <div className="work-feature-tag">{"// FEATURED · FINTECH UNDERWRITING"}</div>
                                <h3 className="work-feature-title">An autonomous underwriting <em>agent</em> that closes most of the queue before lunch.</h3>
                            </div>
                            <div className="work-feature-image">
                                <div className="work-image-tag">CASE / ASTRYX</div>
                                <div className="work-image-meta">73%<span className="sub">AUTO-APPROVED</span></div>
                            </div>
                            <div className="work-feature-quote">
                                They embedded with our credit team for six weeks. By the end, the agent was making cleaner decisions than half our analysts.
                                <div className="work-feature-attrib">— PRIYA MEHTA · VP CREDIT · ASTRYX CAPITAL</div>
                            </div>
                        </div>

                        <div className="work-metrics">
                            <div className="work-index-label">[ Live metrics ]</div>
                            <div className="work-metric"><div className="work-metric-num"><em>73</em>%</div><div className="work-metric-label">Auto-approved</div></div>
                            <div className="work-metric"><div className="work-metric-num">90s</div><div className="work-metric-label">Avg decision time</div></div>
                            <div className="work-metric"><div className="work-metric-num"><em>$1.4</em>M</div><div className="work-metric-label">Annual savings</div></div>
                            <div className="work-metric"><div className="work-metric-num">41%</div><div className="work-metric-label">Less paperwork</div></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== SECTION 07 / STUDIO ===== */}
            <section id="s07" data-section="07">
                <div className="studio-wrap">
                    <div className="section-num">07 / Studio</div>
                    <div className="phase-chip reveal" style={{ marginBottom: 24 }}><span className="phase-chip-dot" />WHO WE ARE</div>
                    <h2 className="head-title reveal" style={{ marginTop: 0, marginBottom: 60 }}>A studio, not an <em>agency.</em></h2>

                    <div className="studio-top">
                        <div className="studio-portrait">
                            <div className="studio-portrait-name">Dhananjay C.</div>
                            <div className="studio-portrait-label">{"// FOUNDER · IST"}</div>
                        </div>
                        <div>
                            <div className="studio-voice">
                                &quot;I started Synapsis because most AI projects die in the gap between <em>research</em> and <em>production</em>. We close that gap by treating shipping as the deliverable — not the demo.&quot;
                            </div>
                            <div className="studio-sign">— SIGNED, THE STUDIO · MMXXVI</div>
                        </div>
                    </div>

                    <div className="studio-credits">
                        <div className="studio-credits-label">[ The team · in credits-roll order ]</div>
                        <div className="studio-credits-roll">
                            {CREDITS.map((c) => (
                                <div className="studio-credit" key={c.name}>
                                    <div className="studio-credit-init">{c.init}</div>
                                    <div className="studio-credit-meta">
                                        <div className="studio-credit-name">{c.name}</div>
                                        <div className="studio-credit-role">{c.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== SECTION 08 / FIELD NOTES ===== */}
            <section id="s08" data-section="08">
                <div className="notes-wrap">
                    <div className="notes-head">
                        <div>
                            <div className="section-num">08 / Field Notes</div>
                            <div className="phase-chip reveal" style={{ marginBottom: 24 }}><span className="phase-chip-dot" />WRITING FROM THE STUDIO</div>
                            <h2 className="head-title reveal" style={{ marginTop: 0 }}>What we&apos;re <em>learning</em>,<br />filed openly.</h2>
                        </div>
                        <a className="bracket-btn" data-hover href="#">All field notes</a>
                    </div>

                    <div className="notes-list">
                        {NOTES.map((n) => (
                            <a className="note-row" data-hover key={n.no}>
                                <div className="note-no">{n.no}</div>
                                <div className="note-date">{n.date}</div>
                                <div className="note-title">{n.title}</div>
                                <div className="note-time">{n.time}</div>
                                <div className="note-arrow">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6H9M6 3L9 6L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== SECTION 09 / BEGIN / CONTACT ===== */}
            <section id="s09" className="dark-section" data-section="09">
                <div className="begin-wrap">
                    <div className="section-num" style={{ color: "rgba(255,255,255,.5)" }}>09 / Begin</div>
                    <div className="phase-chip reveal" style={{ marginBottom: 24, color: "#fff", borderColor: "rgba(255,255,255,.25)" }}><span className="phase-chip-dot" />READY WHEN YOU ARE</div>
                    <h2 className="begin-statement reveal">
                        Bring us what&apos;s <em>broken</em>,<br />
                        <em>half-built</em>, or<br />
                        <span className="begin-blank" ref={blankRef} />
                    </h2>

                    <div className="contact-ledger">
                        <div className="contact-row">
                            <div className="contact-label">{"// EMAIL"}</div>
                            <div className="contact-val"><a href="mailto:dhananjaychitmillabusiness@gmail.com">dhananjaychitmillabusiness<br />@gmail.com</a></div>
                        </div>
                        <div className="contact-row">
                            <div className="contact-label">{"// BOOK A CALL"}</div>
                            <div className="contact-val"><a href="#">cal.com/synapsis<br />→ 30 min · IST</a></div>
                        </div>
                        <div className="contact-row">
                            <div className="contact-label">{"// STUDIO"}</div>
                            <div className="contact-val">Hyderabad · India<br />Operating IST 09:00–22:00</div>
                        </div>
                    </div>

                    <div className="begin-cta-row">
                        <div className="begin-aside">Send a brief — we respond within two business days with honest thoughts and whether we&apos;re the right team for it.</div>
                        <button className="begin-cta" data-hover>Begin a project →</button>
                    </div>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="syn-foot">
                <div className="foot-wrap">
                    <div>
                        <svg width="34" height="34" viewBox="8 8 104 104" fill="none">
                            <circle cx="20" cy="20" r="4" fill="#fff" opacity=".3" /><circle cx="20" cy="60" r="4" fill="#fff" opacity=".3" /><circle cx="20" cy="100" r="4" fill="#fff" opacity=".3" />
                            <circle cx="60" cy="20" r="4" fill="#fff" opacity=".3" /><circle cx="60" cy="60" r="4" fill="#fff" opacity=".3" /><circle cx="60" cy="100" r="4" fill="#fff" opacity=".3" />
                            <circle cx="100" cy="20" r="4" fill="#fff" opacity=".3" /><circle cx="100" cy="60" r="4" fill="#fff" opacity=".3" /><circle cx="100" cy="100" r="4" fill="#fff" opacity=".3" />
                            <path d="M 100 20 L 60 20 L 60 60 L 100 60 L 100 100 L 20 100" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
                            <circle cx="100" cy="20" r="6" fill="#5B8AFF" /><circle cx="60" cy="20" r="6" fill="#5B8AFF" /><circle cx="60" cy="60" r="6" fill="#5B8AFF" />
                            <circle cx="100" cy="60" r="6" fill="#5B8AFF" /><circle cx="100" cy="100" r="6" fill="#5B8AFF" /><circle cx="20" cy="100" r="6" fill="#5B8AFF" />
                        </svg>
                        <div className="foot-brand-text">An atelier of engineers, designers, and voice-systems specialists. Hyderabad / online / on-site.</div>
                    </div>
                    <div className="foot-col">
                        <div className="foot-col-label">{"// Studio"}</div>
                        <ul><li><a href="#s04">Services</a></li><li><a href="#s05">Method</a></li><li><a href="#s06">Work</a></li><li><a href="#s07">Team</a></li></ul>
                    </div>
                    <div className="foot-col">
                        <div className="foot-col-label">{"// Resources"}</div>
                        <ul><li><a href="#s08">Field Notes</a></li><li><a href="#">Brand kit</a></li><li><a href="#">Open positions</a></li></ul>
                    </div>
                    <div className="foot-col">
                        <div className="foot-col-label">{"// Reach"}</div>
                        <ul><li><a href="mailto:dhananjaychitmillabusiness@gmail.com">Email</a></li><li><a href="#">LinkedIn</a></li><li><a href="#">GitHub</a></li></ul>
                    </div>
                </div>
                <div className="foot-bottom">
                    <span>© MMXXVI · Synapsis Industries · Hyderabad IST</span>
                    <a href="#s03" className="foot-return" data-hover>↑ Return to the descent</a>
                </div>
            </footer>
        </div>
    );
}

/* ─────────── DATA ─────────── */

const MANIFESTO_CARDS = [
    { n: "01", title: "Production over prototype.", body: "Most AI work dies on the demo. We measure success in uptime, not slideware." },
    { n: "02", title: "Interfaces still matter.", body: "A great agent behind a bad UI is invisible. We design the surface as carefully as the model." },
    { n: "03", title: "Small teams, full stack.", body: "One pod owns the entire arc — research, infra, frontend, voice. No handoffs that lose context." },
    { n: "04", title: "We stay long enough to see the metrics move.", body: "Not a deck-and-disappear studio. We pair, ship, and operate alongside your team." },
];

const SERVICES = [
    { no: "01", name: "Frontend Design & Build", blurb: "Interfaces that earn the first thirty seconds — and keep them.", stack: ["React", "Next", "Tailwind"], range: "2–6", unit: "weeks" },
    { no: "02", name: "Full-Stack Web", blurb: "Marketing site to admin panel — the whole envelope, one team.", stack: ["Node", "Postgres", "tRPC"], range: "4–12", unit: "weeks" },
    { no: "03", name: "Android Applications", blurb: "Native apps with the polish of design-led desktop software.", stack: ["Kotlin", "Compose"], range: "6–14", unit: "weeks" },
    { no: "04", name: "System Architecture", blurb: "The drawings that prevent the rewrite three years from now.", stack: ["AWS", "GCP", "k8s"], range: "1–3", unit: "weeks" },
    { no: "05", name: "Backend & Infrastructure", blurb: "APIs that scale quietly. Databases that don't lie. Logs you can search.", stack: ["Go", "Python", "Postgres"], range: "3–10", unit: "weeks" },
    { no: "06", name: "Payment Integration", blurb: "Subscriptions, split payouts, reconciliation — and the math behind them.", stack: ["Stripe", "Razorpay"], range: "5–15", unit: "days" },
    { no: "07", name: "Identity & Google Auth", blurb: "OAuth, SSO, role-based access — set up once, audited forever.", stack: ["OAuth", "Clerk", "Auth0"], range: "3–10", unit: "days" },
    { no: "08", name: "AI Voice Agents", blurb: "Callers who don't sound robotic — and answer at 3am without complaint.", stack: ["Retell", "11Labs", "Vapi"], range: "2–6", unit: "weeks" },
    { no: "09", name: "AI Integration", blurb: "LLMs threaded into the parts of your product that need to think.", stack: ["OpenAI", "Claude", "RAG"], range: "2–8", unit: "weeks" },
    { no: "10", name: "Voice Automation", blurb: "Inbound, outbound, IVR replacements — at human latency, with transcripts.", stack: ["Twilio", "LiveKit"], range: "3–8", unit: "weeks" },
    { no: "11", name: "Automated Workflows", blurb: "The boring 90% of operations — handed off to code that doesn't sleep.", stack: ["n8n", "Temporal", "Zapier"], range: "1–4", unit: "weeks" },
];

const METHOD_PHASES = [
    { num: "01", title: "Discover", dur: "// PHASE 1", body: "Detailed pain-mapping. We audit your stack and current friction points to reveal the real business problem, not just the stated one.", deliv: "Discovery Questionnaire + Full Journey Map" },
    { num: "02", title: "Blueprint", dur: "// PHASE 2", body: "A technical manifesto. We define the solution architecture, tech stack rationale, and a precise investment breakdown.", deliv: "System Design Document + Scope Definition" },
    { num: "03", title: "Ignition", dur: "// PHASE 3", body: "The hard gate. Advance payment triggers the full project workspace, locking in timelines and activating our build team.", deliv: "Project Kickoff + Asset Collection" },
    { num: "04", title: "Build", dur: "// PHASE 4", body: "Weekly sprint cycles. Friday reports, change orders, and staging links keep you in the loop while we build your system layer by layer.", deliv: "Staging URL + Weekly Sprint Reports" },
    { num: "05", title: "Deliver", dur: "// PHASE 5", body: "Final review period. Revisions are tracked and finalized until the build passes our internal evals and your standards.", deliv: "Production-ready Build + Revision Logs" },
    { num: "06", title: "Handover", dur: "// PHASE 6", body: "The clean transition. Final payment triggers deployment, credential handover, and a 30-day bug support window.", deliv: "Access Credentials + Architecture Overview" },
    { num: "07", title: "Orbit", dur: "// PHASE 7", body: "Indefinite partnership. Quarterly reviews and referral benefits ensure your system grows as your business scales.", deliv: "Maintenance Retainer + Performance Reports" },
];

const WORK_INDEX = [
    { name: "Astryx Capital", year: "2024" },
    { name: "Parallel Logistics", year: "2024" },
    { name: "Meridian Health", year: "2023" },
    { name: "Kestrel Retail", year: "2023" },
    { name: "Forge Industrial", year: "2023" },
    { name: "Orbit Markets", year: "2022" },
];

const CREDITS = [
    { init: "D", name: "Dhananjay Chitmilla", role: "Founder / Systems" },
    { init: "A", name: "Aarav K.", role: "Engineering Lead" },
    { init: "S", name: "Saanvi R.", role: "Design" },
    { init: "V", name: "Vikram P.", role: "AI / Voice" },
    { init: "N", name: "Neha B.", role: "Infrastructure" },
    { init: "K", name: "Kabir M.", role: "Frontend" },
    { init: "I", name: "Isha T.", role: "Product" },
    { init: "R", name: "Rohan S.", role: "Operations" },
    { init: "M", name: "Maya G.", role: "Strategy" },
    { init: "+", name: "Open seat", role: "Hiring · 2026" },
];

const NOTES = [
    { no: "N° 014", date: "11.05.2026", title: "Why your voice agent sounds robotic — and the latency budget that fixes it.", time: "8 min" },
    { no: "N° 013", date: "04.28.2026", title: "The case for evaluating LLM apps the way we used to evaluate databases.", time: "12 min" },
    { no: "N° 012", date: "03.19.2026", title: "Field report: six months of running an underwriting agent in production.", time: "15 min" },
    { no: "N° 011", date: "02.04.2026", title: "Designing the seam between a copilot and the human still doing the work.", time: "6 min" },
    { no: "N° 010", date: "12.22.2025", title: "A taxonomy of bad AI demos — and what shipping ones get right.", time: "9 min" },
];

/* ─────────── SCOPED CSS (all selectors prefixed with .syn-home) ─────────── */

const SYN_HOME_CSS = `
.syn-home{
  --cream:#FAF9F6;--cream-deep:#F2EFE7;--ink:#0A1530;--blue:#3B6AE8;
  --amber:#F5C16C;--line:rgba(10,21,48,.10);--line-strong:rgba(10,21,48,.22);
  background:var(--cream);color:var(--ink);font-family:'Inter',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;position:relative;
}
.syn-home *{box-sizing:border-box}
.syn-home .serif{font-family:'Fraunces',Georgia,serif}
.syn-home .mono{font-family:'JetBrains Mono',monospace}

.syn-home section{min-height:100vh;padding:130px 0 100px;position:relative;background:var(--cream)}
.syn-home #s05{background:var(--cream-deep)}
.syn-home #s07{background:var(--cream-deep)}
.syn-home #s06,.syn-home #s08,.syn-home #s04,.syn-home #s03{background:var(--cream)}
.syn-home #s09{background:var(--ink);color:var(--cream);min-height:100vh}

.syn-home .phase-chip{display:inline-flex;align-items:center;gap:10px;border:1px solid var(--line-strong);padding:6px 14px 6px 8px;border-radius:100px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase}
.syn-home .phase-chip-dot{width:8px;height:8px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 3px rgba(59,106,232,.18)}

.syn-home .bracket-btn{display:inline-flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);background:transparent;border:1px solid var(--ink);padding:14px 22px;cursor:pointer;text-decoration:none;position:relative;transition:color .2s,background .2s;white-space:nowrap}
.syn-home .bracket-btn::before{content:'[';opacity:.4;margin-right:2px}
.syn-home .bracket-btn::after{content:']';opacity:.4;margin-left:2px}
.syn-home .bracket-btn:hover{background:var(--ink);color:var(--cream)}
.syn-home .bracket-btn:hover::before,.syn-home .bracket-btn:hover::after{opacity:1}

/* SECTION 03 */
.syn-home #s03{padding-top:200px}
.syn-home .manifesto-wrap{padding:0 80px;max-width:1500px;margin:0 auto}
.syn-home .manifesto-head{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-bottom:120px;align-items:end}
.syn-home .section-num{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.28em;opacity:.5;text-transform:uppercase;margin-bottom:18px}
.syn-home .manifesto-statement{font-family:'Fraunces',serif;font-size:120px;line-height:.95;letter-spacing:-.035em;font-weight:400;text-wrap:balance}
.syn-home .manifesto-statement em{font-style:italic;color:var(--blue)}
.syn-home .manifesto-side{font-family:'Fraunces',serif;font-size:22px;line-height:1.45;letter-spacing:-.01em;color:var(--ink);opacity:.8;max-width:480px;padding-bottom:30px;border-bottom:1px solid var(--line-strong)}
.syn-home .manifesto-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:40px;margin-top:80px}
.syn-home .manifesto-card{border-top:1px solid var(--ink);padding-top:24px}
.syn-home .manifesto-card-num{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.5;margin-bottom:14px}
.syn-home .manifesto-card-title{font-family:'Fraunces',serif;font-size:24px;line-height:1.15;letter-spacing:-.015em;margin-bottom:12px;font-weight:500}
.syn-home .manifesto-card-body{font-size:13.5px;line-height:1.6;opacity:.75}

/* SECTION 04 */
.syn-home .head-band{padding:0 80px;display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-bottom:80px;max-width:1500px;margin-left:auto;margin-right:auto}
.syn-home .head-title{margin-top:26px;font-family:'Fraunces',serif;font-size:84px;line-height:.95;letter-spacing:-.03em;font-weight:400}
.syn-home .head-title em{font-style:italic;color:var(--blue)}
.syn-home .head-meta{align-self:end;display:flex;flex-direction:column;gap:20px}
.syn-home .head-meta-row{display:flex;gap:24px;border-top:1px solid var(--line-strong);padding-top:14px}
.syn-home .head-meta-key{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.5;min-width:90px}
.syn-home .head-meta-val{font-family:'Fraunces',serif;font-size:18px;line-height:1.4;flex:1}

.syn-home .ledger{padding:0 80px;max-width:1500px;margin:0 auto}
.syn-home .ledger-header{display:grid;grid-template-columns:56px 1fr 200px 180px 60px;gap:32px;padding:14px 0;border-bottom:1px solid var(--ink);font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.55}
.syn-home .ledger-row{display:grid;grid-template-columns:56px 1fr 200px 180px 60px;gap:32px;align-items:center;padding:30px 0;border-bottom:1px solid var(--line);position:relative;cursor:pointer;transition:padding .45s cubic-bezier(.16,1,.3,1);text-decoration:none;color:inherit}
.syn-home .ledger-row::before{content:'';position:absolute;left:-80px;right:-80px;top:0;bottom:0;background:var(--cream-deep);opacity:0;z-index:-1;transition:opacity .45s cubic-bezier(.16,1,.3,1)}
.syn-home .ledger-row:hover{padding:38px 0}
.syn-home .ledger-row:hover::before{opacity:1}
.syn-home .ledger-row:hover .ledger-name{color:var(--blue);transform:translateX(8px)}
.syn-home .ledger-row:hover .ledger-arrow{opacity:1;transform:translateX(0);background:var(--blue);border-color:var(--blue);color:var(--cream)}
.syn-home .ledger-num{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.1em;opacity:.5;font-weight:500}
.syn-home .ledger-name{font-family:'Fraunces',serif;font-size:42px;line-height:1.05;letter-spacing:-.022em;font-weight:400;transition:color .35s,transform .45s cubic-bezier(.16,1,.3,1)}
.syn-home .ledger-blurb{font-family:'Fraunces',serif;font-style:italic;font-size:17px;line-height:1.4;color:var(--ink);opacity:0;max-height:0;overflow:hidden;transition:opacity .5s cubic-bezier(.16,1,.3,1),max-height .5s cubic-bezier(.16,1,.3,1),margin-top .5s;margin-top:0;max-width:600px}
.syn-home .ledger-row:hover .ledger-blurb{opacity:.75;max-height:60px;margin-top:10px}
.syn-home .ledger-tags{display:flex;flex-wrap:wrap;gap:6px}
.syn-home .ledger-tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;padding:4px 9px;border:1px solid var(--line-strong);border-radius:100px;opacity:.75}
.syn-home .ledger-stat{font-family:'Fraunces',serif;font-size:28px;letter-spacing:-.02em;color:var(--ink);font-weight:500}
.syn-home .ledger-stat .unit{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.45;margin-left:6px;font-weight:400}
.syn-home .ledger-arrow{width:44px;height:44px;border:1px solid var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:.25;transform:translateX(-6px);transition:opacity .35s,transform .45s cubic-bezier(.16,1,.3,1),background .25s,border-color .25s}

.syn-home .bundle{margin:120px auto 0;max-width:1340px;padding:40px 48px;border:1px solid var(--ink);display:flex;align-items:center;justify-content:space-between;gap:40px;background:var(--cream);position:relative}
.syn-home .bundle::before,.syn-home .bundle::after{content:'';position:absolute;width:12px;height:12px;border:1px solid var(--ink);background:var(--cream)}
.syn-home .bundle::before{top:-7px;left:-7px}.syn-home .bundle::after{bottom:-7px;right:-7px}
.syn-home .bundle-text{font-family:'Fraunces',serif;font-size:28px;line-height:1.25;letter-spacing:-.015em;max-width:700px}
.syn-home .bundle-text em{color:var(--blue);font-style:italic}

/* SECTION 05 */
.syn-home .method-wrap{padding:0 80px;max-width:1500px;margin:0 auto}
.syn-home .method-head{margin-bottom:80px}
.syn-home .method-track{position:relative;padding:60px 0 80px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;}
.syn-home .method-track::-webkit-scrollbar{display:none}
.syn-home .method-track::before{content:'';position:absolute;top:130px;left:0;right:0;height:1px;background:var(--line-strong)}
.syn-home .method-phases{display:flex;gap:0;min-width:max-content;padding-bottom:20px}
.syn-home .method-phase{width:360px;padding:0 40px;position:relative;border-left:1px dashed var(--line)}
.syn-home .method-phase:first-child{padding-left:0;border-left:none}
.syn-home .method-phase-num{font-family:'Fraunces',serif;font-size:90px;line-height:1;letter-spacing:-.03em;color:var(--ink);font-weight:400;margin-bottom:32px;position:relative}
.syn-home .method-phase-num em{font-style:italic;color:var(--blue)}
.syn-home .method-phase-node{position:absolute;left:-7px;top:70px;width:14px;height:14px;background:var(--cream-deep);border:2px solid var(--ink);border-radius:50%;z-index:2}
.syn-home .method-phase:first-child .method-phase-node{left:-7px}
.syn-home .method-phase-title{font-family:'Fraunces',serif;font-size:30px;line-height:1.1;letter-spacing:-.02em;font-weight:500;margin-bottom:14px}
.syn-home .method-phase-dur{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;opacity:.5;margin-bottom:18px}
.syn-home .method-phase-body{font-size:13.5px;line-height:1.65;opacity:.75;margin-bottom:24px}
.syn-home .method-phase-deliv{border-top:1px solid var(--line);padding-top:14px}
.syn-home .method-phase-deliv-label{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;opacity:.5;margin-bottom:8px}
.syn-home .method-phase-deliv-list{font-family:'Fraunces',serif;font-size:14px;line-height:1.5;font-style:italic}

/* SECTION 06 */
.syn-home .work-wrap{padding:0 80px;max-width:1500px;margin:0 auto}
.syn-home .work-grid{display:grid;grid-template-columns:200px 1fr 220px;gap:80px;margin-top:60px}
.syn-home .work-index{border-top:1px solid var(--ink);padding-top:14px}
.syn-home .work-index-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.5;margin-bottom:18px}
.syn-home .work-index-item{padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-family:'Fraunces',serif;font-size:15px;letter-spacing:-.01em;transition:color .2s,padding .3s}
.syn-home .work-index-item:hover{color:var(--blue);padding-left:6px}
.syn-home .work-index-item.active{color:var(--blue);padding-left:6px}
.syn-home .work-index-item .num{font-family:'JetBrains Mono',monospace;font-size:10px;opacity:.4}
.syn-home .work-feature{display:flex;flex-direction:column;gap:32px}
.syn-home .work-feature-tag{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.5}
.syn-home .work-feature-title{font-family:'Fraunces',serif;font-size:64px;line-height:1.02;letter-spacing:-.025em;font-weight:400}
.syn-home .work-feature-title em{font-style:italic;color:var(--blue)}
.syn-home .work-feature-image{aspect-ratio:16/10;border:1px solid var(--line-strong);background:linear-gradient(135deg,#1a2548 0%,#0A1530 60%,#050814 100%);position:relative;overflow:hidden}
.syn-home .work-feature-image::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 1px 1px,rgba(91,138,255,.6) 1.5px,transparent 0);background-size:28px 28px;opacity:.35}
.syn-home .work-feature-image::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#5B8AFF,transparent 70%);filter:blur(20px);opacity:.6}
.syn-home .work-image-tag{position:absolute;top:18px;left:18px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.7);z-index:2}
.syn-home .work-image-meta{position:absolute;bottom:18px;right:18px;font-family:'Fraunces',serif;font-size:38px;color:#fff;letter-spacing:-.02em;z-index:2}
.syn-home .work-image-meta .sub{display:block;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.22em;opacity:.6;text-transform:uppercase;text-align:right}
.syn-home .work-feature-quote{font-family:'Fraunces',serif;font-style:italic;font-size:24px;line-height:1.4;letter-spacing:-.01em;padding-left:24px;border-left:2px solid var(--blue);max-width:680px}
.syn-home .work-feature-attrib{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.55;margin-top:14px;padding-left:0}
.syn-home .work-metrics{border-top:1px solid var(--ink);padding-top:14px}
.syn-home .work-metric{padding:18px 0;border-bottom:1px solid var(--line)}
.syn-home .work-metric-num{font-family:'Fraunces',serif;font-size:38px;line-height:1;letter-spacing:-.025em;font-weight:500}
.syn-home .work-metric-num em{color:var(--blue);font-style:italic}
.syn-home .work-metric-label{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;opacity:.55;margin-top:6px}

/* SECTION 07 */
.syn-home .studio-wrap{padding:0 80px;max-width:1500px;margin:0 auto}
.syn-home .studio-top{display:grid;grid-template-columns:380px 1fr;gap:80px;margin-bottom:100px;align-items:center}
.syn-home .studio-portrait{aspect-ratio:4/5;background:linear-gradient(180deg,#1a2548 0%,#0A1530 100%);position:relative;overflow:hidden;border:1px solid var(--ink)}
.syn-home .studio-portrait::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 1px 1px,rgba(91,138,255,.4) 1.5px,transparent 0);background-size:24px 24px;opacity:.4}
.syn-home .studio-portrait-label{position:absolute;bottom:18px;left:18px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75);z-index:2}
.syn-home .studio-portrait-name{position:absolute;top:18px;left:18px;font-family:'Fraunces',serif;font-style:italic;font-size:22px;color:#fff;z-index:2}
.syn-home .studio-voice{font-family:'Fraunces',serif;font-size:46px;line-height:1.15;letter-spacing:-.022em;font-weight:400;text-wrap:balance}
.syn-home .studio-voice em{font-style:italic;color:var(--blue)}
.syn-home .studio-sign{margin-top:32px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.55}
.syn-home .studio-credits{border-top:1px solid var(--ink);padding-top:28px}
.syn-home .studio-credits-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.5;margin-bottom:24px}
.syn-home .studio-credits-roll{display:grid;grid-template-columns:repeat(5,1fr);gap:14px 40px}
.syn-home .studio-credit{display:flex;align-items:baseline;gap:14px;padding:14px 0;border-top:1px solid var(--line)}
.syn-home .studio-credit-init{font-family:'Fraunces',serif;font-size:34px;line-height:1;letter-spacing:-.02em;font-weight:500;color:var(--blue);min-width:50px}
.syn-home .studio-credit-meta{flex:1}
.syn-home .studio-credit-name{font-family:'Fraunces',serif;font-size:14px;line-height:1.2;font-weight:500}
.syn-home .studio-credit-role{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;margin-top:4px}

/* SECTION 08 */
.syn-home .notes-wrap{padding:0 80px;max-width:1500px;margin:0 auto}
.syn-home .notes-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:60px;gap:60px}
.syn-home .notes-list{border-top:1px solid var(--ink)}
.syn-home .note-row{display:grid;grid-template-columns:80px 130px 1fr 100px 60px;gap:32px;align-items:center;padding:24px 0;border-bottom:1px solid var(--line);cursor:pointer;transition:padding .35s cubic-bezier(.16,1,.3,1);text-decoration:none;color:inherit}
.syn-home .note-row:hover{padding:32px 0}
.syn-home .note-row:hover .note-title{color:var(--blue);transform:translateX(6px)}
.syn-home .note-row:hover .note-arrow{opacity:1;transform:translateX(0)}
.syn-home .note-no{font-family:'JetBrains Mono',monospace;font-size:10px;opacity:.5;letter-spacing:.1em}
.syn-home .note-date{font-family:'JetBrains Mono',monospace;font-size:11px;opacity:.65;letter-spacing:.06em}
.syn-home .note-title{font-family:'Fraunces',serif;font-size:26px;line-height:1.15;letter-spacing:-.018em;font-weight:400;transition:color .3s,transform .4s cubic-bezier(.16,1,.3,1)}
.syn-home .note-time{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;text-align:right}
.syn-home .note-arrow{width:36px;height:36px;border:1px solid var(--ink);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:.25;transform:translateX(-6px);transition:opacity .3s,transform .4s cubic-bezier(.16,1,.3,1)}

/* SECTION 09 */
.syn-home #s09 .phase-chip{border-color:rgba(255,255,255,.25);color:#fff}
.syn-home #s09 .section-num{color:rgba(255,255,255,.6)}
.syn-home .begin-wrap{padding:0 80px;max-width:1500px;margin:0 auto}
.syn-home .begin-statement{font-family:'Fraunces',serif;font-size:140px;line-height:.95;letter-spacing:-.035em;font-weight:400;text-wrap:balance;color:#fff;margin:60px 0 80px}
.syn-home .begin-statement em{font-style:italic;color:#9DB5FF}
.syn-home .begin-blank{display:inline-block;border-bottom:2px solid #9DB5FF;min-width:300px;padding-bottom:8px;position:relative}
.syn-home .begin-blank::after{content:'|';color:#9DB5FF;animation:syn-cursor-blink 1.2s infinite}
@keyframes syn-cursor-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.syn-home .contact-ledger{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid rgba(255,255,255,.2);margin-top:60px}
.syn-home .contact-row{padding:30px 30px 30px 0;border-bottom:1px solid rgba(255,255,255,.1);position:relative}
.syn-home .contact-row:not(:last-child)::after{content:'';position:absolute;top:30px;bottom:30px;right:0;width:1px;background:rgba(255,255,255,.1)}
.syn-home .contact-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.5;margin-bottom:14px;color:#fff}
.syn-home .contact-val{font-family:'Fraunces',serif;font-size:22px;line-height:1.3;letter-spacing:-.015em;color:#fff}
.syn-home .contact-val a{color:inherit;text-decoration:none;border-bottom:1px solid transparent;transition:border-color .2s}
.syn-home .contact-val a:hover{border-color:#9DB5FF}
.syn-home .begin-cta-row{display:flex;align-items:center;justify-content:space-between;margin-top:80px;padding-top:40px;border-top:1px solid rgba(255,255,255,.15)}
.syn-home .begin-aside{font-family:'Fraunces',serif;font-style:italic;font-size:18px;opacity:.6;max-width:400px;line-height:1.45;color:#fff}
.syn-home .begin-cta{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink);background:#fff;border:none;padding:18px 32px;cursor:pointer}
.syn-home .begin-cta:hover{background:#9DB5FF;color:var(--ink)}

/* FOOTER */
.syn-home .syn-foot{background:var(--ink);color:#fff;padding:60px 80px 32px;border-top:1px solid rgba(255,255,255,.1)}
.syn-home .foot-wrap{max-width:1500px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:60px}
.syn-home .foot-brand-text{font-family:'Fraunces',serif;font-style:italic;font-size:16px;opacity:.65;line-height:1.5;margin-top:16px;max-width:280px}
.syn-home .foot-col-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.5;margin-bottom:18px}
.syn-home .foot-col ul{list-style:none;padding:0;margin:0}
.syn-home .foot-col li{padding:6px 0}
.syn-home .foot-col a{color:rgba(255,255,255,.75);text-decoration:none;font-size:13px}
.syn-home .foot-col a:hover{color:#9DB5FF}
.syn-home .foot-bottom{max-width:1500px;margin:60px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.5}
.syn-home .foot-return{color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.2);padding:10px 18px;cursor:pointer}
.syn-home .foot-return:hover{background:#fff;color:var(--ink)}

/* Reveal */
.syn-home .reveal{opacity:0;transform:translateY(30px);filter:blur(2px);transition:opacity 1.1s cubic-bezier(.16,1,.3,1),transform 1.1s cubic-bezier(.16,1,.3,1),filter 1.1s}
.syn-home .reveal.in{opacity:1;transform:none;filter:blur(0)}

/* Responsive */
@media(max-width:1100px){
  .syn-home .manifesto-statement{font-size:72px}
  .syn-home .head-title{font-size:54px}
  .syn-home .begin-statement{font-size:80px}
  .syn-home .manifesto-head,.syn-home .head-band,.syn-home .studio-top{grid-template-columns:1fr;gap:40px}
  .syn-home .manifesto-grid,.syn-home .method-phases{grid-template-columns:repeat(2,1fr);gap:32px}
  .syn-home .work-grid{grid-template-columns:1fr;gap:48px}
  .syn-home .studio-credits-roll,.syn-home .foot-wrap{grid-template-columns:repeat(2,1fr);gap:32px}
  .syn-home .contact-ledger{grid-template-columns:1fr}
  .syn-home .ledger-header,.syn-home .ledger-row{grid-template-columns:40px 1fr 80px 40px;gap:14px}
  .syn-home .ledger-tags{display:none}
  .syn-home .ledger-name{font-size:26px}
  .syn-home .manifesto-wrap,.syn-home .head-band,.syn-home .ledger,.syn-home .method-wrap,.syn-home .work-wrap,.syn-home .studio-wrap,.syn-home .notes-wrap,.syn-home .begin-wrap{padding:0 24px}
  .syn-home .syn-foot{padding:48px 24px 24px}
  .syn-home .begin-cta-row{flex-direction:column;align-items:flex-start;gap:24px}
}
`;
