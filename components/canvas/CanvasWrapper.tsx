"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import Scene from "@/components/canvas/Scene";
import CaveGate from "@/components/canvas/CaveGate";
import CameraRig from "@/components/canvas/CameraRig";
import WebGLErrorBoundary from "@/components/canvas/WebGLErrorBoundary";

interface CanvasWrapperProps {
    gateX?: number;
    gateY?: number;
    gateScaleX?: number;
    gateScaleY?: number;
    wallColor?: string;
    wallEmissive?: string;
    wallEmissiveIntensity?: number;
    groundColor?: string;
    bgColor?: string;
}

export default function CanvasWrapper({
    gateX, gateY, gateScaleX, gateScaleY,
    wallColor, wallEmissive, wallEmissiveIntensity,
    groundColor, bgColor,
}: CanvasWrapperProps) {
    return (
        <WebGLErrorBoundary>
            <Canvas
                shadows
                className="w-full h-full"
                camera={{ position: [0, 0, 10], fov: 35 }}
                gl={{ toneMapping: THREE.NoToneMapping, antialias: true, powerPreference: "default", failIfMajorPerformanceCaveat: false }}
            >
                <ambientLight intensity={1} />
                <Suspense fallback={null}>
                    <Scene groundColor={groundColor} bgColor={bgColor} />
                    <CaveGate
                        wallColor={wallColor} wallEmissive={wallEmissive}
                        wallEmissiveIntensity={wallEmissiveIntensity}
                    />
                    <CameraRig />
                </Suspense>
            </Canvas>
        </WebGLErrorBoundary>
    );
}
