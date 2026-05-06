// CDP diagnostics: connects to already-running Chrome on :9222
// Captures: screenshots at scroll positions, console logs, errors, FPS, camera state, performance metrics.

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = "C:/Users/Dhananjay/AppData/Local/Temp/synapsis-diag";
const URL = "http://127.0.0.1:3001";

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });

const consoleLog = [];
const errorLog = [];
const requestFailLog = [];

page.on("console", (msg) => {
    consoleLog.push({ t: Date.now(), type: msg.type(), text: msg.text() });
});
page.on("pageerror", (err) => {
    errorLog.push({ t: Date.now(), msg: err.message, stack: err.stack });
});
page.on("requestfailed", (req) => {
    requestFailLog.push({ t: Date.now(), url: req.url(), failure: req.failure()?.errorText });
});

console.log("[1/6] Navigating to", URL);
const navStart = Date.now();
await page.goto(URL, { waitUntil: "load", timeout: 60000 });
const loadMs = Date.now() - navStart;
console.log("    load time:", loadMs, "ms");

// Inject FPS counter into the page
await page.evaluate(() => {
    (window).__fps = { samples: [], frames: 0, last: performance.now() };
    function tick(now) {
        const w = window;
        w.__fps.frames++;
        if (now - w.__fps.last >= 1000) {
            const fps = w.__fps.frames * 1000 / (now - w.__fps.last);
            w.__fps.samples.push({ t: Date.now(), fps: +fps.toFixed(1), scrollY: window.scrollY });
            w.__fps.frames = 0;
            w.__fps.last = now;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
});

// Initial settle
await page.waitForTimeout(2000);

console.log("[2/6] Screenshot at scroll=0");
await page.screenshot({ path: path.join(OUT, "01-initial.png"), fullPage: false });

// Capture initial DOM/Canvas state
const initial = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const camDebug = (window).__cameraDebug || null;
    const lenis = (window).__lenis || null;
    return {
        url: location.href,
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        devicePixelRatio: window.devicePixelRatio,
        canvasPresent: !!canvas,
        canvasSize: canvas ? { w: canvas.width, h: canvas.height, cw: canvas.clientWidth, ch: canvas.clientHeight } : null,
        cameraDebug: camDebug,
        documentHeight: document.documentElement.scrollHeight,
    };
});
console.log("    initial state:", JSON.stringify(initial, null, 2));

// Scroll positions to test (in vh)
const VH_TARGETS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 5.5, 6, 6.5, 7, 8];
const scrollSamples = [];

console.log("[3/6] Scrolling through positions and sampling state…");
for (const vh of VH_TARGETS) {
    const targetY = Math.round(initial.innerHeight * vh);
    await page.evaluate((y) => window.scrollTo(0, y), targetY);
    await page.waitForTimeout(900); // let camera lerp settle
    const state = await page.evaluate(() => ({
        scrollY: window.scrollY,
        cameraDebug: (window).__cameraDebug || null,
        cameraUp: ((window).__cameraUpDebug) || null,
    }));
    const ssPath = path.join(OUT, `scroll-${vh.toString().replace(".", "_")}vh.png`);
    await page.screenshot({ path: ssPath, fullPage: false });
    scrollSamples.push({ targetVh: vh, ...state });
    console.log(`    vh=${vh}  scrollY=${state.scrollY}  cam=`, state.cameraDebug);
}

// Scroll back to 0 fast
console.log("[4/6] Fast-scroll stress (rapid back-and-forth)");
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await page.waitForTimeout(500);

// Simulate fast scroll-jacking like a real user does — wheel events
const fpsSnapshotBefore = await page.evaluate(() => (window).__fps.samples.slice(-3));
for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(50);
}
await page.waitForTimeout(2000);
const fpsSnapshotAfter = await page.evaluate(() => (window).__fps.samples.slice(-15));
await page.screenshot({ path: path.join(OUT, "after-fast-scroll.png") });

// Tab visibility test — switch away and back to trigger delta spike
console.log("[5/6] Visibility-spike test (simulate tab switch)");
await page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }));
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await page.waitForTimeout(1500);
await page.evaluate(() => Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }));
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, "after-visibility-spike.png") });
const visibilityCamState = await page.evaluate(() => ({
    scrollY: window.scrollY,
    cameraDebug: (window).__cameraDebug,
}));
console.log("    after-visibility cam state:", visibilityCamState);

// Get FPS series
const allFps = await page.evaluate(() => (window).__fps.samples);

// Get layout/perf metrics
const perfMetrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = performance.getEntriesByType("paint");
    return {
        navigation: nav ? {
            domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
            load: nav.loadEventEnd - nav.startTime,
            transferSize: nav.transferSize,
        } : null,
        paint: paint.map((p) => ({ name: p.name, startTime: p.startTime })),
        memory: (performance).memory ? {
            usedJSHeap: (performance).memory.usedJSHeapSize,
            totalJSHeap: (performance).memory.totalJSHeapSize,
        } : null,
    };
});

console.log("[6/6] Writing artifacts");
await fs.writeFile(path.join(OUT, "console.json"), JSON.stringify(consoleLog, null, 2));
await fs.writeFile(path.join(OUT, "errors.json"), JSON.stringify(errorLog, null, 2));
await fs.writeFile(path.join(OUT, "request-failures.json"), JSON.stringify(requestFailLog, null, 2));
await fs.writeFile(path.join(OUT, "scroll-samples.json"), JSON.stringify(scrollSamples, null, 2));
await fs.writeFile(path.join(OUT, "fps-series.json"), JSON.stringify(allFps, null, 2));
await fs.writeFile(path.join(OUT, "perf.json"), JSON.stringify(perfMetrics, null, 2));
await fs.writeFile(path.join(OUT, "fps-fast-scroll.json"), JSON.stringify({ before: fpsSnapshotBefore, after: fpsSnapshotAfter }, null, 2));
await fs.writeFile(path.join(OUT, "initial.json"), JSON.stringify(initial, null, 2));

const summary = {
    loadMs,
    consoleCount: consoleLog.length,
    errorCount: errorLog.length,
    requestFailCount: requestFailLog.length,
    fpsSampleCount: allFps.length,
    fpsMin: allFps.length ? Math.min(...allFps.map(s => s.fps)) : null,
    fpsMax: allFps.length ? Math.max(...allFps.map(s => s.fps)) : null,
    fpsAvg: allFps.length ? +(allFps.reduce((a, s) => a + s.fps, 0) / allFps.length).toFixed(1) : null,
    perfMetrics,
};
await fs.writeFile(path.join(OUT, "SUMMARY.json"), JSON.stringify(summary, null, 2));
console.log("SUMMARY:", JSON.stringify(summary, null, 2));

await page.close();
await browser.close();
console.log("Done. Artifacts in", OUT);
