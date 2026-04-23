"use client";

import { useCardTextStore } from "@/store/useCardTextStore";

export default function CardTextCalibrator() {
    const {
        cardThickness,
        setCardTextConfig
    } = useCardTextStore();

    return (
        <div
            className="fixed top-4 right-4 z-[99999] bg-black/95 text-white border-2 border-cyan-400 p-5 rounded-xl font-mono text-xs shadow-2xl backdrop-blur-xl"
            style={{ width: '300px', pointerEvents: 'auto' }}
        >
            <h3 className="text-cyan-400 text-sm font-bold mb-1 tracking-widest">🧊 THICKNESS CALIBRATOR</h3>
            <p className="text-gray-500 mb-6 text-[10px] leading-tight">
                Adjust the 3D depth of the premium glass cards.
            </p>

            <div className="flex flex-col gap-2 border border-cyan-500/30 p-4 rounded-lg bg-cyan-900/10">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-gray-400 font-bold text-xs uppercase">Thickness (Z-Depth)</label>
                    <span className="text-cyan-300 font-bold">{cardThickness.toFixed(2)}</span>
                </div>

                <input
                    type="range"
                    min={0.01}
                    max={1.0}
                    step={0.01}
                    value={cardThickness}
                    onChange={(e) => setCardTextConfig({ cardThickness: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
            </div>

            <p className="text-gray-600 mt-5 text-[10px] text-center leading-tight">
                Find the perfect thick glass look and let me know.
            </p>
        </div>
    );
}
