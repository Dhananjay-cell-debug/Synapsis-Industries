// Raw CDP client (no playwright). Uses Node 22+ native WebSocket.
// Connects to a specific Chrome page WS endpoint and runs full diagnostic suite.

import fs from "node:fs/promises";
import path from "node:path";

const OUT = "C:/Users/Dhananjay/AppData/Local/Temp/synapsis-diag";
const TARGET_URL = "http://127.0.0.1:3001";

await fs.mkdir(OUT, { recursive: true });

// Find the page targeting localhost:3001 (or first tab we'll repurpose)
async function getPageWs() {
    const res = await fetch("http://127.0.0.1:9222/json/list");
    const targets = await res.json();
    const page = targets.find(t => t.type === "page" && (t.url.includes("127.0.0.1:3001") || t.url.includes("localhost:3001")));
    if (page) return page.webSocketDebuggerUrl;
    // Else create a new tab
    const newRes = await fetch(`http://127.0.0.1:9222/json/new?${TARGET_URL}`, { method: "PUT" });
    const newTab = await newRes.json();
    return newTab.webSocketDebuggerUrl;
}

const wsUrl = await getPageWs();
console.log("[CDP] connecting to", wsUrl);

const ws = new WebSocket(wsUrl);
await new Promise((r, rej) => { ws.onopen = r; ws.onerror = (e) => rej(new Error("ws err")); });
console.log("[CDP] connected");

let nextId = 1;
const pending = new Map();
const events = [];

ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
    } else if (msg.method) {
        events.push(msg);
    }
};

function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
        setTimeout(() => {
            if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }
        }, 30000);
    });
}

// Enable domains
await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Log.enable");
await send("Performance.enable");

// Subscribe to console / errors / requests
const consoleMessages = [];
const exceptions = [];
const requestFailures = [];

ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
    }
    if (msg.method === "Runtime.consoleAPICalled") {
        consoleMessages.push({ t: Date.now(), type: msg.params.type, args: msg.params.args.map(a => a.value ?? a.description ?? "") });
    } else if (msg.method === "Runtime.exceptionThrown") {
        exceptions.push({ t: Date.now(), text: msg.params.exceptionDetails.text, exception: msg.params.exceptionDetails.exception });
    } else if (msg.method === "Network.loadingFailed") {
        requestFailures.push({ t: Date.now(), errorText: msg.params.errorText, type: msg.params.type });
    } else if (msg.method === "Log.entryAdded") {
        consoleMessages.push({ t: Date.now(), type: "log:" + msg.params.entry.level, args: [msg.params.entry.text] });
    }
};

async function evalJs(expr) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.value;
}

async function screenshot(name) {
    const r = await send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(path.join(OUT, name), Buffer.from(r.data, "base64"));
}

async function setViewport(w, h) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
}

console.log("[1] setting viewport 1920x1080");
await setViewport(1920, 1080);

console.log("[2] navigating to", TARGET_URL);
const navStart = Date.now();
await send("Page.navigate", { url: TARGET_URL });
// Wait for load event
await new Promise((resolve) => {
    const onMsg = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.method === "Page.loadEventFired") { ws.removeEventListener("message", onMsg); resolve(); }
    };
    ws.addEventListener("message", onMsg);
    setTimeout(resolve, 60000);
});
const loadMs = Date.now() - navStart;
console.log("    page load:", loadMs, "ms");

// Inject FPS counter
await evalJs(`
    (function() {
        if (window.__fps) return;
        window.__fps = { samples: [], frames: 0, last: performance.now() };
        function tick(now) {
            window.__fps.frames++;
            if (now - window.__fps.last >= 1000) {
                const fps = window.__fps.frames * 1000 / (now - window.__fps.last);
                window.__fps.samples.push({ t: Date.now(), fps: +fps.toFixed(1), scrollY: window.scrollY });
                window.__fps.frames = 0;
                window.__fps.last = now;
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        // Also capture deltas (long-task-like) to detect overshoot conditions
        window.__deltaSpikes = [];
        let lastT = performance.now();
        function dtick(now) {
            const d = (now - lastT) / 1000;
            if (d > 0.05) window.__deltaSpikes.push({ t: Date.now(), delta: +d.toFixed(3), scrollY: window.scrollY });
            lastT = now;
            requestAnimationFrame(dtick);
        }
        requestAnimationFrame(dtick);
        // Capture camera up vector each frame to detect tilt overshoot
        window.__cameraUpHist = [];
    })();
`);

// Settle
await new Promise(r => setTimeout(r, 2500));

console.log("[3] initial state");
await screenshot("01-initial.png");
const initial = await evalJs(`(function(){
    const c = document.querySelector("canvas");
    return JSON.stringify({
        url: location.href,
        scrollY: window.scrollY,
        innerH: window.innerHeight, innerW: window.innerWidth,
        dpr: window.devicePixelRatio,
        canvas: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null,
        cameraDebug: window.__cameraDebug || null,
        documentH: document.documentElement.scrollHeight,
    });
})()`);
console.log("    initial:", initial);

// Scroll positions
const VH_TARGETS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 5.5, 6, 6.5, 7, 8];
const samples = [];

console.log("[4] scrolling and sampling at vh positions");
for (const vh of VH_TARGETS) {
    const innerH = JSON.parse(initial).innerH;
    const y = Math.round(innerH * vh);
    await evalJs(`window.scrollTo(0, ${y})`);
    await new Promise(r => setTimeout(r, 1100));
    const s = await evalJs(`JSON.stringify({
        scrollY: window.scrollY,
        camera: window.__cameraDebug || null,
    })`);
    const fname = `scroll-${vh.toString().replace(".", "_")}vh.png`;
    await screenshot(fname);
    console.log(`    vh=${vh}  y=${y}  ${s}`);
    samples.push({ targetVh: vh, ...JSON.parse(s) });
}

console.log("[5] fast-scroll stress");
await evalJs(`window.scrollTo({top:0, behavior:"instant"})`);
await new Promise(r => setTimeout(r, 800));
const fpsBefore = await evalJs(`JSON.stringify(window.__fps.samples.slice(-3))`);
// Rapid wheel events
for (let i = 0; i < 15; i++) {
    await send("Input.dispatchMouseEvent", {
        type: "mouseWheel", x: 960, y: 540, deltaX: 0, deltaY: 600
    });
    await new Promise(r => setTimeout(r, 60));
}
await new Promise(r => setTimeout(r, 2500));
const fpsAfter = await evalJs(`JSON.stringify(window.__fps.samples.slice(-15))`);
const deltaSpikesNow = await evalJs(`JSON.stringify(window.__deltaSpikes.slice(-30))`);
await screenshot("after-fast-scroll.png");

console.log("[6] visibility-spike test");
const camBeforeSpike = await evalJs(`JSON.stringify(window.__cameraDebug)`);
await evalJs(`Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange"));`);
await new Promise(r => setTimeout(r, 1500));
await evalJs(`Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange"));`);
await new Promise(r => setTimeout(r, 1000));
await screenshot("after-visibility.png");
const camAfterSpike = await evalJs(`JSON.stringify(window.__cameraDebug)`);
const allDeltaSpikes = await evalJs(`JSON.stringify(window.__deltaSpikes)`);
const allFps = await evalJs(`JSON.stringify(window.__fps.samples)`);

const perf = await evalJs(`JSON.stringify({
    nav: (function(){const n=performance.getEntriesByType("navigation")[0]; return n?{dcl:n.domContentLoadedEventEnd-n.startTime,load:n.loadEventEnd-n.startTime,transferSize:n.transferSize}:null})(),
    paint: performance.getEntriesByType("paint").map(p=>({name:p.name,startTime:p.startTime})),
    memory: performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,
})`);

console.log("[7] writing artifacts");
await fs.writeFile(path.join(OUT, "console.json"), JSON.stringify(consoleMessages, null, 2));
await fs.writeFile(path.join(OUT, "exceptions.json"), JSON.stringify(exceptions, null, 2));
await fs.writeFile(path.join(OUT, "request-failures.json"), JSON.stringify(requestFailures, null, 2));
await fs.writeFile(path.join(OUT, "scroll-samples.json"), JSON.stringify(samples, null, 2));
await fs.writeFile(path.join(OUT, "fps-series.json"), allFps);
await fs.writeFile(path.join(OUT, "delta-spikes.json"), allDeltaSpikes);
await fs.writeFile(path.join(OUT, "fps-fast-scroll.json"), JSON.stringify({ before: JSON.parse(fpsBefore), after: JSON.parse(fpsAfter), deltaSpikesDuring: JSON.parse(deltaSpikesNow) }, null, 2));
await fs.writeFile(path.join(OUT, "perf.json"), perf);
await fs.writeFile(path.join(OUT, "initial.json"), initial);
await fs.writeFile(path.join(OUT, "visibility-spike.json"), JSON.stringify({ before: JSON.parse(camBeforeSpike || "null"), after: JSON.parse(camAfterSpike || "null") }, null, 2));

const fpsArr = JSON.parse(allFps);
const summary = {
    loadMs,
    consoleCount: consoleMessages.length,
    exceptionCount: exceptions.length,
    requestFailCount: requestFailures.length,
    fpsSamples: fpsArr.length,
    fpsMin: fpsArr.length ? Math.min(...fpsArr.map(s=>s.fps)) : null,
    fpsMax: fpsArr.length ? Math.max(...fpsArr.map(s=>s.fps)) : null,
    fpsAvg: fpsArr.length ? +(fpsArr.reduce((a,s)=>a+s.fps,0)/fpsArr.length).toFixed(1) : null,
    deltaSpikeCount: JSON.parse(allDeltaSpikes).length,
    biggestDelta: JSON.parse(allDeltaSpikes).reduce((m,d)=>Math.max(m,d.delta),0),
};
await fs.writeFile(path.join(OUT, "SUMMARY.json"), JSON.stringify(summary, null, 2));
console.log("[SUMMARY]", JSON.stringify(summary, null, 2));

ws.close();
console.log("Done. Artifacts in", OUT);
