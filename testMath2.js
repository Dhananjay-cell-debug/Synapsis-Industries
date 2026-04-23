function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function mapRange(value, start, end) { return Math.max(0, Math.min(1, (value - start) / (end - start))); }
function footstep(t, steps, amp) { return Math.abs(Math.sin(t * Math.PI * steps)) * amp; }

const orbitCenterX = 0, orbitCenterY = -0.5, orbitCenterZ = -15;
const orbitY = -1;

let issues = [];

console.log("Pct  | X       | Y      | Z       | Dist  | Phase     | Steps");
console.log("-----|---------|--------|---------|-------|-----------|------");

for (let p = 0; p <= 100; p += 1) {
    let progress = p / 100;
    let targetX = 0, targetY = 0, targetZ = 10;
    let phase = "";
    let stepInPhase = 0;

    if (progress <= 0.15) {
        const t = easeInOutCubic(mapRange(progress, 0, 0.15));
        const headBob = footstep(t, 13, 0.12);
        const sway = Math.cos(t * Math.PI * 6.5) * 0.06;
        targetX = sway; targetZ = 10 - (t * 15); targetY = orbitY + headBob;
        phase = "WALK_IN"; stepInPhase = Math.round(t * 13);
    } else if (progress <= 0.70) {
        const t = easeInOutCubic(mapRange(progress, 0.15, 0.70));
        const headBob = footstep(t, 60, 0.12);
        const sway = Math.cos(t * Math.PI * 30) * 0.06;
        const dynamicRadius = 10 + Math.sin(t * Math.PI * 4) * 2;
        const angle = (Math.PI * 0.5) + (t * Math.PI * 2);
        targetX = orbitCenterX + Math.cos(angle) * dynamicRadius + sway;
        targetZ = orbitCenterZ + Math.sin(angle) * dynamicRadius;
        targetY = orbitY + headBob;
        phase = "ORBIT"; stepInPhase = Math.round(t * 60);
    } else if (progress <= 0.85) {
        const t = easeInOutCubic(mapRange(progress, 0.70, 0.85));
        const headBob = footstep(t, 13, 0.10);
        const sway = Math.cos(t * Math.PI * 6.5) * 0.05;
        targetX = sway; targetZ = -5 + (t * 15); targetY = orbitY + headBob;
        phase = "WALK_OUT"; stepInPhase = Math.round(t * 13);
    } else {
        const t = easeOutCubic(mapRange(progress, 0.85, 1.0));
        const headBob = footstep(t, 16, 0.08);
        targetX = 0; targetZ = 10 + (t * 6); targetY = orbitY * (1 - t) + headBob;
        phase = "ZOOM_OUT"; stepInPhase = Math.round(t * 16);
    }

    let dist = Math.sqrt(Math.pow(targetX - orbitCenterX, 2) + Math.pow(targetZ - orbitCenterZ, 2));

    // The gate tunnel operates from Z=10 down to Z=-4
    // If the camera is doing its wide orbit (X > 5) while Z > -4, it will clip the gate wall!
    if (phase === "ORBIT") {
        if (targetZ > -4 && Math.abs(targetX) > 2) {
            issues.push(`${p}%: Clipping into Gate Arch! X=${targetX.toFixed(2)}, Z=${targetZ.toFixed(2)}`);
        }
        if (Math.abs(targetX) > 19) {
            issues.push(`${p}%: Clipping cavern walls! X=${targetX.toFixed(2)} (Limit 21)`);
        }
    }

    if (p % 5 === 0) {
        console.log(
            `${p.toString().padStart(3)}% | ${targetX.toFixed(2).padStart(7)} | ${targetY.toFixed(2).padStart(6)} | ${targetZ.toFixed(2).padStart(7)} | ${dist.toFixed(1).padStart(5)} | ${phase.padEnd(9)} | ${stepInPhase}`
        );
    }
}

console.log("\n=== SAFETY REPORT ===");
if (issues.length === 0) {
    console.log("ALL CLEAR: Path respects 21m cavern radius and avoids gate wall clipping.");
} else {
    console.log("ISSUES FOUND:");
    issues.forEach(i => console.log("  - " + i));
}
