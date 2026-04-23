"use client";

import { useProblemStore } from "@/store/useProblemStore";
import { useState, useEffect } from "react";

function Slider({ label, value, min, max, step, onChange, color = "#a3d8ff" }: {
    label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, color?: string
}) {
    return (
        <div className="mb-3">
            <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider opacity-60">
                <span>{label}</span>
                <span style={{ color }}>{value.toFixed(3)}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#a3d8ff]"
                style={{ accentColor: color }}
            />
        </div>
    );
}

export default function Section3Calibrator() {
    const config = useProblemStore();
    const [isOpen, setIsOpen] = useState(false);
    const [currentScroll, setCurrentScroll] = useState(0);

    useEffect(() => {
        const onScroll = () => {
            const start = (window.innerHeight * config.startVh) / 100;
            const duration = (window.innerHeight * config.durationVh) / 100;
            const p = (window.scrollY - start) / duration;
            setCurrentScroll(Math.max(0, Math.min(1, p)));
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [config.startVh, config.durationVh]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-[10000] bg-black/80 text-white p-3 rounded-full border border-white/20 hover:scale-105 transition-transform"
            >
                ⚙️
            </button>
        );
    }

    const copyConfig = () => {
        const code = `
PHASES: {
    HEADLINE_IN: ${config.headlineIn.toFixed(2)},
    SUBHEADLINE_IN: ${config.subheadlineIn.toFixed(2)},
    HOLD_START: ${config.holdStart.toFixed(2)},
    ERASE_START: ${config.eraseStart.toFixed(2)},
    CLEARED_START: ${config.clearedStart.toFixed(2)},
},
SCROLL: {
    START_VH: ${config.startVh},
    DURATION_VH: ${config.durationVh},
    TIMELINE_OFFSET_VH: ${config.timelineOffsetVh},
}
        `;
        navigator.clipboard.writeText(code);
        alert("Config copied! Paste this in config/problem-animation.ts later.");
    };

    return (
        <div className="fixed bottom-4 left-4 z-[10000] bg-black/90 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl w-80 font-outfit text-white">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-sm uppercase tracking-tighter text-[#a3d8ff]">Section 3 Calibrator</h3>
                <button onClick={() => setIsOpen(false)} className="opacity-40 hover:opacity-100 text-xl">×</button>
            </div>

            <div className="mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="flex justify-between text-[10px] opacity-40 uppercase mb-1">
                    <span>Live Scroll Progress</span>
                    <span className="text-[#a3d8ff] font-bold">{(currentScroll * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#a3d8ff]" style={{ width: `${currentScroll * 100}%` }} />
                </div>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <div>
                    <p className="text-[10px] font-bold opacity-30 mb-3 tracking-[0.2em] uppercase">Phase Thresholds</p>
                    <Slider label="Headline In" value={config.headlineIn} min={0} max={1} step={0.01} onChange={(v) => config.setConfig({ headlineIn: v })} />
                    <Slider label="Subheadline In" value={config.subheadlineIn} min={0} max={1} step={0.01} onChange={(v) => config.setConfig({ subheadlineIn: v })} />
                    <Slider label="Hold Start" value={config.holdStart} min={0} max={1} step={0.01} onChange={(v) => config.setConfig({ holdStart: v })} />
                    <Slider label="Erase Start" value={config.eraseStart} min={0} max={1} step={0.01} onChange={(v) => config.setConfig({ eraseStart: v })} />
                    <Slider label="Cleared/Timeline" value={config.clearedStart} min={0} max={1} step={0.01} onChange={(v) => config.setConfig({ clearedStart: v })} />
                </div>

                <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] font-bold opacity-30 mb-3 tracking-[0.2em] uppercase">Global Scroll</p>
                    <Slider label="Start VH" value={config.startVh} min={100} max={1200} step={10} onChange={(v) => config.setConfig({ startVh: v })} color="#ffb7c5" />
                    <Slider label="Duration VH" value={config.durationVh} min={100} max={1000} step={10} onChange={(v) => config.setConfig({ durationVh: v })} color="#ffb7c5" />
                    <Slider label="Timeline Offset" value={config.timelineOffsetVh} min={0} max={1000} step={10} onChange={(v) => config.setConfig({ timelineOffsetVh: v })} color="#ffb7c5" />
                </div>
            </div>

            <button
                onClick={copyConfig}
                className="w-full mt-6 py-3 bg-[#a3d8ff] text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-colors"
            >
                Lock & Copy Config
            </button>
        </div>
    );
}
