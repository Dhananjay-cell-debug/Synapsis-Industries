"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useRef, useState, useEffect } from "react";
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

// Force-kill any stale WebGL contexts from old hot-reloads / other tabs
function forceCleanStaleContexts() {
    if (typeof document === 'undefined') return;
    const staleCanvases = document.querySelectorAll('canvas[data-engine]');
    staleCanvases.forEach((c) => {
        try {
            const gl = (c as HTMLCanvasElement).getContext('webgl2') || (c as HTMLCanvasElement).getContext('webgl');
            if (gl) {
                const ext = gl.getExtension('WEBGL_lose_context');
                if (ext) ext.loseContext();
            }
        } catch (_) { /* ignore */ }
    });
}

function LoadingFallback() {
    return null;
}

export default function CanvasWrapper({
    gateX, gateY, gateScaleX, gateScaleY,
    wallColor, wallEmissive, wallEmissiveIntensity,
    groundColor, bgColor,
}: CanvasWrapperProps) {
    const [webglOk, setWebglOk] = useState(true);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    // Check WebGL support and clean stale contexts BEFORE mounting canvas
    useEffect(() => {
        // Dev-only: HMR leaves zombie WebGL contexts behind. In production the
        // browser has a clean slate, so running this would risk nuking legit canvases.
        if (process.env.NODE_ENV === 'development') forceCleanStaleContexts();

        // Probe WebGL availability
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) {
            console.error('[Synapsis] WebGL not available — too many contexts or GPU blocked');
            setWebglOk(false);
            return;
        }
        // Immediately release the test context
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
    }, []);

    const onCreated = useCallback((state: any) => {
        const renderer = state.gl;
        rendererRef.current = renderer;
        const canvas = renderer.domElement;

        // GPU info logging
        const glCtx = renderer.getContext();
        const debugInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            console.info('[Synapsis GPU]', glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        }

        // Note: deliberately NOT auto-reloading on context loss. An auto-reload in
        // production on a weak GPU becomes an infinite refresh loop. Let the user
        // retry manually if it ever happens — R3F/three will attempt restore itself.
        canvas.addEventListener('webglcontextlost', (e: Event) => {
            e.preventDefault();
            console.warn('[Synapsis] WebGL context lost — waiting for browser restore');
        });

        canvas.addEventListener('webglcontextrestored', () => {
            console.info('[Synapsis] WebGL context restored');
        });

    }, []);

    // Cleanup renderer on unmount (crucial for HMR)
    useEffect(() => {
        return () => {
            if (rendererRef.current) {
                rendererRef.current.dispose();
                rendererRef.current.forceContextLoss();
                rendererRef.current = null;
            }
        };
    }, []);

    if (!webglOk) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#0A0F1E]">
                <div className="text-center">
                    <p className="text-white/60 text-sm mb-2">WebGL unavailable</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-4 py-2 bg-[#11B8EA] text-[#0A0F1E] text-xs font-bold rounded"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        );
    }

    return (
        <WebGLErrorBoundary>
            <Canvas
                className="w-full h-full"
                camera={{ position: [0, 0, 10], fov: 35, near: 0.1, far: 200 }}
                dpr={[1, 1.5]}
                gl={{
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.2,
                    antialias: true,
                    powerPreference: "high-performance",
                    failIfMajorPerformanceCaveat: false,
                    alpha: false,
                    stencil: false,
                    depth: true,
                    preserveDrawingBuffer: false,
                }}
                onCreated={onCreated}
            >
                <ambientLight intensity={1.5} />
                <Suspense fallback={<LoadingFallback />}>
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
