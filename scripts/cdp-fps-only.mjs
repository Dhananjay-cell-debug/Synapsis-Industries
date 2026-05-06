// Minimal FPS-only diagnostic — focuses on hero/cave perf.
import fs from "node:fs/promises";
const OUT = "C:/Users/Dhananjay/AppData/Local/Temp/synapsis-diag";
await fs.mkdir(OUT, { recursive: true });

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
let page = list.find(t => t.type === "page" && (t.url.includes("3001")));
if (!page) {
    page = await (await fetch("http://127.0.0.1:9222/json/new?http://127.0.0.1:3001", { method: "PUT" })).json();
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let nextId = 1;
const pending = new Map();
ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id !== undefined && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
};
const send = (method, params = {}) => new Promise((res, rej) => {
    const id = nextId++; pending.set(id, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("timeout " + method)); } }, 15000);
});
const evalJs = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;

await send("Page.enable");
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
await send("Page.bringToFront");
await send("Page.navigate", { url: "http://127.0.0.1:3001" });
await new Promise(r => setTimeout(r, 6000));
const sanity = await evalJs(`document.readyState + "/" + (document.querySelector("canvas") ? "canvas-yes" : "canvas-no")`);
console.log("[sanity]", sanity);

// Inject FPS + delta logger
await evalJs(`(function(){
    if (window.__fps2) return;
    window.__fps2 = { samples: [], frames: 0, last: performance.now() };
    window.__deltaSpikes2 = [];
    let lastT = performance.now();
    function tick(now){
        window.__fps2.frames++;
        if (now - window.__fps2.last >= 1000){
            window.__fps2.samples.push({ fps: +(window.__fps2.frames*1000/(now-window.__fps2.last)).toFixed(1), scrollY: window.scrollY });
            window.__fps2.frames = 0; window.__fps2.last = now;
        }
        const d = (now-lastT)/1000;
        if (d > 0.05) window.__deltaSpikes2.push({ delta:+d.toFixed(3), scrollY: window.scrollY });
        lastT = now;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})()`);

// Cycle 1: sit at scroll 0 for 4s (cave + all controllers active = worst case)
await evalJs(`window.scrollTo(0,0)`);
await new Promise(r => setTimeout(r, 4000));

// Cycle 2: smooth scroll 0 → 8000 in steps
for (let y = 0; y <= 8000; y += 400) {
    await evalJs(`window.scrollTo(0, ${y})`);
    await new Promise(r => setTimeout(r, 200));
}

// Cycle 3: sit at vh=5 (transition zone — was 1fps before)
await evalJs(`window.scrollTo(0, 5400)`);
await new Promise(r => setTimeout(r, 3000));

const debug = await evalJs(`JSON.stringify({hasFps:!!window.__fps2, len:window.__fps2?.samples?.length, frames:window.__fps2?.frames})`);
console.log("[debug]", debug);
const fpsSeries = await evalJs(`JSON.stringify(window.__fps2?.samples || [])`);
const deltaSpikes = await evalJs(`JSON.stringify(window.__deltaSpikes2 || [])`);
const fps = JSON.parse(fpsSeries), spikes = JSON.parse(deltaSpikes);

const summary = {
    samples: fps.length,
    fpsMin: Math.min(...fps.map(s=>s.fps)),
    fpsMax: Math.max(...fps.map(s=>s.fps)),
    fpsAvg: +(fps.reduce((a,s)=>a+s.fps,0)/fps.length).toFixed(1),
    deltaSpikeCount: spikes.length,
    biggestDelta: spikes.reduce((m,d)=>Math.max(m,d.delta),0),
    spikesOverHalfSec: spikes.filter(s=>s.delta>=0.5).length,
};
await fs.writeFile(OUT+"/fps-AFTER.json", fpsSeries);
await fs.writeFile(OUT+"/delta-AFTER.json", deltaSpikes);
await fs.writeFile(OUT+"/SUMMARY-AFTER.json", JSON.stringify(summary, null, 2));
console.log("AFTER:", JSON.stringify(summary, null, 2));
ws.close();
