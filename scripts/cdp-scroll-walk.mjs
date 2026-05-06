import fs from "node:fs/promises";
const OUT = "C:/Users/Dhananjay/AppData/Local/Temp/synapsis-diag/walk";
await fs.mkdir(OUT, { recursive: true });
const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
let page = list.find(t => t.type === "page" && t.url.includes("3001"));
if (!page) page = await (await fetch("http://127.0.0.1:9222/json/new?http://127.0.0.1:3001",{method:"PUT"})).json();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let nid=1; const p=new Map();
ws.onmessage=(e)=>{const m=JSON.parse(e.data); if(p.has(m.id)){p.get(m.id)(m.result);p.delete(m.id);}};
const send=(m,x={})=>new Promise(r=>{const id=nid++;p.set(id,r);ws.send(JSON.stringify({id,method:m,params:x}));});
const evalJs=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true})).result?.value;

await send("Emulation.setFocusEmulationEnabled",{enabled:true});
await send("Page.bringToFront");
await send("Page.navigate",{url:"http://127.0.0.1:3001"});
await new Promise(r=>setTimeout(r,5000));

// Walk through scroll positions like a real user — small steps, settle, capture
const stops = [0, 0.3, 0.6, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.3, 5.6, 6, 6.5, 7, 8];
for (const vh of stops) {
    const y = Math.round(1080 * vh);
    await evalJs(`window.scrollTo({top:${y}, behavior:'instant'})`);
    await new Promise(r=>setTimeout(r,1300)); // let camera lerp settle
    const cam = await evalJs(`JSON.stringify(window.__cameraDebug||null)`);
    const r = await send("Page.captureScreenshot",{format:"png"});
    const fn = `vh-${vh.toString().replace(".","_")}.png`;
    await fs.writeFile(`${OUT}/${fn}`, Buffer.from(r.data,"base64"));
    console.log(`vh=${vh} y=${y} cam=${cam}`);
}
ws.close();
