"use client";

import * as THREE from "three";
import { Float, RoundedBox, Text } from "@react-three/drei";
import { useCardTextStore } from "@/store/useCardTextStore";
import { useMemo } from "react";

const EMBLEM_MATERIAL = (
    <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={0.3}
        metalness={1.0}
        roughness={0.05}
    />
);

// Gear / Cog — AI Automation
function AutomationEmblem({ scale = 1 }: { scale?: number }) {
    return (
        <group scale={scale * 0.45}>
            {/* Center disc */}
            <mesh>
                <cylinderGeometry args={[0.18, 0.18, 0.08, 32]} />
                <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={1.5} />
            </mesh>
            {/* Teeth */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
                const angle = (i / 6) * Math.PI * 2;
                return (
                    <mesh key={i} position={[0.32 * Math.cos(angle), 0, 0.32 * Math.sin(angle)]} rotation={[0, angle, 0]}>
                        <boxGeometry args={[0.12, 0.08, 0.12]} />
                        {EMBLEM_MATERIAL}
                    </mesh>
                );
            })}
            {/* Inner hole ring */}
            <mesh>
                <torusGeometry args={[0.09, 0.03, 8, 16]} />
                <meshStandardMaterial color="#0a1628" />
            </mesh>
        </group>
    );
}

// Code brackets — Full Stack
function FullStackEmblem({ scale = 1 }: { scale?: number }) {
    return (
        <group scale={scale * 0.45}>
            {/* < */}
            <mesh position={[-0.22, 0.1, 0]} rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.05, 0.28, 0.08]} />
                {EMBLEM_MATERIAL}
            </mesh>
            <mesh position={[-0.22, -0.1, 0]} rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.05, 0.28, 0.08]} />
                {EMBLEM_MATERIAL}
            </mesh>
            {/* > */}
            <mesh position={[0.22, 0.1, 0]} rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.05, 0.28, 0.08]} />
                {EMBLEM_MATERIAL}
            </mesh>
            <mesh position={[0.22, -0.1, 0]} rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.05, 0.28, 0.08]} />
                {EMBLEM_MATERIAL}
            </mesh>
            {/* / slash */}
            <mesh rotation={[0, 0, -0.5]}>
                <boxGeometry args={[0.05, 0.38, 0.08]} />
                <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={1.5} />
            </mesh>
        </group>
    );
}

// Neural nodes — AI Integration
function AIEmblem({ scale = 1 }: { scale?: number }) {
    return (
        <group scale={scale * 0.45}>
            {/* Center node */}
            <mesh>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshStandardMaterial color="#11B8EA" emissive="#11B8EA" emissiveIntensity={2} />
            </mesh>
            {/* Outer nodes */}
            {[0, 1, 2, 3, 4].map((i) => {
                const angle = (i / 5) * Math.PI * 2;
                const x = 0.32 * Math.cos(angle);
                const y = 0.32 * Math.sin(angle);
                return (
                    <group key={i}>
                        <mesh position={[x, y, 0]}>
                            <sphereGeometry args={[0.07, 12, 12]} />
                            {EMBLEM_MATERIAL}
                        </mesh>
                    </group>
                );
            })}
            {/* Orbit ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.32, 0.015, 8, 48]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.35} />
            </mesh>
        </group>
    );
}

const cardsData = [
    {
        title: "AI Automation",
        description: "Workflows automated, 100+ hours saved monthly",
        position: [-4.0, 3.5, -5.0] as [number, number, number],
        rotation: [0.1, 0.5, 0] as [number, number, number],
        delay: 0,
    },
    {
        title: "Full Stack Dev",
        description: "Web apps, APIs, dashboards built to scale",
        position: [0, 4.5, -6.5] as [number, number, number],
        rotation: [0.1, 0, 0] as [number, number, number],
        delay: 0.5,
    },
    {
        title: "AI Integration",
        description: "LLMs & custom models, integrated seamlessly",
        position: [4.0, 3.5, -5.0] as [number, number, number],
        rotation: [0.1, -0.5, 0] as [number, number, number],
        delay: 1,
    }
];

interface CardProps {
    data: typeof cardsData[0];
}

function Card({ data }: CardProps) {
    const {
        titleScale, descScale, cardScale, cardY, descLineSpacing, emblemScale, emblemY,
        titleX, titleY, titleZ,
        descX, descY, descZ,
        iconX, iconY, iconZ,
        cardThickness
    } = useCardTextStore();

    const w = cardScale;
    const h = cardScale;
    const d = cardThickness;

    const colors = useMemo(() => {
        if (data.title === "AI Automation") return ["#0a0f1e", "#11B8EA", "#7dd3fc"];
        if (data.title === "Full Stack Dev") return ["#0f172a", "#3B6AE8", "#93c5fd"];
        if (data.title === "AI Integration") return ["#0c0a1e", "#6d28d9", "#11B8EA"];
        return ["#0a0f1e", "#11B8EA", "#7dd3fc"];
    }, [data.title]);

    const customMaterial = useMemo(() => {
        const mat = new THREE.MeshPhysicalMaterial({
            metalness: 0.5,
            roughness: 0.15,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.5,
        });

        mat.onBeforeCompile = (shader) => {
            shader.uniforms.color1 = { value: new THREE.Color(colors[0]) };
            shader.uniforms.color2 = { value: new THREE.Color(colors[1]) };
            shader.uniforms.color3 = { value: new THREE.Color(colors[2]) };

            shader.vertexShader = `
                varying vec2 vMyUv;
                ${shader.vertexShader}
            `.replace(
                `#include <uv_vertex>`,
                `#include <uv_vertex>
                 vMyUv = uv;`
            );

            shader.fragmentShader = `
                uniform vec3 color1;
                uniform vec3 color2;
                uniform vec3 color3;
                varying vec2 vMyUv;
                ${shader.fragmentShader}
            `.replace(
                `vec4 diffuseColor = vec4( diffuse, opacity );`,
                `
                float mixVal = clamp((vMyUv.x + vMyUv.y) * 0.5, 0.0, 1.0);
                vec3 grad = mix(color1, color2, smoothstep(0.0, 0.6, mixVal));
                grad = mix(grad, color3, smoothstep(0.4, 1.0, mixVal));
                vec4 diffuseColor = vec4( grad, opacity );
                `
            );
        };
        return mat;
    }, [colors]);

    return (
        <Float
            position={[data.position[0], data.position[1] + cardY, data.position[2]]}
            rotation={data.rotation}
            speed={2}
            rotationIntensity={0.1}
            floatIntensity={0.2}
        >
            <group scale={2.5}>
                <RoundedBox args={[w, h, d]} radius={0.08} smoothness={4} material={customMaterial} />

                <group position={[0, 0, d / 2 + 0.02]}>
                    <group position={[iconX, 0.3 + (emblemY - 0.35) + iconY, iconZ]}>
                        {data.title === "AI Automation" && <AutomationEmblem scale={emblemScale} />}
                        {data.title === "Full Stack Dev" && <FullStackEmblem scale={emblemScale} />}
                        {data.title === "AI Integration" && <AIEmblem scale={emblemScale} />}
                    </group>

                    <Text
                        position={[titleX, 0.12 + titleY, titleZ]}
                        fontSize={0.065 * titleScale}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                        textAlign="center"
                    >
                        {data.title.toUpperCase()}
                        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.5} />
                    </Text>

                    <group position={[descX, -0.06 + descY, descZ]}>
                        <Text
                            position={[0, 0, 0]}
                            fontSize={0.024 * descScale}
                            color="#ffffff"
                            anchorX="center"
                            anchorY="middle"
                            textAlign="center"
                            maxWidth={w * 0.8}
                        >
                            {data.description.split(",")[0].trim()}
                        </Text>
                        <Text
                            position={[0, -0.06 * descLineSpacing, 0]}
                            fontSize={0.024 * descScale}
                            color="#ffffff"
                            anchorX="center"
                            anchorY="middle"
                            textAlign="center"
                            maxWidth={w * 0.8}
                        >
                            {data.description.includes(",") ? data.description.split(",").slice(1).join(",").trim() : ""}
                        </Text>
                    </group>
                </group>
            </group>
        </Float>
    );
}

export default function FloatingServiceCards() {
    return (
        <group>
            {cardsData.map((card, idx) => (
                <Card key={idx} data={card} />
            ))}
        </group>
    );
}
