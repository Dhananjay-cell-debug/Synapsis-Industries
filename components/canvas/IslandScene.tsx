"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky, Cloud } from "@react-three/drei";
import * as THREE from "three";
import type { IslandConfig } from "@/components/dom/IslandEditorPanel";

// ── Read live config ──
function getCfg(): IslandConfig {
    if (typeof window !== "undefined" && (window as any).__islandConfig) {
        return (window as any).__islandConfig;
    }
    return {
        ocean: { x: 0, y: -9.85, z: 60, scale: 2.83 },
        island: { x: 22.55, y: -7.2, z: -5.25, scale: 2.12 },
        mountain: { x: -18.1, y: -5.85, z: -100, scale: 2.85 },
        char: { x: -1.9, y: 2.25, z: -2.35, scale: 1.63 },
        pose: {
            bodyLean: 18, headY: -20, headX: 4,
            leftArmX: -16, leftArmZ: 80, leftElbow: 44,
            rightArmX: -66, rightArmZ: -80, rightElbow: 38,
            leftLegX: -11, rightLegX: 0,
        },
    };
}

// ─────────────────────────────────────────────
//  REALISTIC OCEAN
//  Layered sine waves + Fresnel color blend + env reflections
// ─────────────────────────────────────────────
function Ocean() {
    const meshRef = useRef<THREE.Mesh>(null);
    const geo = useMemo(() => new THREE.PlaneGeometry(250, 250, 120, 120), []);

    const mat = useMemo(() => new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1a8fcc"),
        roughness: 0.08,
        metalness: 0.45,
        transparent: true,
        opacity: 0.92,
    }), []);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const cfg = getCfg();
        const t = clock.getElapsedTime();
        const pos = meshRef.current.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z =
                Math.sin(x * 0.18 + t * 0.9) * 0.38 +
                Math.sin(y * 0.14 + t * 0.7) * 0.24 +
                Math.sin((x + y) * 0.10 + t * 0.55) * 0.15 +
                Math.sin(x * 0.40 + t * 1.4) * 0.08;
            pos.setZ(i, z);
        }
        pos.needsUpdate = true;
        meshRef.current.geometry.computeVertexNormals();
        meshRef.current.position.set(cfg.ocean.x, cfg.ocean.y, cfg.ocean.z);
        meshRef.current.scale.setScalar(cfg.ocean.scale ?? 1);
    });

    return <mesh ref={meshRef} geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />;
}

// ─────────────────────────────────────────────
//  GROUND PLANE (follows ocean Y)
// ─────────────────────────────────────────────
function GroundPlane() {
    const ref = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (!ref.current) return;
        ref.current.position.y = getCfg().ocean.y - 2.0;
    });
    return (
        <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial color="#00426e" roughness={0.3} metalness={0.2} />
        </mesh>
    );
}

// ─────────────────────────────────────────────
//  ISLAND PLATFORM  — layered sands + light subsurface scatter
// ─────────────────────────────────────────────
function IslandPlatform() {
    return (
        <group>
            {/* Base rock layer */}
            <mesh receiveShadow castShadow position={[0, -0.9, 0]}>
                <cylinderGeometry args={[5.8, 7.2, 1.2, 24]} />
                <meshStandardMaterial color="#9e8c70" roughness={0.9} metalness={0.0} />
            </mesh>
            {/* Main sand body */}
            <mesh receiveShadow castShadow>
                <cylinderGeometry args={[5.5, 6.0, 1.0, 32]} />
                <meshStandardMaterial color="#c8a96e" roughness={0.92} metalness={0.0} />
            </mesh>
            {/* Bright dry sand top */}
            <mesh position={[0, 0.52, 0]} receiveShadow>
                <cylinderGeometry args={[4.8, 5.5, 0.32, 32]} />
                <meshStandardMaterial color="#e8d5a3" roughness={0.88} metalness={0.0} />
            </mesh>
            {/* Wet shoreline ring — darker, slightly glossy */}
            <mesh position={[0, -0.42, 0]} receiveShadow>
                <cylinderGeometry args={[6.2, 7.0, 0.18, 32]} />
                <meshStandardMaterial color="#a08850" roughness={0.75} metalness={0.05} transparent opacity={0.8} />
            </mesh>
            {/* Subtle sand ripple rings */}
            {[5.0, 5.6].map((r, i) => (
                <mesh key={i} position={[0, 0.45 - i * 0.05, 0]} receiveShadow>
                    <cylinderGeometry args={[r, r + 0.1, 0.04, 64]} />
                    <meshStandardMaterial color="#d4b87a" roughness={0.9} />
                </mesh>
            ))}
        </group>
    );
}

// ─────────────────────────────────────────────
//  PALM TREE  — realistic tapered trunk + layered fan fronds
// ─────────────────────────────────────────────
function PalmTree({ pos, scale = 1, lean = 0, leanDir = 0 }: {
    pos: [number, number, number]; scale?: number; lean?: number; leanDir?: number;
}) {
    const trunkSegments = 12;
    const frondCount = 9;

    return (
        <group position={pos} scale={scale} rotation={[lean * Math.cos(leanDir), leanDir, lean * Math.sin(leanDir)]}>
            {/* Segmented trunk (taper + curve) */}
            {Array.from({ length: trunkSegments }).map((_, i) => {
                const t = i / trunkSegments;
                const yBot = t * 5.8;
                const yTop = (i + 1) / trunkSegments * 5.8;
                const rBot = 0.28 - t * 0.12;
                const rTop = 0.28 - (t + 1 / trunkSegments) * 0.12;
                const bendX = Math.sin(t * 0.6) * lean * 0.15;
                return (
                    <mesh key={i} position={[bendX, (yBot + yTop) / 2, 0]} castShadow>
                        <cylinderGeometry args={[rTop, rBot, yTop - yBot, 9]} />
                        <meshStandardMaterial
                            color={new THREE.Color().setHSL(0.08, 0.55, 0.32 + i * 0.012)}
                            roughness={0.95} metalness={0.0}
                        />
                    </mesh>
                );
            })}

            {/* Crown fronds */}
            <group position={[0, 6.0, 0]}>
                {Array.from({ length: frondCount }).map((_, i) => {
                    const angle = (i / frondCount) * Math.PI * 2;
                    const droop = -0.42 - (i % 3) * 0.08;
                    const frondLen = 2.6 + (i % 2) * 0.4;
                    // Each frond: a row of overlapping leaf planes
                    return (
                        <group key={i} rotation={[0, angle, 0]}>
                            <group rotation={[droop, 0, 0]} position={[frondLen * 0.5, -0.1, 0]}>
                                {/* Main leaf blade — thin box */}
                                <mesh castShadow>
                                    <boxGeometry args={[frondLen, 0.04, 0.55 + (i % 2) * 0.1]} />
                                    <meshStandardMaterial
                                        color={new THREE.Color().setHSL(0.32 - i * 0.008, 0.72, 0.28)}
                                        roughness={0.75} metalness={0.0}
                                        side={THREE.DoubleSide}
                                    />
                                </mesh>
                                {/* Spine darker stripe */}
                                <mesh position={[0, 0.03, 0]} castShadow>
                                    <boxGeometry args={[frondLen, 0.03, 0.06]} />
                                    <meshStandardMaterial color="#1a4a1a" roughness={0.8} side={THREE.DoubleSide} />
                                </mesh>
                                {/* Sub-leaflets alternating */}
                                {[-0.2, -0.08, 0.08, 0.20].map((z, j) => (
                                    <mesh key={j} position={[(j - 1.5) * (frondLen * 0.25), 0.01, z * 0.9]} rotation={[0.1, 0, (j - 1.5) * -0.12]} castShadow>
                                        <boxGeometry args={[frondLen * 0.45, 0.03, 0.18]} />
                                        <meshStandardMaterial
                                            color={new THREE.Color().setHSL(0.33 - j * 0.01, 0.65, 0.30)}
                                            roughness={0.8} side={THREE.DoubleSide}
                                        />
                                    </mesh>
                                ))}
                            </group>
                        </group>
                    );
                })}

                {/* Coconut cluster at crown */}
                {[0, 0.9, 1.8, 2.7, 3.6].map((a, i) => (
                    <mesh key={i} position={[Math.cos(a) * 0.32, -0.42, Math.sin(a) * 0.32]} castShadow>
                        <sphereGeometry args={[0.20, 14, 10]} />
                        <meshStandardMaterial color={i < 2 ? "#3d7a2a" : "#5C3D11"} roughness={0.88} />
                    </mesh>
                ))}
            </group>
        </group>
    );
}

// ─────────────────────────────────────────────
//  LOW SCRUB BUSHES  — volume fill around base
// ─────────────────────────────────────────────
function Scrub({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <mesh castShadow>
                <sphereGeometry args={[0.45, 10, 8]} />
                <meshStandardMaterial color="#2d6e2d" roughness={0.9} />
            </mesh>
            <mesh position={[0.3, 0.1, -0.2]} castShadow>
                <sphereGeometry args={[0.3, 8, 7]} />
                <meshStandardMaterial color="#3a8a3a" roughness={0.9} />
            </mesh>
        </group>
    );
}

// ─────────────────────────────────────────────
//  SUIT CHARACTER  — full 3D rigged humanoid
//  Black suit, white mask, heavyset build
//  Each joint reads from getCfg().pose for live control
// ─────────────────────────────────────────────

const DEG = Math.PI / 180;

// Materials (defined once)
const MAT = {
    suit: new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.6, metalness: 0.1 }),
    shirt: new THREE.MeshStandardMaterial({ color: "#f0f0f0", roughness: 0.5 }),
    tie: new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.4, metalness: 0.2 }),
    skin: new THREE.MeshStandardMaterial({ color: "#c68a5a", roughness: 0.75 }),
    mask: new THREE.MeshStandardMaterial({ color: "#f5f3f0", roughness: 0.25, metalness: 0.05 }),
    hair: new THREE.MeshStandardMaterial({ color: "#1a0a00", roughness: 0.9 }),
    shoe: new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.4, metalness: 0.3 }),
    lapel: new THREE.MeshStandardMaterial({ color: "#181818", roughness: 0.55 }),
};

function SuitCharacter() {
    // Joint refs for animation
    const rootRef = useRef<THREE.Group>(null);
    const spineRef = useRef<THREE.Group>(null);
    const headRef = useRef<THREE.Group>(null);
    const lArmRef = useRef<THREE.Group>(null);
    const lForeRef = useRef<THREE.Group>(null);
    const rArmRef = useRef<THREE.Group>(null);
    const rForeRef = useRef<THREE.Group>(null);
    const lThighRef = useRef<THREE.Group>(null);
    const rThighRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        const cfg = getCfg();
        const p = cfg.pose;
        const t = clock.getElapsedTime();

        // Idle breathing
        if (spineRef.current) {
            spineRef.current.rotation.x = p.bodyLean * DEG + Math.sin(t * 0.7) * 0.008;
        }
        if (headRef.current) {
            headRef.current.rotation.y = p.headY * DEG;
            headRef.current.rotation.x = p.headX * DEG;
        }
        // Left arm
        if (lArmRef.current) {
            lArmRef.current.rotation.x = p.leftArmX * DEG;
            lArmRef.current.rotation.z = p.leftArmZ * DEG;
        }
        if (lForeRef.current) lForeRef.current.rotation.x = -p.leftElbow * DEG;
        // Right arm
        if (rArmRef.current) {
            rArmRef.current.rotation.x = p.rightArmX * DEG;
            rArmRef.current.rotation.z = p.rightArmZ * DEG;
        }
        if (rForeRef.current) rForeRef.current.rotation.x = -p.rightElbow * DEG;
        // Legs
        if (lThighRef.current) lThighRef.current.rotation.x = p.leftLegX * DEG;
        if (rThighRef.current) rThighRef.current.rotation.x = p.rightLegX * DEG;

        // Position from char config
        if (rootRef.current) {
            const c = cfg.char;
            rootRef.current.position.set(c.x, c.y, c.z);
            rootRef.current.scale.setScalar(c.scale);
        }
    });

    return (
        <group ref={rootRef} position={[-0.5, 0.68, 1.0]}>
            {/* ── LEGS ── */}
            {/* Left thigh → calf → shoe */}
            <group ref={lThighRef} position={[0.18, 0.0, 0]}>
                <mesh castShadow material={MAT.suit} position={[0, -0.22, 0]}>
                    <cylinderGeometry args={[0.14, 0.12, 0.44, 10]} />
                </mesh>
                {/* knee */}
                <mesh castShadow material={MAT.suit} position={[0, -0.44, 0]}>
                    <sphereGeometry args={[0.115, 10, 8]} />
                </mesh>
                {/* calf */}
                <mesh castShadow material={MAT.suit} position={[0, -0.67, 0]}>
                    <cylinderGeometry args={[0.105, 0.09, 0.42, 10]} />
                </mesh>
                {/* shoe */}
                <mesh castShadow material={MAT.shoe} position={[0.04, -0.93, 0.06]} rotation={[-0.08, 0, 0]}>
                    <boxGeometry args={[0.16, 0.09, 0.30]} />
                </mesh>
            </group>
            {/* Right thigh → calf → shoe */}
            <group ref={rThighRef} position={[-0.18, 0.0, 0]}>
                <mesh castShadow material={MAT.suit} position={[0, -0.22, 0]}>
                    <cylinderGeometry args={[0.14, 0.12, 0.44, 10]} />
                </mesh>
                <mesh castShadow material={MAT.suit} position={[0, -0.44, 0]}>
                    <sphereGeometry args={[0.115, 10, 8]} />
                </mesh>
                <mesh castShadow material={MAT.suit} position={[0, -0.67, 0]}>
                    <cylinderGeometry args={[0.105, 0.09, 0.42, 10]} />
                </mesh>
                <mesh castShadow material={MAT.shoe} position={[-0.04, -0.93, 0.06]} rotation={[-0.08, 0, 0]}>
                    <boxGeometry args={[0.16, 0.09, 0.30]} />
                </mesh>
            </group>

            {/* ── HIPS / BELT ── */}
            <mesh castShadow material={MAT.suit} position={[0, 0.06, 0]}>
                <cylinderGeometry args={[0.29, 0.32, 0.22, 14]} />
            </mesh>
            <mesh material={MAT.lapel} position={[0, 0.17, 0.22]}>
                <boxGeometry args={[0.42, 0.06, 0.02]} />
            </mesh>

            {/* ── SPINE (rotates for body lean) ── */}
            <group ref={spineRef} position={[0, 0.18, 0]}>

                {/* Torso main — slightly pear-shaped (heavyset) */}
                <mesh castShadow material={MAT.suit} position={[0, 0.38, 0]}>
                    <cylinderGeometry args={[0.30, 0.33, 0.76, 16]} />
                </mesh>

                {/* White shirt front panel */}
                <mesh material={MAT.shirt} position={[0, 0.42, 0.295]}>
                    <boxGeometry args={[0.22, 0.52, 0.02]} />
                </mesh>
                {/* Tie */}
                <mesh material={MAT.tie} position={[0, 0.44, 0.31]} rotation={[0.05, 0, 0]}>
                    <boxGeometry args={[0.055, 0.44, 0.015]} />
                </mesh>
                {/* Jacket buttons */}
                {[-0.08, 0.04, 0.16].map((y, i) => (
                    <mesh key={i} material={MAT.lapel} position={[0, y + 0.32, 0.30]}>
                        <sphereGeometry args={[0.018, 8, 6]} />
                    </mesh>
                ))}
                {/* Left lapel */}
                <mesh castShadow material={MAT.lapel} position={[0.16, 0.65, 0.24]} rotation={[0, 0, -0.35]}>
                    <boxGeometry args={[0.12, 0.22, 0.04]} />
                </mesh>
                {/* Right lapel */}
                <mesh castShadow material={MAT.lapel} position={[-0.16, 0.65, 0.24]} rotation={[0, 0, 0.35]}>
                    <boxGeometry args={[0.12, 0.22, 0.04]} />
                </mesh>
                {/* Shoulder pads */}
                <mesh castShadow material={MAT.suit} position={[0.33, 0.68, 0]}>
                    <sphereGeometry args={[0.155, 10, 8]} />
                </mesh>
                <mesh castShadow material={MAT.suit} position={[-0.33, 0.68, 0]}>
                    <sphereGeometry args={[0.155, 10, 8]} />
                </mesh>

                {/* ── LEFT ARM (pivot at shoulder) ── */}
                <group ref={lArmRef} position={[0.34, 0.68, 0]}>
                    {/* upper arm */}
                    <mesh castShadow material={MAT.suit} position={[0, -0.18, 0]}>
                        <cylinderGeometry args={[0.105, 0.09, 0.36, 9]} />
                    </mesh>
                    {/* elbow sphere */}
                    <mesh castShadow material={MAT.suit} position={[0, -0.36, 0]}>
                        <sphereGeometry args={[0.09, 9, 7]} />
                    </mesh>
                    {/* forearm pivot at elbow */}
                    <group ref={lForeRef} position={[0, -0.36, 0]}>
                        <mesh castShadow material={MAT.suit} position={[0, -0.17, 0]}>
                            <cylinderGeometry args={[0.086, 0.072, 0.32, 9]} />
                        </mesh>
                        {/* cuff */}
                        <mesh castShadow material={MAT.shirt} position={[0, -0.33, 0]}>
                            <cylinderGeometry args={[0.078, 0.078, 0.04, 9]} />
                        </mesh>
                        {/* hand */}
                        <mesh castShadow material={MAT.skin} position={[0, -0.42, 0]}>
                            <boxGeometry args={[0.11, 0.14, 0.065]} />
                        </mesh>
                        {/* fingers (4 small boxes) */}
                        {[-0.035, -0.012, 0.012, 0.035].map((x, i) => (
                            <mesh key={i} castShadow material={MAT.skin} position={[x, -0.52, 0]}>
                                <boxGeometry args={[0.02, 0.08, 0.055]} />
                            </mesh>
                        ))}
                        {/* thumb */}
                        <mesh castShadow material={MAT.skin} position={[0.068, -0.44, 0]} rotation={[0, 0, -0.5]}>
                            <boxGeometry args={[0.055, 0.02, 0.045]} />
                        </mesh>
                    </group>
                </group>

                {/* ── RIGHT ARM (pivot at shoulder) ── */}
                <group ref={rArmRef} position={[-0.34, 0.68, 0]}>
                    <mesh castShadow material={MAT.suit} position={[0, -0.18, 0]}>
                        <cylinderGeometry args={[0.105, 0.09, 0.36, 9]} />
                    </mesh>
                    <mesh castShadow material={MAT.suit} position={[0, -0.36, 0]}>
                        <sphereGeometry args={[0.09, 9, 7]} />
                    </mesh>
                    <group ref={rForeRef} position={[0, -0.36, 0]}>
                        <mesh castShadow material={MAT.suit} position={[0, -0.17, 0]}>
                            <cylinderGeometry args={[0.086, 0.072, 0.32, 9]} />
                        </mesh>
                        <mesh castShadow material={MAT.shirt} position={[0, -0.33, 0]}>
                            <cylinderGeometry args={[0.078, 0.078, 0.04, 9]} />
                        </mesh>
                        <mesh castShadow material={MAT.skin} position={[0, -0.42, 0]}>
                            <boxGeometry args={[0.11, 0.14, 0.065]} />
                        </mesh>
                        {[-0.035, -0.012, 0.012, 0.035].map((x, i) => (
                            <mesh key={i} castShadow material={MAT.skin} position={[x, -0.52, 0]}>
                                <boxGeometry args={[0.02, 0.08, 0.055]} />
                            </mesh>
                        ))}
                        <mesh castShadow material={MAT.skin} position={[-0.068, -0.44, 0]} rotation={[0, 0, 0.5]}>
                            <boxGeometry args={[0.055, 0.02, 0.045]} />
                        </mesh>
                    </group>
                </group>

                {/* ── NECK ── */}
                <mesh castShadow material={MAT.skin} position={[0, 0.82, 0]}>
                    <cylinderGeometry args={[0.085, 0.10, 0.16, 10]} />
                </mesh>

                {/* ── HEAD (pivot at neck top) ── */}
                <group ref={headRef} position={[0, 0.96, 0]}>
                    {/* skull — slightly flattened sphere */}
                    <mesh castShadow material={MAT.skin} position={[0, 0.16, 0]} scale={[1, 1.08, 0.95]}>
                        <sphereGeometry args={[0.195, 16, 14]} />
                    </mesh>
                    {/* Hair — dark cap on top */}
                    <mesh castShadow material={MAT.hair} position={[0, 0.27, -0.02]} scale={[1, 0.6, 1]}>
                        <sphereGeometry args={[0.198, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                    </mesh>
                    {/* Beard — chin area */}
                    <mesh material={MAT.hair} position={[0, 0.06, 0.165]} scale={[0.7, 0.4, 0.5]}>
                        <sphereGeometry args={[0.14, 10, 8]} />
                    </mesh>
                    {/* Ears */}
                    <mesh castShadow material={MAT.skin} position={[0.195, 0.15, 0]} scale={[0.35, 0.6, 0.5]}>
                        <sphereGeometry args={[0.09, 8, 6]} />
                    </mesh>
                    <mesh castShadow material={MAT.skin} position={[-0.195, 0.15, 0]} scale={[0.35, 0.6, 0.5]}>
                        <sphereGeometry args={[0.09, 8, 6]} />
                    </mesh>
                    {/* White mask covering face */}
                    <mesh material={MAT.mask} position={[0, 0.15, 0.17]} scale={[1, 1.05, 0.38]}>
                        <sphereGeometry args={[0.20, 16, 14]} />
                    </mesh>
                    {/* Mask eye holes (dark recesses) */}
                    <mesh material={new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 1 })}
                        position={[0.065, 0.185, 0.36]}>
                        <boxGeometry args={[0.055, 0.025, 0.01]} />
                    </mesh>
                    <mesh material={new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 1 })}
                        position={[-0.065, 0.185, 0.36]}>
                        <boxGeometry args={[0.055, 0.025, 0.01]} />
                    </mesh>
                </group>

            </group>
        </group>
    );
}

// ─────────────────────────────────────────────
//  ISLAND GROUP  (island + trees + character move together)
// ─────────────────────────────────────────────
export function IslandGroup() {
    const ref = useRef<THREE.Group>(null);
    useFrame(() => {
        if (!ref.current) return;
        const { island } = getCfg();
        ref.current.position.set(island.x, island.y, island.z);
        ref.current.scale.setScalar(island.scale ?? 1);
    });
    return (
        <group ref={ref} position={[17.4, -7.75, 3.65]}>
            <IslandPlatform />
            {/* Palm trees — placed on island surface (y=0.68 = top of platform) */}
            <PalmTree pos={[-0.8, 0.68, -1.5]} scale={1.10} lean={0.07} leanDir={2.0} />
            <PalmTree pos={[1.8, 0.68, -0.3]} scale={1.30} lean={0.11} leanDir={1.6} />
            <PalmTree pos={[0.3, 0.68, 1.8]} scale={0.95} lean={0.05} leanDir={0.8} />
            <PalmTree pos={[3.0, 0.68, -1.8]} scale={1.05} lean={0.09} leanDir={2.5} />
            <PalmTree pos={[-1.8, 0.68, 1.2]} scale={0.85} lean={0.06} leanDir={0.5} />
            {/* Scrub fill */}
            <Scrub position={[-2.5, 0.68, -0.8]} />
            <Scrub position={[2.2, 0.68, 1.5]} />
            <Scrub position={[1.0, 0.68, -2.5]} />
            <SuitCharacter />
        </group>
    );
}

// legacy alias
export function CharacterPlaceholder() { return <IslandGroup />; }

// ─────────────────────────────────────────────
//  MOUNTAIN ISLAND  — more organic, multi-peak
// ─────────────────────────────────────────────
function MountainIsland() {
    const ref = useRef<THREE.Group>(null);
    useFrame(() => {
        if (!ref.current) return;
        const { mountain } = getCfg();
        ref.current.position.set(mountain.x, mountain.y, mountain.z);
        ref.current.scale.setScalar(mountain.scale ?? 1);
    });
    return (
        <group ref={ref} position={[-21.5, -4.4, -66.9]}>
            {/* Main peak */}
            <mesh castShadow position={[0, 5.5, 0]}>
                <coneGeometry args={[2.8, 9.0, 10]} />
                <meshStandardMaterial color="#5a6375" roughness={0.88} metalness={0.05} />
            </mesh>
            {/* Snow cap */}
            <mesh position={[0, 9.8, 0]}>
                <coneGeometry args={[1.0, 2.0, 9]} />
                <meshStandardMaterial color="#eef2f7" roughness={0.6} metalness={0.0} />
            </mesh>
            {/* Side peak */}
            <mesh castShadow position={[-2.8, 3.5, 1.0]}>
                <coneGeometry args={[1.6, 5.2, 8]} />
                <meshStandardMaterial color="#4d5868" roughness={0.9} metalness={0.0} />
            </mesh>
            {/* Far back ridge */}
            <mesh castShadow position={[1.5, 2.5, -1.2]}>
                <coneGeometry args={[1.2, 3.8, 7]} />
                <meshStandardMaterial color="#444f5e" roughness={0.9} />
            </mesh>
            {/* Green vegetation base */}
            <mesh position={[0, -0.2, 0]} castShadow>
                <cylinderGeometry args={[4.5, 3.5, 1.8, 20]} />
                <meshStandardMaterial color="#2a5e28" roughness={0.9} />
            </mesh>
            {/* Sandy shore ring */}
            <mesh position={[0, -1.05, 0]}>
                <cylinderGeometry args={[5.5, 4.8, 0.42, 20]} />
                <meshStandardMaterial color="#d8c07a" roughness={0.92} />
            </mesh>
        </group>
    );
}

// ─────────────────────────────────────────────
//  ROOT EXPORT
// ─────────────────────────────────────────────
export default function IslandScene() {
    return (
        <>
            {/* Sky — clear tropical afternoon */}
            <Sky
                sunPosition={[5, 4, -12]}
                turbidity={3}
                rayleigh={0.7}
                mieCoefficient={0.004}
                mieDirectionalG={0.82}
                inclination={0.52}
                azimuth={0.22}
            />
            <Cloud position={[-8, 10, -28]} opacity={0.55} speed={0.15} segments={14} />
            <Cloud position={[4, 12, -35]} opacity={0.45} speed={0.1} segments={10} />
            <fog attach="fog" args={["#b8dff0", 40, 110]} />
            <ambientLight intensity={0.65} color="#fff8ec" />
            <directionalLight
                position={[6, 14, 4]}
                intensity={2.5}
                color="#ffe0a0"
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-30}
                shadow-camera-right={30}
                shadow-camera-top={30}
                shadow-camera-bottom={-30}
                shadow-bias={-0.001}
            />
            <directionalLight position={[-8, 3, 5]} intensity={0.7} color="#a8d8f8" />
            <hemisphereLight args={["#87d0ee", "#dcc88a", 0.5]} />
            <Ocean />
            <GroundPlane />
            <IslandGroup />
            <MountainIsland />
        </>
    );
}

