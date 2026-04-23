"use client";

import { Float, Html } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

// ─── Circuit board canvas texture ──────────────────────────────────────────
function makeCircuitTexture(): THREE.CanvasTexture {
    const W = 512, H = 384;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#020810";
    ctx.fillRect(0, 0, W, H);

    const trace = "rgba(17,184,234,0.09)";
    const node  = "rgba(17,184,234,0.22)";
    ctx.lineWidth = 1;

    for (let row = 0; row < 16; row++) {
        const y = 24 + row * 22;
        let x = 8;
        while (x < W) {
            const len = 32 + Math.floor(Math.random() * 96);
            ctx.strokeStyle = trace;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
            ctx.fillStyle = node;
            ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + len, y, 1.5, 0, Math.PI * 2); ctx.fill();
            x += len + 8 + Math.floor(Math.random() * 32);
        }
    }
    for (let i = 0; i < 18; i++) {
        const x = 16 + Math.floor(Math.random() * (W - 32));
        const y1 = Math.floor(Math.random() * (H / 2));
        const y2 = y1 + 22 + Math.floor(Math.random() * 66);
        ctx.strokeStyle = trace;
        ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
        const x = Math.floor(Math.random() * W);
        const y = Math.floor(Math.random() * H);
        ctx.strokeStyle = node;
        ctx.strokeRect(x, y, 5, 5);
    }

    return new THREE.CanvasTexture(canvas);
}

const CYAN = "#11B8EA";
const ROYAL = "#3B6AE8";
const DARK = "#020810";
const T = 0.008; // frame line thickness

// ─── Helper: Glowing thin strip (for frame construction) ───────────────────
function Strip({
    w, h, position, color = CYAN, emissive = 2.5, d = 0.015,
}: {
    w: number; h: number; d?: number;
    position: [number, number, number];
    color?: string; emissive?: number;
}) {
    return (
        <mesh position={position}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
        </mesh>
    );
}

// ─── Corner L-bracket (2 strips forming ⌐ shape) ───────────────────────────
function Corner({ x, y, fx = 1, fy = 1 }: { x: number; y: number; fx?: number; fy?: number }) {
    const arm = 0.11;
    return (
        <group>
            <Strip w={arm} h={T} position={[x + fx * (arm / 2 - T / 2), y, 0.025]} />
            <Strip w={T} h={arm} position={[x, y + fy * (arm / 2 - T / 2), 0.025]} />
        </group>
    );
}

// ─── ICON: Waveform bars — AI Automation ───────────────────────────────────
function WaveformIcon() {
    const bars = [0.07, 0.13, 0.21, 0.28, 0.21, 0.13, 0.07];
    const spacing = 0.044;
    const totalW = spacing * (bars.length - 1);
    return (
        <group>
            {bars.map((h, i) => (
                <mesh key={i} position={[i * spacing - totalW / 2, 0, 0]}>
                    <boxGeometry args={[0.022, h, 0.022]} />
                    <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={2.2} />
                </mesh>
            ))}
        </group>
    );
}

// ─── ICON: Stacked layers — Full Stack Dev ──────────────────────────────────
function StackIcon() {
    const layers = [
        { y: 0.11, w: 0.30, color: CYAN },
        { y: 0.00, w: 0.24, color: "#ffffff" },
        { y: -0.11, w: 0.18, color: ROYAL },
    ];
    return (
        <group>
            {layers.map((l, i) => (
                <mesh key={i} position={[0, l.y, 0]}>
                    <boxGeometry args={[l.w, 0.038, 0.05]} />
                    <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={1.6} metalness={0.7} roughness={0.2} />
                </mesh>
            ))}
        </group>
    );
}

// ─── ICON: Circuit chip — AI Integration ───────────────────────────────────
function ChipIcon() {
    const core = 0.15;
    const pinL = 0.09;
    const pinT = 0.014;
    const pinPositions = [-0.06, 0, 0.06];
    return (
        <group>
            {/* Core */}
            <mesh>
                <boxGeometry args={[core, core, 0.04]} />
                <meshStandardMaterial color="#061220" emissive={CYAN} emissiveIntensity={0.4} metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Core border strips */}
            <Strip w={core + T} h={T} position={[0, core / 2, 0.03]} emissive={2} />
            <Strip w={core + T} h={T} position={[0, -core / 2, 0.03]} emissive={2} />
            <Strip w={T} h={core} position={[-core / 2, 0, 0.03]} emissive={2} />
            <Strip w={T} h={core} position={[core / 2, 0, 0.03]} emissive={2} />
            {/* Pins */}
            {pinPositions.map((p, i) => (
                <group key={i}>
                    <mesh position={[p, core / 2 + pinL / 2, 0]}>
                        <boxGeometry args={[pinT, pinL, pinT]} />
                        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={1.8} />
                    </mesh>
                    <mesh position={[p, -(core / 2 + pinL / 2), 0]}>
                        <boxGeometry args={[pinT, pinL, pinT]} />
                        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={1.8} />
                    </mesh>
                    <mesh position={[core / 2 + pinL / 2, p, 0]}>
                        <boxGeometry args={[pinL, pinT, pinT]} />
                        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={1.8} />
                    </mesh>
                    <mesh position={[-(core / 2 + pinL / 2), p, 0]}>
                        <boxGeometry args={[pinL, pinT, pinT]} />
                        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={1.8} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

// ─── Card data ──────────────────────────────────────────────────────────────
const cardsData = [
    {
        title: "AI AUTOMATION",
        description: "Workflows automated,\n100+ hours saved monthly",
        position: [-4.0, 3.5, -5.0] as [number, number, number],
        rotation: [0.08, 0.45, 0] as [number, number, number],
        delay: 0,
    },
    {
        title: "FULL STACK DEV",
        description: "Web apps, APIs,\ndashboards built to scale",
        position: [0, 4.5, -6.5] as [number, number, number],
        rotation: [0.08, 0, 0] as [number, number, number],
        delay: 0.5,
    },
    {
        title: "AI INTEGRATION",
        description: "LLMs & custom models,\nintegrated seamlessly",
        position: [4.0, 3.5, -5.0] as [number, number, number],
        rotation: [0.08, -0.45, 0] as [number, number, number],
        delay: 1,
    },
];

// ─── HUD Panel Card ─────────────────────────────────────────────────────────
function HUDCard({ data }: { data: typeof cardsData[0] }) {
    const W = 1.3;
    const H = 0.92;
    const hW = W / 2;
    const hH = H / 2;
    const HEADER_H = 0.26;
    const HEADER_Y = hH - HEADER_H / 2;
    const DIVIDER_Y = hH - HEADER_H;
    const BODY_CENTER_Y = DIVIDER_Y / 2 - 0.04;
    const circuitTex = useMemo(() => makeCircuitTexture(), []);

    return (
        <Float
            position={data.position}
            rotation={data.rotation}
            speed={1.6}
            rotationIntensity={0.07}
            floatIntensity={0.22}
        >
            <group scale={2.5}>

                {/* ── Dark body with circuit texture ── */}
                <mesh position={[0, 0, -0.02]}>
                    <boxGeometry args={[W, H, 0.04]} />
                    <meshStandardMaterial color={DARK} map={circuitTex} transparent opacity={0.92} metalness={0.2} roughness={0.8} />
                </mesh>

                {/* ── Outer glow border (soft, slightly larger) ── */}
                <Strip w={W + 0.014} h={T * 2.2} position={[0, hH + 0.007, 0.016]} emissive={1.0} />
                <Strip w={W + 0.014} h={T * 2.2} position={[0, -hH - 0.007, 0.016]} emissive={1.0} />
                <Strip w={T * 2.2} h={H + 0.014} position={[-hW - 0.007, 0, 0.016]} emissive={1.0} />
                <Strip w={T * 2.2} h={H + 0.014} position={[hW + 0.007, 0, 0.016]} emissive={1.0} />

                {/* ── Header background (slightly lighter) ── */}
                <mesh position={[0, HEADER_Y, -0.005]}>
                    <boxGeometry args={[W - T * 2, HEADER_H, 0.02]} />
                    <meshStandardMaterial color="#04111e" transparent opacity={0.95} />
                </mesh>

                {/* ── Outer frame ── */}
                <Strip w={W} h={T} position={[0, hH, 0.02]} />
                <Strip w={W} h={T} position={[0, -hH, 0.02]} />
                <Strip w={T} h={H} position={[-hW, 0, 0.02]} />
                <Strip w={T} h={H} position={[hW, 0, 0.02]} />

                {/* ── Corner L-brackets ── */}
                <Corner x={-hW} y={hH} fx={1} fy={-1} />
                <Corner x={hW} y={hH} fx={-1} fy={-1} />
                <Corner x={-hW} y={-hH} fx={1} fy={1} />
                <Corner x={hW} y={-hH} fx={-1} fy={1} />

                {/* ── Header divider ── */}
                <Strip w={W} h={T} position={[0, DIVIDER_Y, 0.02]} emissive={1.8} />
                {/* Accent squares on divider ends */}
                <Strip w={0.05} h={0.05} position={[-hW + 0.04, DIVIDER_Y, 0.03]} emissive={3.5} />
                <Strip w={0.05} h={0.05} position={[hW - 0.04, DIVIDER_Y, 0.03]} emissive={3.5} />

                {/* ── Icon (left side of header) ── */}
                <group position={[-hW + 0.19, HEADER_Y + 0.01, 0.04]} scale={0.72}>
                    {data.title === "AI AUTOMATION" && <WaveformIcon />}
                    {data.title === "FULL STACK DEV" && <StackIcon />}
                    {data.title === "AI INTEGRATION" && <ChipIcon />}
                </group>

                {/* ── Title in header ── */}
                <Html
                    transform
                    center
                    position={[0.1, HEADER_Y, 0.04]}
                    style={{
                        color: CYAN,
                        fontSize: "16px",
                        fontWeight: "bold",
                        fontFamily: "monospace",
                        width: "300px",
                        textAlign: "center",
                        textShadow: `0 0 8px ${CYAN}`
                    }}
                >
                    {`[ ${data.title} ]`}
                </Html>

                {/* ── Content box frame (royal blue) ── */}
                <group position={[0, BODY_CENTER_Y, 0]}>
                    {/* Box border */}
                    <Strip w={W - 0.14} h={T} position={[0, 0.15, 0.02]} color={ROYAL} emissive={1.5} />
                    <Strip w={W - 0.14} h={T} position={[0, -0.15, 0.02]} color={ROYAL} emissive={1.5} />
                    <Strip w={T} h={0.30} position={[-(W - 0.14) / 2, 0, 0.02]} color={ROYAL} emissive={1.5} />
                    <Strip w={T} h={0.30} position={[(W - 0.14) / 2, 0, 0.02]} color={ROYAL} emissive={1.5} />

                    {/* Description text */}
                    <Html
                        transform
                        center
                        position={[0, 0, 0.04]}
                        style={{
                            color: "white",
                            fontSize: "10px",
                            fontFamily: "sans-serif",
                            width: "250px",
                            textAlign: "center",
                            lineHeight: "1.5",
                            textShadow: "0 0 4px rgba(255,255,255,0.3)"
                        }}
                    >
                        {data.description.split('\n').map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </Html>
                </group>

                {/* ── Glow light ── */}
                <pointLight position={[0, 0, 0.6]} color={CYAN} intensity={0.35} distance={2.5} />

            </group>
        </Float>
    );
}

// ─── Export ─────────────────────────────────────────────────────────────────
export default function FloatingServiceCards() {
    return (
        <group>
            {cardsData.map((card, idx) => (
                <HUDCard key={idx} data={card} />
            ))}
        </group>
    );
}
