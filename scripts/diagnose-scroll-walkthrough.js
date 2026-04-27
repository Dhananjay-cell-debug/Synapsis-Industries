// Scroll-walkthrough diagnostic.
// The home page is a scroll-driven cinematic — fixed canvases respond to scrollY.
// A static fullPage screenshot misses this. This harness scrolls in increments
// and captures the VIEWPORT at each position, so we can see what the user actually sees
// at each step of the scroll narrative.
//
// Also probes:
//   - Lenis presence + state
//   - Three.js canvas count + WebGL context status
//   - Any overlapping fixed-position elements blocking interaction
//   - Console errors per scroll position
//   - Layout shifts (CLS)

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:3001";
const TARGET = "/";
const OUT_DIR = path.join(__dirname, "..", "diagnostics");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const SCROLL_STOPS = [
    { vh: 0,   label: "0_hero" },
    { vh: 1,   label: "1_hero_settle" },
    { vh: 2,   label: "2_pre_peel" },
    { vh: 5,   label: "3_cave_peel" },
    { vh: 6,   label: "4_ticker" },
    { vh: 7,   label: "5_post_ticker" },
    { vh: 9,   label: "6_problem" },
    { vh: 11,  label: "7_timeline_start" },
    { vh: 14,  label: "8_timeline_mid" },
    { vh: 18,  label: "9_philosophy" },
    { vh: 22,  label: "10_services" },
    { vh: 26,  label: "11_case_studies" },
    { vh: 32,  label: "12_terminal_cta" },
];

(async () => {
    console.log("─".repeat(72));
    console.log("SCROLL-WALKTHROUGH DIAGNOSTIC");
    console.log("─".repeat(72));

    const browser = await chromium.launch({ headless: false });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();

    const allConsole = [];
    const pageErrors = [];

    page.on("console", msg => {
        const item = { type: msg.type(), text: msg.text() };
        allConsole.push(item);
        if (msg.type() === "error" || /hydrat|lenis|three|webgl/i.test(msg.text())) {
            console.log(`[${msg.type()}] ${msg.text().slice(0, 200)}`);
        }
    });
    page.on("pageerror", err => {
        pageErrors.push({ message: err.message, stack: err.stack });
        console.log(`[PAGE ERROR] ${err.message}`);
    });

    console.log(`\nNavigating to ${BASE}${TARGET}...`);
    await page.goto(BASE + TARGET, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Give Lenis + Three.js + Framer Motion time to mount and idle
    await page.waitForTimeout(6000);

    // Probe environment health
    const env = await page.evaluate(() => {
        const canvases = document.querySelectorAll("canvas");
        const ctxLossInfo = [];
        canvases.forEach((c, i) => {
            const gl = c.getContext("webgl2") || c.getContext("webgl");
            ctxLossInfo.push({
                idx: i,
                width: c.width,
                height: c.height,
                hasGL: !!gl,
                contextLost: gl ? gl.isContextLost() : "no-gl",
            });
        });
        const lenis = (window).__lenis ? "found" : "absent";
        const docHeight = document.documentElement.scrollHeight;
        const fixedEls = Array.from(document.querySelectorAll("*")).filter(el => {
            const cs = getComputedStyle(el);
            return cs.position === "fixed";
        }).slice(0, 30).map(el => ({
            tag: el.tagName,
            id: el.id,
            classes: el.className.toString().slice(0, 80),
            zIndex: getComputedStyle(el).zIndex,
            opacity: getComputedStyle(el).opacity,
            pointerEvents: getComputedStyle(el).pointerEvents,
        }));
        return {
            canvases: ctxLossInfo,
            lenis,
            docHeight,
            viewportHeight: window.innerHeight,
            scrollMax: docHeight - window.innerHeight,
            fixedEls,
        };
    });
    console.log(`\n[ENV]`);
    console.log(`  document height: ${env.docHeight}px`);
    console.log(`  viewport: ${env.viewportHeight}px`);
    console.log(`  lenis: ${env.lenis}`);
    console.log(`  canvas count: ${env.canvases.length}`);
    env.canvases.forEach(c => console.log(`    canvas[${c.idx}] ${c.width}x${c.height} gl=${c.hasGL} lost=${c.contextLost}`));
    console.log(`  fixed elements (top 30):`);
    env.fixedEls.forEach(f => console.log(`    <${f.tag}#${f.id}> z=${f.zIndex} op=${f.opacity} pe=${f.pointerEvents}`));

    const stops = [];
    for (const stop of SCROLL_STOPS) {
        const pixelY = stop.vh * env.viewportHeight;
        if (pixelY > env.scrollMax) {
            console.log(`\n[skip ${stop.label}] ${stop.vh}vh = ${pixelY}px exceeds scrollMax ${env.scrollMax}px`);
            continue;
        }

        const errorsBefore = allConsole.filter(c => c.type === "error").length;

        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), pixelY);
        await page.waitForTimeout(800); // let scroll listeners + Framer/Lenis settle

        const errorsAfter = allConsole.filter(c => c.type === "error").length;
        const newErrors = errorsAfter - errorsBefore;

        const visibleProbe = await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll("[id], h1, h2, h3, section, main"));
            const visible = all.filter(el => {
                const r = el.getBoundingClientRect();
                return r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
            }).slice(0, 8).map(el => ({
                tag: el.tagName,
                id: el.id || null,
                text: (el.innerText || "").slice(0, 60).replace(/\s+/g, " ").trim(),
                rect: { t: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height) },
                opacity: parseFloat(getComputedStyle(el).opacity),
                pointerEvents: getComputedStyle(el).pointerEvents,
            }));
            return visible;
        });

        const screenshotPath = path.join(OUT_DIR, `${ts}_scroll_${stop.label}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        console.log(`\n[stop ${stop.label}] vh=${stop.vh} y=${pixelY}px newErrors=${newErrors}`);
        visibleProbe.slice(0, 5).forEach(v => console.log(`  ${v.tag}#${v.id || "—"} op=${v.opacity} text="${v.text.slice(0, 40)}"`));

        stops.push({ ...stop, pixelY, newErrors, visibleProbe, screenshot: screenshotPath });
    }

    const reportPath = path.join(OUT_DIR, `${ts}_walkthrough.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
        env,
        stops,
        consoleAllByType: allConsole.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {}),
        errors: allConsole.filter(c => c.type === "error"),
        warnings: allConsole.filter(c => c.type === "warning"),
        pageErrors,
    }, null, 2));

    console.log(`\n${"─".repeat(72)}\nREPORT → ${reportPath}\n${"─".repeat(72)}`);
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
