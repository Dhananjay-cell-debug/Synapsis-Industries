"use client";

import { useOverlayStore } from "@/store/useOverlayStore";
import { useTextStore } from "@/store/useTextStore";
import { useState } from "react";

export default function GlobalCalibrator() {
    const { top, left, setTop, setLeft } = useOverlayStore();
    const { x, y, z, scale, distanceFactor, setTextConfig } = useTextStore();
    const [copied, setCopied] = useState(false);

    const lockValues = async () => {
        const value = `top=${top.toFixed(1)} left=${left.toFixed(1)} x=${x.toFixed(2)} y=${y.toFixed(2)} z=${z.toFixed(2)} scale=${scale.toFixed(4)} distanceFactor=${distanceFactor.toFixed(1)}`;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            console.log(value);
            alert("Values: " + value);
        }
    };

    return (
        <div
            className="fixed bottom-6 left-6 z-[99999] pointer-events-auto flex flex-col gap-4 text-white w-[340px] max-w-[calc(100vw-24px)] rounded-3xl border border-[#11B8EA]/70 bg-black/95 p-5 shadow-[0_0_100px_rgba(17,184,234,0.35)] backdrop-blur-2xl font-sans"
        >
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase text-[#11B8EA]">Synapsis Industries</span>
                    <span className="text-base font-serif italic text-white/90">Unified Text Calibrator</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-[#11B8EA] animate-pulse shadow-[0_0_10px_#11B8EA]" />
            </div>

            <div className="h-px w-full bg-white/10" />

            <div className="flex flex-col gap-4 max-h-[50vh] overflow-y-auto pr-1">
                {/* 2D SCREEN SPACE */}
                <div className="flex flex-col gap-3">
                    <p className="text-[10px] font-bold text-[#11B8EA] uppercase tracking-widest">2D Screen Position</p>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-medium text-white/60 uppercase">
                            <span>Y / Top (CSS)</span>
                            <span className="text-[#11B8EA] font-mono">{top.toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.5"
                            value={top}
                            onChange={(e) => setTop(parseFloat(e.target.value))}
                            className="w-full accent-[#11B8EA] cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-medium text-white/60 uppercase">
                            <span>X / Left (CSS)</span>
                            <span className="text-[#11B8EA] font-mono">{left.toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.5"
                            value={left}
                            onChange={(e) => setLeft(parseFloat(e.target.value))}
                            className="w-full accent-[#11B8EA] cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                        />
                    </div>
                </div>

                <div className="h-px w-full bg-white/5" />

                {/* 3D WEBGL SPACE */}
                <div className="flex flex-col gap-3">
                    <p className="text-[10px] font-bold text-[#11B8EA] uppercase tracking-widest">3D Canvas Position</p>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-medium text-white/60 uppercase">
                            <span>Pos X</span>
                            <span className="text-[#11B8EA] font-mono">{x.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="-5"
                            max="5"
                            step="0.01"
                            value={x}
                            onChange={(e) => setTextConfig(parseFloat(e.target.value), y, z, scale, distanceFactor)}
                            className="w-full accent-[#11B8EA] cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-medium text-white/60 uppercase">
                            <span>Pos Y</span>
                            <span className="text-[#11B8EA] font-mono">{y.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="-5"
                            max="5"
                            step="0.01"
                            value={y}
                            onChange={(e) => setTextConfig(x, parseFloat(e.target.value), z, scale, distanceFactor)}
                            className="w-full accent-[#11B8EA] cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-medium text-white/60 uppercase">
                            <span>Pos Z (Depth)</span>
                            <span className="text-[#11B8EA] font-mono">{z.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="-10"
                            max="10"
                            step="0.05"
                            value={z}
                            onChange={(e) => setTextConfig(x, y, parseFloat(e.target.value), scale, distanceFactor)}
                            className="w-full accent-[#11B8EA] cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-medium text-white/60 uppercase">
                            <span>3D Scale</span>
                            <span className="text-[#11B8EA] font-mono">{scale.toFixed(4)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.01"
                            max="3"
                            step="0.005"
                            value={scale}
                            onChange={(e) => setTextConfig(x, y, z, parseFloat(e.target.value), distanceFactor)}
                            className="w-full accent-[#11B8EA] cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-medium text-white/60 uppercase">
                            <span>Distance Factor</span>
                            <span className="text-[#11B8EA] font-mono">{distanceFactor.toFixed(1)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="20"
                            step="0.5"
                            value={distanceFactor}
                            onChange={(e) => setTextConfig(x, y, z, scale, parseFloat(e.target.value))}
                            className="w-full accent-[#11B8EA] cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                        />
                    </div>
                </div>
            </div>

            <div className="h-px w-full bg-white/10" />

            <div className="flex items-center gap-3">
                <button
                    onClick={lockValues}
                    className="flex-1 rounded-2xl border border-[#11B8EA]/40 bg-[#11B8EA] px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-[#0A0F1E] transition-all hover:opacity-90 active:scale-95 text-center"
                >
                    {copied ? "Copied!" : "Lock Values"}
                </button>
                <button
                    onClick={() => {
                        setTop(49);
                        setLeft(50);
                        setTextConfig(0.00, -0.50, 1.00, 0.33, 9.00);
                    }}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white/70 transition-all hover:bg-white/10 active:scale-95"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
