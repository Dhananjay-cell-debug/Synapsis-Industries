"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useState, useRef } from "react";
import { Html } from "@react-three/drei";
import { useTextStore } from "@/store/useTextStore";
import HeroModel from "./HeroModel";
import Overlay from "@/components/dom/Overlay";

export default function Scene({ groundColor = "#11B8EA", bgColor = "#0A0F1E" }: { groundColor?: string, bgColor?: string }) {
    // Text calibration state mapping
    const { x, y, z, scale, distanceFactor } = useTextStore();

    // Gate calibration state mapping
    const [gateConfig, setGateConfig] = useState({
        x: 0,
        y: -3.8, // Defaulting a bit lower based on previous adjustments
        scaleX: 0.95,
        scaleY: 1.0
    });

    const htmlRef = useRef<HTMLDivElement>(null);

    useFrame((state) => {
        if (htmlRef.current) {
            // Smoothly fade out the text when the camera moves past it (z < 2)
            // OR if the user has scrolled significantly down the page
            const scrollPercent = typeof window !== 'undefined' ? window.scrollY / window.innerHeight : 0;
            const isScrolledPast = scrollPercent > 0.4;
            const isBehind = state.camera.position.z < z + 0.5 || isScrolledPast;
            htmlRef.current.style.opacity = isBehind ? "0" : "1";
            htmlRef.current.style.transition = "opacity 0.5s ease-out";
            htmlRef.current.style.pointerEvents = isBehind ? "none" : "auto";
        }
    });

    return (
        <>
            <color attach="background" args={[bgColor]} />

            {/* Cool ambient — slightly blue-white, sets the tone */}
            <ambientLight intensity={1.2} color="#C8D8F0" />

            {/* KEY light — cool-white from upper-right */}
            <directionalLight
                position={[6, 8, 8]}
                intensity={1.2}
                color="#E0EEFF"
            />

            {/* FILL light — brand azure from left */}
            <directionalLight position={[-5, 3, 6]} intensity={0.5} color="#11B8EA" />

            {/* RIM light — royal blue backlight for edge definition */}
            <directionalLight position={[0, 5, -5]} intensity={0.3} color="#3B6AE8" />

            {/* Ground Floor */}
            <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color={groundColor} roughness={0.85} />
            </mesh>

            {/* Typography Anchored in 3D Space (Live Calibration Enabled!) */}
            <Html
                ref={htmlRef}
                transform
                position={[x, y, z]} // Controlled purely by the Zustand Store sliders!
                scale={scale === 0 ? undefined : scale} // Allow math scale directly, disable if 0
                distanceFactor={distanceFactor === 0 ? undefined : distanceFactor} // Allow exact distance scaling, disable if 0
                zIndexRange={[100, 0]}
            >
                <Overlay />
            </Html>

            {/* Draco Loader Ready Hero Model */}
            <HeroModel />
        </>
    );
}
