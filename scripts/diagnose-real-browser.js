// Real-Chrome diagnostic harness.
// Launches Playwright Chromium in HEADED mode (real browser, real GPU, real timings),
// captures every console message, page error, network failure, and hydration warning,
// takes full-page screenshots of each route, and writes a structured report.
//
// Usage:  node scripts/diagnose-real-browser.js
//
// Reads dev server at http://127.0.0.1:3001 — make sure `npm run dev` is already running.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:3001";
const ROUTES = [
    { path: "/",                       name: "home" },
    { path: "/dashboard",              name: "dashboard" },
    { path: "/client/qsk602y00z",      name: "client_portal" },
];

const OUT_DIR = path.join(__dirname, "..", "diagnostics");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const report = {
    timestamp: ts,
    base: BASE,
    routes: [],
};

(async () => {
    console.log("─".repeat(72));
    console.log("REAL-CHROME DIAGNOSTIC HARNESS");
    console.log("─".repeat(72));

    const browser = await chromium.launch({
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
    });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    for (const route of ROUTES) {
        console.log(`\n→ ${route.path}`);
        const entry = {
            path: route.path,
            console: [],
            pageErrors: [],
            requestFailures: [],
            badResponses: [],
            screenshot: null,
            loadStatus: null,
        };

        const page = await ctx.newPage();

        page.on("console", msg => {
            const txt = msg.text();
            entry.console.push({ type: msg.type(), text: txt, location: msg.location() });
            if (msg.type() === "error" || /hydrat/i.test(txt)) {
                console.log(`   [${msg.type()}] ${txt.slice(0, 200)}`);
            }
        });

        page.on("pageerror", err => {
            entry.pageErrors.push({ message: err.message, stack: err.stack });
            console.log(`   [PAGE ERROR] ${err.message.slice(0, 200)}`);
        });

        page.on("requestfailed", req => {
            entry.requestFailures.push({ url: req.url(), failure: req.failure()?.errorText, method: req.method() });
            console.log(`   [REQ FAIL] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
        });

        page.on("response", resp => {
            if (resp.status() >= 400) {
                entry.badResponses.push({ url: resp.url(), status: resp.status(), method: resp.request().method() });
                console.log(`   [HTTP ${resp.status()}] ${resp.url()}`);
            }
        });

        try {
            const resp = await page.goto(BASE + route.path, { waitUntil: "networkidle", timeout: 30000 });
            entry.loadStatus = resp ? resp.status() : "no-response";

            // Wait for hydration / framer-motion / lenis / three.js to settle
            await page.waitForTimeout(4000);

            const screenshotPath = path.join(OUT_DIR, `${ts}_${route.name}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            entry.screenshot = screenshotPath;
            console.log(`   ✓ snap → ${screenshotPath}`);

            // Probe DOM-level health: any visible Next.js error overlay?
            const hasNextError = await page.evaluate(() => !!document.querySelector("nextjs-portal, [data-nextjs-dialog]"));
            entry.nextErrorOverlay = hasNextError;
            if (hasNextError) console.log("   ⚠ Next.js error overlay visible");

            // Probe for hidden body content (white-screen detection)
            const bodyChars = await page.evaluate(() => document.body.innerText.trim().length);
            entry.bodyTextLength = bodyChars;
            if (bodyChars < 50) console.log(`   ⚠ Suspicious low body content: ${bodyChars} chars`);

        } catch (e) {
            entry.loadStatus = `error:${e.message}`;
            console.log(`   ✗ navigation failed: ${e.message}`);
        }

        await page.close();
        report.routes.push(entry);
    }

    await browser.close();

    const reportPath = path.join(OUT_DIR, `${ts}_report.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("\n─".repeat(72));
    console.log(`REPORT → ${reportPath}`);
    console.log("─".repeat(72));

    // Quick summary
    for (const r of report.routes) {
        const errs = r.console.filter(c => c.type === "error").length;
        const warns = r.console.filter(c => c.type === "warning").length;
        const hyd = r.console.filter(c => /hydrat/i.test(c.text)).length;
        console.log(
            `${r.path.padEnd(28)} status=${r.loadStatus} ` +
            `console_err=${errs} warn=${warns} hydration=${hyd} ` +
            `pageErr=${r.pageErrors.length} reqFail=${r.requestFailures.length} bad4xx5xx=${r.badResponses.length} ` +
            `body=${r.bodyTextLength}`
        );
    }
})().catch(e => { console.error(e); process.exit(1); });
