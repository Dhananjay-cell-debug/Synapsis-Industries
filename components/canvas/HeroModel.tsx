"use client";

import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Text3D, Center, RoundedBox, Float } from "@react-three/drei";
import * as topojson from "topojson-client";
import * as d3 from "d3-geo";
import FloatingServiceCards from "./FloatingServiceCards";

// --- Golden Globe Component ---
function GoldenGlobe() {
    const globeRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);

    const [canvas, texture] = useMemo(() => {
        if (typeof document === "undefined") return [null as unknown as HTMLCanvasElement, null as unknown as THREE.CanvasTexture];
        const c = document.createElement("canvas");
        c.width = 2048;
        c.height = 1024;
        const ctx = c.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(0, 0, 2048, 1024);
        }
        const tex = new THREE.CanvasTexture(c);
        return [c, tex];
    }, []);

    useEffect(() => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        fetch("/countries-110m.json")
            .then((res) => res.json())
            .then((world) => {
                const countries = topojson.feature(world, world.objects.countries) as any;
                const projection = d3.geoEquirectangular().translate([1024, 512]).scale(2048 / (2 * Math.PI));
                const path = d3.geoPath().projection(projection).context(ctx);
                ctx.fillStyle = "#6c4217";
                ctx.fillRect(0, 0, 2048, 1024);
                countries.features.forEach((feature: any) => {
                    ctx.beginPath();
                    path(feature);
                    ctx.fillStyle = "#e5c158";
                    ctx.fill();
                    ctx.setLineDash([5, 5]);
                    ctx.strokeStyle = "#4a2a10";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                });
                texture.needsUpdate = true;
            })
            .catch(err => console.error("Could not load world map", err));
    }, [canvas, texture]);

    useFrame((_state, delta) => {
        if (globeRef.current) {
            globeRef.current.rotation.y += delta * 0.15;
            globeRef.current.rotation.x = 0.2;
        }
    });

    return (
        <mesh ref={globeRef} castShadow receiveShadow>
            <sphereGeometry args={[0.5, 64, 64]} />
            <meshStandardMaterial
                ref={materialRef}
                map={texture}
                bumpMap={texture}
                bumpScale={0.015}
                color="#ffffff"
                roughness={0.7}
                metalness={0.2}
            />
        </mesh>
    );
}

// --- AI Server Rack (replaces Ring Light) ---
function AIServerRack({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
    return (
        <group position={position} rotation={rotation} scale={0.9}>
            {/* Rack frame */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.85, 2.6, 0.55]} />
                <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.25} />
            </mesh>
            {/* Server units */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <group key={i} position={[0, -1.0 + i * 0.38, 0.28]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.75, 0.3, 0.02]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
                    </mesh>
                    {/* LED strip */}
                    <mesh position={[-0.3, 0, 0.012]}>
                        <boxGeometry args={[0.08, 0.04, 0.002]} />
                        <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={3} toneMapped={false} />
                    </mesh>
                    {/* Activity dots */}
                    {[0, 1, 2].map((j) => (
                        <mesh key={j} position={[-0.1 + j * 0.09, 0, 0.012]}>
                            <circleGeometry args={[0.016, 8]} />
                            <meshStandardMaterial
                                color={j === 1 ? "#22c55e" : "#11B8EA"}
                                emissive={j === 1 ? "#22c55e" : "#11B8EA"}
                                emissiveIntensity={2.5}
                                toneMapped={false}
                            />
                        </mesh>
                    ))}
                    {/* Vent slots */}
                    {[0, 1, 2].map((k) => (
                        <mesh key={k} position={[0.15 + k * 0.08, 0, 0.012]}>
                            <boxGeometry args={[0.04, 0.18, 0.002]} />
                            <meshStandardMaterial color="#0a0a0a" />
                        </mesh>
                    ))}
                </group>
            ))}
            {/* Base */}
            <mesh position={[0, -1.4, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.95, 0.08, 0.65]} />
                <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.2} />
            </mesh>
        </group>
    );
}


// --- AI Terminal / Holographic Screen (replaces Cinema Camera) ---
function AITerminal({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
    return (
        <group position={position} rotation={rotation} scale={0.6}>
            {/* Pole */}
            <mesh position={[0, -1.1, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.06, 2.2, 16]} />
                <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Base */}
            <mesh position={[0, -2.3, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.3, 0.35, 0.06, 32]} />
                <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Screen frame */}
            <RoundedBox args={[1.5, 0.95, 0.07]} radius={0.04} smoothness={4} castShadow>
                <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
            </RoundedBox>
            {/* Screen */}
            <mesh position={[0, 0, 0.037]}>
                <planeGeometry args={[1.38, 0.85]} />
                <meshStandardMaterial color="#050d1a" emissive="#11B8EA" emissiveIntensity={0.25} />
            </mesh>
            {/* Code lines */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <mesh key={i} position={[-0.42 + (i % 2) * 0.08, 0.28 - i * 0.11, 0.04]}>
                    <planeGeometry args={[0.25 + (i % 3) * 0.22, 0.018]} />
                    <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={2.5} toneMapped={false} />
                </mesh>
            ))}
            {/* Cursor blink dot */}
            <mesh position={[0.3, -0.25, 0.04]}>
                <planeGeometry args={[0.04, 0.04]} />
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={3} toneMapped={false} />
            </mesh>
            {/* Corner accent */}
            <mesh position={[-0.68, 0.43, 0.038]}>
                <planeGeometry args={[0.12, 0.012]} />
                <meshStandardMaterial color="#3B6AE8" emissive="#3B6AE8" emissiveIntensity={2} toneMapped={false} />
            </mesh>
        </group>
    );
}

// --- Premium Agency Workstation ---
function ProfessionalWorkstation({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
    return (
        <group position={position} rotation={rotation} scale={0.8}>
            <mesh position={[0, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[3.2, 0.05, 1.2]} />
                <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
            </mesh>
            <group position={[0, 0.8, -0.3]}>
                <mesh position={[0, -0.78, -0.1]} castShadow receiveShadow>
                    <boxGeometry args={[0.5, 0.02, 0.3]} />
                    <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.1} />
                </mesh>
                <mesh position={[0, -0.4, -0.15]} rotation={[0.1, 0, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.04, 0.04, 0.8]} />
                    <meshStandardMaterial color="#aaaaaa" metalness={0.9} roughness={0.1} />
                </mesh>
                <RoundedBox args={[2.2, 1.0, 0.05]} radius={0.02} smoothness={2} castShadow receiveShadow>
                    <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.3} />
                </RoundedBox>
                <mesh position={[0, 0, 0.026]}>
                    <planeGeometry args={[2.14, 0.94]} />
                    <meshStandardMaterial color="#0f172a" emissive="#11B8EA" emissiveIntensity={0.25} />
                </mesh>
            </group>
            {/* Mouse */}
            <group position={[1.0, 0.15, -0.2]} castShadow receiveShadow>
                <RoundedBox args={[0.5, 0.25, 0.5]} radius={0.05} smoothness={4}>
                    <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.2} />
                </RoundedBox>
                <mesh position={[0, -0.05, 0.251]}>
                    <circleGeometry args={[0.01, 16]} />
                    <meshBasicMaterial color="#ef4444" />
                </mesh>
            </group>
            {/* Keyboard */}
            <group position={[-0.2, 0.03, 0.3]} rotation={[0.05, 0, 0]} castShadow receiveShadow>
                <RoundedBox args={[1.0, 0.02, 0.35]} radius={0.02} smoothness={2}>
                    <meshStandardMaterial color="#dddddd" metalness={0.7} roughness={0.2} />
                </RoundedBox>
                <mesh position={[0, 0.011, 0]}>
                    <boxGeometry args={[0.94, 0.005, 0.28]} />
                    <meshStandardMaterial color="#333333" roughness={0.8} />
                </mesh>
            </group>
            {/* Mouse pad / trackpad */}
            <group position={[0.6, 0.03, 0.3]} rotation={[0, -0.2, 0]} castShadow receiveShadow>
                <capsuleGeometry args={[0.06, 0.1, 16, 16]} />
                <meshStandardMaterial color="#dddddd" metalness={0.6} roughness={0.1} />
            </group>
        </group>
    );
}

// ─── Workflow Automation (AI Automation service) ───
// Represents: automated pipelines — Trigger → AI Process → Output
function WorkflowDiagram({ position }: { position: [number, number, number] }) {
    const nodeColors: [string, string, string] = ["#22c55e", "#11B8EA", "#3B6AE8"];
    const nodeX: [number, number, number] = [-0.55, 0, 0.55];

    return (
        <Float speed={0.9} floatIntensity={0.14} rotationIntensity={0.08}>
            <group position={position} rotation={[0.15, 0, 0]}>
                {/* Connecting lines between nodes */}
                {([0, 1] as const).map((i) => (
                    <mesh key={i} position={[nodeX[i] + 0.275, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.007, 0.007, 0.38, 6]} />
                        <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={2} toneMapped={false} transparent opacity={0.7} />
                    </mesh>
                ))}
                {/* Arrow cones pointing right */}
                {([0, 1] as const).map((i) => (
                    <mesh key={i} position={[nodeX[i] + 0.42, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                        <coneGeometry args={[0.034, 0.07, 6]} />
                        <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={2.5} toneMapped={false} />
                    </mesh>
                ))}
                {/* Three pipeline nodes */}
                {nodeX.map((x, i) => (
                    <group key={i} position={[x, 0, 0]}>
                        <RoundedBox args={[0.38, 0.22, 0.09]} radius={0.03} smoothness={3}>
                            <meshStandardMaterial color="#0d1b2a" metalness={0.7} roughness={0.3} />
                        </RoundedBox>
                        {/* Glowing colour bar at top of each node */}
                        <mesh position={[0, 0.11, 0]}>
                            <boxGeometry args={[0.34, 0.012, 0.07]} />
                            <meshStandardMaterial color={nodeColors[i]} emissive={nodeColors[i]} emissiveIntensity={2.5} toneMapped={false} />
                        </mesh>
                        {/* Status indicator dot */}
                        <mesh position={[-0.14, 0.04, 0.046]}>
                            <circleGeometry args={[0.022, 8]} />
                            <meshStandardMaterial color={nodeColors[i]} emissive={nodeColors[i]} emissiveIntensity={3} toneMapped={false} />
                        </mesh>
                        {/* Label lines */}
                        <mesh position={[0.02, 0.01, 0.046]}>
                            <planeGeometry args={[0.16, 0.013]} />
                            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} toneMapped={false} transparent opacity={0.5} />
                        </mesh>
                        <mesh position={[0.02, -0.025, 0.046]}>
                            <planeGeometry args={[0.10, 0.013]} />
                            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} toneMapped={false} transparent opacity={0.3} />
                        </mesh>
                    </group>
                ))}
                <pointLight color="#11B8EA" intensity={0.4} distance={2.5} />
            </group>
        </Float>
    );
}

// ─── LLM Orbital (AI Integration service) ───
// Represents: LLM models with data flowing in/out via orbiting nodes
function LLMOrbital({ position }: { position: [number, number, number] }) {
    const outerOrbitRef = useRef<THREE.Group>(null);
    const innerOrbitRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (outerOrbitRef.current) outerOrbitRef.current.rotation.y = state.clock.elapsedTime * 0.55;
        if (innerOrbitRef.current) {
            innerOrbitRef.current.rotation.y = -state.clock.elapsedTime * 0.85;
            innerOrbitRef.current.rotation.x = state.clock.elapsedTime * 0.28;
        }
    });

    return (
        <Float speed={1.1} floatIntensity={0.2} rotationIntensity={0.12}>
            <group position={position}>
                {/* Core model sphere */}
                <mesh>
                    <sphereGeometry args={[0.22, 32, 32]} />
                    <meshStandardMaterial color="#0a1628" emissive="#11B8EA" emissiveIntensity={0.4} roughness={0.3} metalness={0.6} />
                </mesh>
                {/* Inner glow core */}
                <mesh>
                    <sphereGeometry args={[0.13, 16, 16]} />
                    <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={2.8} toneMapped={false} transparent opacity={0.45} />
                </mesh>
                {/* Outer orbit ring (horizontal) */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.43, 0.008, 8, 48]} />
                    <meshStandardMaterial color="#3B6AE8" emissive="#3B6AE8" emissiveIntensity={1.5} toneMapped={false} transparent opacity={0.7} />
                </mesh>
                {/* Inner tilted orbit ring */}
                <mesh rotation={[Math.PI / 3, Math.PI / 6, 0]}>
                    <torusGeometry args={[0.32, 0.006, 8, 48]} />
                    <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={1.5} toneMapped={false} transparent opacity={0.6} />
                </mesh>
                {/* Outer orbiting data nodes */}
                <group ref={outerOrbitRef}>
                    {[0, 1, 2, 3].map((i) => {
                        const angle = (i / 4) * Math.PI * 2;
                        return (
                            <mesh key={i} position={[Math.cos(angle) * 0.43, 0, Math.sin(angle) * 0.43]}>
                                <sphereGeometry args={[0.042, 10, 10]} />
                                <meshStandardMaterial
                                    color={i % 2 === 0 ? "#11B8EA" : "#3B6AE8"}
                                    emissive={i % 2 === 0 ? "#11B8EA" : "#3B6AE8"}
                                    emissiveIntensity={3}
                                    toneMapped={false}
                                />
                            </mesh>
                        );
                    })}
                </group>
                {/* Inner orbiting token nodes */}
                <group ref={innerOrbitRef}>
                    {[0, 1, 2].map((i) => {
                        const angle = (i / 3) * Math.PI * 2;
                        return (
                            <mesh key={i} position={[Math.cos(angle) * 0.32, Math.sin(angle) * 0.18, Math.sin(angle) * 0.32]}>
                                <sphereGeometry args={[0.03, 8, 8]} />
                                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.2} toneMapped={false} />
                            </mesh>
                        );
                    })}
                </group>
                <pointLight color="#11B8EA" intensity={0.65} distance={2.5} />
            </group>
        </Float>
    );
}

// ─── Full Stack Architecture (Full Stack Dev service) ───
// Represents: 3-tier web architecture — Database → API → UI Dashboard
function FullStackArch({ position }: { position: [number, number, number] }) {
    const barHeights: [number, number, number, number] = [0.08, 0.13, 0.06, 0.10];
    const barColors: [string, string, string, string] = ["#11B8EA", "#3B6AE8", "#22c55e", "#11B8EA"];

    return (
        <Float speed={0.8} floatIntensity={0.12} rotationIntensity={0.06}>
            <group position={position} rotation={[0, 0.3, 0]}>
                {/* DB layer */}
                <group position={[0, -0.46, 0]}>
                    <mesh castShadow>
                        <cylinderGeometry args={[0.22, 0.22, 0.10, 24]} />
                        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.3} />
                    </mesh>
                    <mesh position={[0, 0.06, 0]}>
                        <cylinderGeometry args={[0.22, 0.22, 0.018, 24]} />
                        <meshStandardMaterial color="#3B6AE8" emissive="#3B6AE8" emissiveIntensity={1.8} toneMapped={false} />
                    </mesh>
                    {([-0.022, 0.022] as const).map((y, i) => (
                        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                            <torusGeometry args={[0.22, 0.004, 6, 32]} />
                            <meshStandardMaterial color="#3B6AE8" emissive="#3B6AE8" emissiveIntensity={1.2} toneMapped={false} />
                        </mesh>
                    ))}
                </group>
                {/* Vertical connector DB → API */}
                <mesh position={[0, -0.235, 0]}>
                    <cylinderGeometry args={[0.005, 0.005, 0.29, 5]} />
                    <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={2} toneMapped={false} transparent opacity={0.6} />
                </mesh>
                {/* API layer */}
                <group position={[0, 0, 0]}>
                    <RoundedBox args={[0.44, 0.24, 0.12]} radius={0.025} smoothness={3}>
                        <meshStandardMaterial color="#111827" metalness={0.7} roughness={0.3} />
                    </RoundedBox>
                    <mesh position={[0, 0.12, 0]}>
                        <boxGeometry args={[0.40, 0.01, 0.10]} />
                        <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={2.5} toneMapped={false} />
                    </mesh>
                    {([-0.13, 0, 0.13] as const).map((x, i) => (
                        <mesh key={i} position={[x, 0, 0.062]}>
                            <circleGeometry args={[0.022, 8]} />
                            <meshStandardMaterial
                                color={i === 1 ? "#22c55e" : "#11B8EA"}
                                emissive={i === 1 ? "#22c55e" : "#11B8EA"}
                                emissiveIntensity={3}
                                toneMapped={false}
                            />
                        </mesh>
                    ))}
                </group>
                {/* Vertical connector API → UI */}
                <mesh position={[0, 0.235, 0]}>
                    <cylinderGeometry args={[0.005, 0.005, 0.29, 5]} />
                    <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={2} toneMapped={false} transparent opacity={0.6} />
                </mesh>
                {/* UI / Dashboard layer */}
                <group position={[0, 0.46, 0]}>
                    <RoundedBox args={[0.52, 0.32, 0.05]} radius={0.02} smoothness={3}>
                        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
                    </RoundedBox>
                    <mesh position={[0, 0, 0.027]}>
                        <planeGeometry args={[0.48, 0.28]} />
                        <meshStandardMaterial color="#0f172a" emissive="#11B8EA" emissiveIntensity={0.15} />
                    </mesh>
                    {/* Mini dashboard bar chart */}
                    {barHeights.map((h, i) => (
                        <mesh key={i} position={[-0.14 + i * 0.1, -0.04, 0.029]}>
                            <boxGeometry args={[0.055, h, 0.002]} />
                            <meshStandardMaterial color={barColors[i]} emissive={barColors[i]} emissiveIntensity={2.5} toneMapped={false} />
                        </mesh>
                    ))}
                    {/* Top label line */}
                    <mesh position={[0, 0.09, 0.029]}>
                        <planeGeometry args={[0.35, 0.015]} />
                        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} toneMapped={false} transparent opacity={0.5} />
                    </mesh>
                </group>
                <pointLight color="#3B6AE8" intensity={0.4} distance={2.2} />
            </group>
        </Float>
    );
}

// --- Dhananjay Character (removed — will be replaced with a proper GLB model) ---
function DhananjayCharacter({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
    return (
        <group position={position} rotation={rotation ?? [0, 0, 0]} scale={1.6}>

        </group>
    );
}

// --- Main HeroModel Component ---
export default function HeroModel() {
    const groupRef = useRef<THREE.Group>(null);
    const floatRef = useRef<THREE.Group>(null);

    const archShape = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(-1.5, -2);
        shape.lineTo(1.5, -2);
        shape.lineTo(1.5, 1);
        shape.absarc(0, 1, 1.5, 0, Math.PI, false);
        shape.lineTo(-1.5, -2);
        const hole = new THREE.Path();
        hole.moveTo(1.0, -2);
        hole.lineTo(1.0, 1);
        hole.absarc(0, 1, 1.0, 0, Math.PI, false);
        hole.lineTo(-1.0, -2);
        hole.lineTo(1.0, -2);
        shape.holes.push(hole);
        return shape;
    }, []);

    const archExtrudeSettings = useMemo(() => ({
        depth: 0.8,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05,
        curveSegments: 64,
    }), []);

    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.05;
        }
        if (floatRef.current) {
            floatRef.current.position.y = 2.4 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
        }
    });

    return (
        <group ref={groupRef} position={[0, -2, -15]}>

            {/* 1. Base Stage */}
            <mesh position={[0, -0.2, 0]} receiveShadow castShadow>
                <cylinderGeometry args={[4.5, 4.5, 0.4, 64]} />
                <meshStandardMaterial color="#0A1628" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0, 0.5]} receiveShadow castShadow>
                <cylinderGeometry args={[3.8, 3.8, 0.2, 64]} />
                <meshStandardMaterial color="#3B6AE8" roughness={0.4} />
            </mesh>

            {/* 2. AI Server Rack (left side) */}
            <AIServerRack position={[-2.2, 1.3, 0.5]} rotation={[0, Math.PI / 5, 0]} />

            {/* 3. The Arch (Right Rear) */}
            <mesh position={[1.5, 0.1, -1.0]} castShadow receiveShadow>
                <extrudeGeometry args={[archShape, archExtrudeSettings]} />
                <meshStandardMaterial color="#3B6AE8" roughness={0.3} metalness={0.1} />
            </mesh>

            {/* 4. Center Black Pedestal & Glass Dome */}
            <group position={[0, 0.1, 0.5]}>
                <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.5, 1.6, 1.5]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.1} />
                </mesh>

                {/* Floating Orb inside dome */}
                <group ref={floatRef} position={[0, 2.4, 0]}>
                    <mesh castShadow={false} receiveShadow={false}>
                        <sphereGeometry args={[0.28, 64, 64]} />
                        <meshPhysicalMaterial
                            color="#11B8EA"
                            transparent={true}
                            opacity={0.65}
                            roughness={0.05}
                            metalness={0.2}
                            clearcoat={1}
                            clearcoatRoughness={0.05}
                            emissive="#0a5a8a"
                            emissiveIntensity={0.3}
                            depthWrite={false}
                        />
                    </mesh>
                    <Center>
                        <Text3D
                            font="/fonts/optimer_bold.typeface.json"
                            size={0.15}
                            height={0.03}
                            curveSegments={16}
                            bevelEnabled
                            bevelThickness={0.008}
                            bevelSize={0.008}
                            bevelOffset={0}
                            bevelSegments={4}
                        >
                            SI
                            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.5} toneMapped={false} />
                        </Text3D>
                    </Center>
                    <pointLight color="#11B8EA" intensity={0.6} distance={3} />
                </group>

                {/* Glass Dome */}
                <mesh position={[0, 2.4, 0]} castShadow>
                    <capsuleGeometry args={[0.7, 1.0, 32, 64]} />
                    <MeshTransmissionMaterial
                        backside
                        samples={4}
                        thickness={0.2}
                        chromaticAberration={0.02}
                        anisotropy={0}
                        distortion={0}
                        distortionScale={0}
                        temporalDistortion={0.0}
                        color="#ffffff"
                        transmission={0.9}
                        roughness={0.05}
                    />
                </mesh>
            </group>

            {/* 5. The Golden Earth on Metallic Stand */}
            <group position={[3.0, 0.2, 1.5]}>
                <mesh position={[0, 0, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.35, 0.4, 0.05, 32]} />
                    <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.25, 0]} castShadow>
                    <cylinderGeometry args={[0.03, 0.1, 0.45, 16]} />
                    <meshStandardMaterial color="#aaaaaa" metalness={0.95} roughness={0.05} />
                </mesh>
                <mesh position={[0, 0.48, 0]} castShadow>
                    <cylinderGeometry args={[0.12, 0.12, 0.03, 32]} />
                    <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.15} />
                </mesh>
                <mesh position={[0, 0.56, 0]} castShadow>
                    <torusGeometry args={[0.26, 0.035, 16, 64]} />
                    <meshStandardMaterial color="#cccccc" metalness={0.98} roughness={0.05} />
                </mesh>
                <group position={[0, 1.1, 0]}>
                    <GoldenGlobe />
                </group>
            </group>

            {/* 6. Professional Workstation */}
            <ProfessionalWorkstation position={[-0.8, 0.2, 2.2]} rotation={[0, 0.4, 0]} />

            {/* 7. AI Terminal (replaces Cinema Camera) */}
            <AITerminal position={[1.5, 1.5, 1.8]} rotation={[0, -0.5, 0]} />

            {/* 8. Floating 3D Service Cards */}
            <FloatingServiceCards />

            {/* 9. Full Stack Dev — left outer edge, stage level */}
            <FullStackArch position={[-3.4, 0.9, 0.4]} />

            {/* 10. AI Automation — front centre, past workstation */}
            <WorkflowDiagram position={[0.0, 1.0, 3.2]} />

            {/* 11. AI Integration — right outer edge, stage level */}
            <LLMOrbital position={[3.5, 0.9, 0.2]} />

        </group>
    );
}
