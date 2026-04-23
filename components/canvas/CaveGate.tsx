"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGateStore } from "@/store/useGateStore";

function WallArch({ holeRadius, holeHeight, depth, position, wallColor = "#0A1628", wallEmissive = "#0D1526", wallEmissiveIntensity = 0, layerDepth = 0 }: {
    holeRadius: number, holeHeight: number, depth: number, position: [number, number, number],
    wallColor?: string, wallEmissive?: string, wallEmissiveIntensity?: number, layerDepth?: number
}) {
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        s.moveTo(-50, -20);
        s.lineTo(50, -20);
        s.lineTo(50, 40);
        s.lineTo(-50, 40);
        s.lineTo(-50, -20);

        const hole = new THREE.Path();
        hole.moveTo(holeRadius, -10);
        hole.lineTo(holeRadius, holeHeight);
        hole.absarc(0, holeHeight, holeRadius, 0, Math.PI, false);
        hole.lineTo(-holeRadius, -10);
        hole.lineTo(holeRadius, -10);

        s.holes.push(hole);
        return s;
    }, [holeRadius, holeHeight]);

    const extrudeSettings = useMemo(() => ({
        depth: depth,
        bevelEnabled: false,
        curveSegments: 128,
    }), [depth]);

    // Progressive depth: deeper layers get slightly more emissive and slightly different roughness
    // This creates a natural sense of receding space and atmospheric perspective
    const depthEmissive = wallEmissiveIntensity + (layerDepth * 0.06);
    const depthRoughness = 0.92 - (layerDepth * 0.03); // slightly smoother deeper = subtle sheen

    return (
        <mesh position={position} castShadow receiveShadow>
            <extrudeGeometry args={[shape, extrudeSettings]} />
            <meshStandardMaterial
                color={wallColor}
                roughness={depthRoughness}
                metalness={0.02}
                emissive={wallEmissive}
                emissiveIntensity={depthEmissive}
            />
        </mesh>
    );
}

export default function CaveGate({
    wallColor = "#0A1628", wallEmissive = "#0D1526", wallEmissiveIntensity = 0.08,
}: {
    wallColor?: string, wallEmissive?: string, wallEmissiveIntensity?: number,
}) {
    const groupRef = useRef<THREE.Group>(null);
    const { x, y, scaleX, scaleY } = useGateStore(); // Pulling global coordinate state

    return (
        <group ref={groupRef} position={[x, y, 0]} scale={[scaleX, scaleY, 1]}>

            {/* Ground Floor inside gate group */}
            <mesh position={[0, -0.05, 10]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[200, 200]} />
                <meshStandardMaterial color={wallColor} roughness={0.88} metalness={0.02} />
            </mesh>

            {/* 3 LAYERS — ENTRANCE GATE */}
            <WallArch holeRadius={2.4} holeHeight={3.2} depth={1.01} position={[0, 0, 0]}
                wallColor={wallColor} wallEmissive={wallEmissive} wallEmissiveIntensity={wallEmissiveIntensity} layerDepth={0} />
            <WallArch holeRadius={2.0} holeHeight={3.0} depth={1.01} position={[0, 0, -2.0]}
                wallColor={wallColor} wallEmissive={wallEmissive} wallEmissiveIntensity={wallEmissiveIntensity} layerDepth={1} />
            <WallArch holeRadius={1.6} holeHeight={2.8} depth={1.01} position={[0, 0, -4.0]}
                wallColor={wallColor} wallEmissive={wallEmissive} wallEmissiveIntensity={wallEmissiveIntensity} layerDepth={2} />

            {/* THE HUGE INSIDE HALLWAY ROOM */}
            {/* Placed at Z=-30 with depth=26, this exactly covers Z=-30 to Z=-4, joining seamlessly with the gate */}
            <WallArch holeRadius={21.0} holeHeight={20.0} depth={26.0} position={[0, 0, -30.0]}
                wallColor={wallColor} wallEmissive={wallEmissive} wallEmissiveIntensity={wallEmissiveIntensity} layerDepth={5} />

            {/* Deep Background Wall (End of the Hallway) */}
            <mesh position={[0, 10, -30.0]} receiveShadow>
                <planeGeometry args={[150, 150]} />
                <meshStandardMaterial color={wallColor} roughness={0.95} emissive={wallEmissive} emissiveIntensity={0.15} />
            </mesh>


        </group>
    );
}
