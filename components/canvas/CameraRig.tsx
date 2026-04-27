"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRef, useEffect } from "react";

/**
 * SEAMLESS CINEMATIC CAMERA JOURNEY — DYNAMIC ORBIT
 * 
 * Target Z Timeline:
 * 0%  : Z = 10  (Far outside gate entrance)
 * 15% : Z = -5  (10m in front of monument tracking center -15)
 * 70% : Z = -5  (Completed full organic 360° walking orbit)
 * 85% : Z = 10  (Walked back out through gate)
 * 100%: Z = 16  (Walked backwards to reveal content pages)
 * 
 * Orbit Center: (0, -0.5, -15) [Pushed deep to prevent gate clipping]
 * Orbit Radius: Organic fluctuating 8m to 12m
 * 
 * Step Counts:
 * Walk In:   13 steps
 * Orbit:     60 steps (organic wandering)
 * Walk Out:  13 steps
 * Zoom Out:  16 steps
 */

// Easing functions
function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

function mapRange(value: number, start: number, end: number) {
    return Math.max(0, Math.min(1, (value - start) / (end - start)));
}

// Advanced organic walk cycle generator for hyper-realistic movement
function getWalkCycle(t: number, steps: number, bobAmp: number, swayAmp: number) {
    const phase = t * Math.PI * steps;
    // Squaring the sine creates a smooth "U" valley, mimicking natural knee bending instead of sharp bounces
    const y = Math.pow(Math.sin(phase), 2) * bobAmp;
    // Sway is half the frequency of steps
    const x = Math.cos(phase / 2) * swayAmp;
    // Head roll DRASTICALLY reduced — was 0.45, caused visible tilt on real GPUs
    const roll = Math.cos(phase / 2) * (swayAmp * 0.12);
    // Slight look-down on foot impact
    const pitch = -Math.abs(Math.sin(phase)) * (bobAmp * 0.6);
    return { x, y, roll, pitch };
}

export default function CameraRig() {
    const scrollProgress = useRef(0);
    // Use a ref for the look target to allow smooth slerping
    const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
    const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
    const currentRoll = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            // Tie progress STRICTLY to the first 400vh of scrolling
            const journeyHeight = window.innerHeight * 4;
            scrollProgress.current = Math.max(0, Math.min(1, window.scrollY / journeyHeight));
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        // Trigger once to set initial state
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useFrame((state, delta) => {
        const progress = scrollProgress.current;

        if (progress <= 0.001) {
            state.camera.position.set(0, -1, 10);
            targetLookAt.current.set(0, 0, -15);
            currentLookAt.current.copy(targetLookAt.current);
            currentRoll.current = 0;
            state.camera.up.set(0, 1, 0);
            state.camera.lookAt(currentLookAt.current);
            return;
        }

        // ── Broadcast debug info for the overlay panel ──
        if (typeof window !== 'undefined') {
            (window as any).__cameraDebug = {
                x: parseFloat(state.camera.position.x.toFixed(2)),
                y: parseFloat(state.camera.position.y.toFixed(2)),
                z: parseFloat(state.camera.position.z.toFixed(2)),
                scroll: parseFloat((progress * 100).toFixed(1)),
                phase: progress <= 0.15 ? '① Walk In' : progress <= 0.70 ? '② Orbit' : progress <= 0.85 ? '③ Walk Out' : '④ Zoom Out',
            };
        }

        let targetX = 0;
        let targetY = 0;
        let targetZ = 10;

        let lookX = 0;
        let lookY = 0;
        let lookZ = 0;

        let targetRoll = 0;

        // HeroModel is pushed back to [0, -2, -15] to prevent front-gate clipping
        const orbitCenterX = 0;
        const orbitCenterY = -0.5;
        const orbitCenterZ = -15;

        const orbitY = -1; // Walking height

        // ─── Phase 1: WALK IN (0% → 15%) — 13 steps ───
        if (progress <= 0.15) {
            const t = easeInOutCubic(mapRange(progress, 0, 0.15));
            const walk = getWalkCycle(t, 13, 0.04, 0.02); // Gentle, calm walk-in

            // Z=10 (Gate), Ends at Z=-5 (exactly 10 units in front of center -15)
            targetX = walk.x;
            targetZ = 10 - (t * 15); // 10 down to -5
            targetY = orbitY + walk.y;

            lookX = orbitCenterX;
            lookY = t * orbitCenterY + walk.pitch;
            lookZ = orbitCenterZ;

            targetRoll = walk.roll;
        }

        // ─── Phase 2: FULL WALKING ORBIT (15% → 70%) — 60 steps ───
        else if (progress <= 0.70) {
            const t = easeInOutCubic(mapRange(progress, 0.15, 0.70));
            const walk = getWalkCycle(t, 60, 0.04, 0.025); // Calm gentleman orbit

            // Organic half-arc radius: small at start/end (10.5m), peaks in middle (13.5m)
            // This naturally keeps distance from walls at 23.5% and stays clear of objects at 41.3%
            const dynamicRadius = 10.5 + Math.sin(t * Math.PI) * 3;

            // Rotate from π/2 (front, positive Z) around to 5π/2 (full circle back to front)
            const angle = (Math.PI * 0.5) + (t * Math.PI * 2);

            // Compute sideways sway relative to camera's facing direction to stop unnatural drift
            const swayX = Math.sin(angle) * walk.x;
            const swayZ = -Math.cos(angle) * walk.x;

            targetX = orbitCenterX + Math.cos(angle) * dynamicRadius + swayX;
            targetZ = orbitCenterZ + Math.sin(angle) * dynamicRadius + swayZ;
            targetY = orbitY + walk.y;

            lookX = orbitCenterX;
            lookY = orbitCenterY + walk.pitch;
            lookZ = orbitCenterZ;

            targetRoll = walk.roll;
        }

        // ─── Phase 3: WALK BACK OUT (70% → 85%) — 13 steps ───
        else if (progress <= 0.85) {
            const t = easeInOutCubic(mapRange(progress, 0.70, 0.85));
            const walk = getWalkCycle(t, 13, 0.04, 0.02); // Gentle walk-out

            // Pull back out from Z=-5 to Z=10
            targetX = walk.x;
            targetZ = -5 + (t * 15); // -5 back to 10
            targetY = orbitY + walk.y;

            lookX = orbitCenterX * (1 - t);
            lookY = orbitCenterY * (1 - t) + walk.pitch;
            lookZ = orbitCenterZ * (1 - t);

            targetRoll = walk.roll;
        }

        // ─── Phase 4: ZOOM OUT (STEPS) (85% → 100%) — 16 steps ───
        else {
            const t = easeOutCubic(mapRange(progress, 0.85, 1.0));
            const walk = getWalkCycle(t, 16, 0.03, 0.015); // Very calm zoom out

            targetX = walk.x;
            targetZ = 10 + (t * 6);  // 10 → 16
            targetY = orbitY * (1 - t) + walk.y; // Gradually returning to UI baseline Y=0

            lookX = 0; lookY = walk.pitch * (1 - t); lookZ = 0;
            targetRoll = walk.roll * (1 - t);
        }

        // No mouse parallax — camera follows scroll path only
        const parallaxX = 0;
        const parallaxY = 0;

        // Smoothly lerp camera position
        state.camera.position.lerp(
            new THREE.Vector3(targetX + parallaxX, targetY + parallaxY, targetZ),
            delta * 3
        );

        // Smoothly lerp look target
        targetLookAt.current.set(lookX, lookY, lookZ);
        currentLookAt.current.lerp(targetLookAt.current, delta * 4);

        // Apply dynamic head roll (tilt) for realism by shifting the camera 'UP' vector
        currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, targetRoll, delta * 6);
        state.camera.up.set(Math.sin(currentRoll.current), Math.cos(currentRoll.current), 0);
        state.camera.up.normalize();

        // Direct the camera at the final look coordinates
        state.camera.lookAt(currentLookAt.current);
    });

    return null;
}

