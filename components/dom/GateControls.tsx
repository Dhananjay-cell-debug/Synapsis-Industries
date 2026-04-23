"use client";

import { useGateStore } from "@/store/useGateStore";

export default function GateControls() {
    const { x, y, scaleX, scaleY, setGateConfig } = useGateStore();

    return (
        <div className="fixed top-8 left-8 z-50 bg-[#111] text-white p-6 rounded-xl font-mono text-sm w-80 shadow-2xl border border-white/20">
            <h3 className="text-xl font-bold mb-6 text-[#ECA7A7] border-b border-white/20 pb-2">GATE CALIBRATOR</h3>

            <div className="space-y-6">
                {/* POSITION X */}
                <div>
                    <div className="flex justify-between mb-2">
                        <label>Position X</label>
                        <span className="text-emerald-400">{x.toFixed(2)}</span>
                    </div>
                    <input
                        type="range" min="-10" max="10" step="0.05" value={x}
                        onChange={(e) => setGateConfig(parseFloat(e.target.value), y, scaleX, scaleY)}
                        className="w-full accent-[#ECA7A7]"
                    />
                </div>

                {/* POSITION Y */}
                <div>
                    <div className="flex justify-between mb-2">
                        <label>Position Y</label>
                        <span className="text-emerald-400">{y.toFixed(2)}</span>
                    </div>
                    <input
                        type="range" min="-10" max="10" step="0.05" value={y}
                        onChange={(e) => setGateConfig(x, parseFloat(e.target.value), scaleX, scaleY)}
                        className="w-full accent-[#ECA7A7]"
                    />
                </div>

                {/* SCALE X */}
                <div>
                    <div className="flex justify-between mb-2">
                        <label>Scale X / Width</label>
                        <span className="text-emerald-400">{scaleX.toFixed(2)}</span>
                    </div>
                    <input
                        type="range" min="0.1" max="5.0" step="0.05" value={scaleX}
                        onChange={(e) => setGateConfig(x, y, parseFloat(e.target.value), scaleY)}
                        className="w-full accent-[#ECA7A7]"
                    />
                </div>

                {/* SCALE Y */}
                <div>
                    <div className="flex justify-between mb-2">
                        <label>Scale Y / Height</label>
                        <span className="text-emerald-400">{scaleY.toFixed(2)}</span>
                    </div>
                    <input
                        type="range" min="0.1" max="5.0" step="0.05" value={scaleY}
                        onChange={(e) => setGateConfig(x, y, scaleX, parseFloat(e.target.value))}
                        className="w-full accent-[#ECA7A7]"
                    />
                </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/20">
                <p className="text-xs text-white/50 mb-4 leading-relaxed">
                    Once you find the perfect values, copy them and I will lock them in permanently.
                </p>
                <div className="bg-black/50 p-3 rounded text-center text-emerald-400 select-all cursor-text text-xs">
                    X: {x.toFixed(2)} | Y: {y.toFixed(2)} | SW: {scaleX.toFixed(2)} | SH: {scaleY.toFixed(2)}
                </div>
            </div>
        </div>
    );
}
