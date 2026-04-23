"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ── Default config ──
const DEFAULT_CONFIG = {
    ocean: { x: 0, y: -9.85, z: 60, scale: 2.83 },
    island: { x: 22.55, y: -7.2, z: -5.25, scale: 2.12 },
    mountain: { x: -18.1, y: -5.85, z: -100, scale: 2.85 },
    // Character POSITION (relative to island group)
    char: { x: -1.9, y: 2.25, z: -2.35, scale: 1.63 },
    pose: {
        bodyLean: 18,
        headY: -20,
        headX: 4,
        leftArmX: -16,
        leftArmZ: 80,
        leftElbow: 44,
        rightArmX: -66,
        rightArmZ: -80,
        rightElbow: 38,
        leftLegX: -11,
        rightLegX: 0,
    },
};

export type IslandConfig = typeof DEFAULT_CONFIG;

function publish(cfg: IslandConfig) {
    if (typeof window !== "undefined") {
        (window as any).__islandConfig = cfg;
    }
}

// ── Slider row ──
function Axis({ label, value, min, max, step = 0.05, color = "#38bdf8", onChange }: {
    label: string; value: number; min: number; max: number; step?: number; color?: string;
    onChange: (v: number) => void;
}) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ width: 34, fontSize: 9, color, fontFamily: "monospace", whiteSpace: "nowrap" }}>{label}</span>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: color, cursor: "pointer", height: 3 }}
            />
            <input
                type="number" value={value} step={step}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{
                    width: 52, fontSize: 10, textAlign: "right", background: "#1e293b",
                    border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0",
                    padding: "1px 4px", fontFamily: "monospace",
                }}
            />
        </div>
    );
}

// ── XYZ + Scale block ──
function ObjBlock({ name, val, ranges, onChange }: {
    name: string;
    val: { x: number; y: number; z: number; scale: number };
    ranges: { x: [number, number]; y: [number, number]; z: [number, number]; scale: [number, number] };
    onChange: (axis: "x" | "y" | "z" | "scale", v: number) => void;
}) {
    return (
        <div style={{ marginBottom: 10, padding: "6px 8px", background: "#0f172a", borderRadius: 6, border: "1px solid #1e3a5f" }}>
            <div style={{ fontSize: 10, color: "#38bdf8", marginBottom: 5, letterSpacing: 1 }}>{name.toUpperCase()}</div>
            <Axis label="X" value={val.x} min={ranges.x[0]} max={ranges.x[1]} onChange={(v) => onChange("x", v)} />
            <Axis label="Y" value={val.y} min={ranges.y[0]} max={ranges.y[1]} onChange={(v) => onChange("y", v)} />
            <Axis label="Z" value={val.z} min={ranges.z[0]} max={ranges.z[1]} onChange={(v) => onChange("z", v)} />
            <div style={{ borderTop: "1px solid #1e3a5f", marginTop: 4, paddingTop: 4 }}>
                <Axis label="S" value={val.scale} min={ranges.scale[0]} max={ranges.scale[1]} step={0.01} color="#fbbf24" onChange={(v) => onChange("scale", v)} />
            </div>
        </div>
    );
}

// ── Pose block ──
type PoseKey = keyof IslandConfig["pose"];
function PoseBlock({ pose, onChange }: {
    pose: IslandConfig["pose"];
    onChange: (key: PoseKey, v: number) => void;
}) {
    const row = (label: string, key: PoseKey, min: number, max: number) => (
        <Axis key={key} label={label} value={pose[key]} min={min} max={max} step={1} color="#a78bfa"
            onChange={(v) => onChange(key, v)} />
    );
    return (
        <div style={{ marginBottom: 10, padding: "6px 8px", background: "#0f172a", borderRadius: 6, border: "1px solid #2d1b4e" }}>
            <div style={{ fontSize: 10, color: "#a78bfa", marginBottom: 5, letterSpacing: 1 }}>🦾 POSE CONTROLS</div>
            <div style={{ fontSize: 9, color: "#475569", marginBottom: 4 }}>— BODY —</div>
            {row("bodyLean", "bodyLean", -40, 40)}
            {row("headY", "headY", -80, 80)}
            {row("headX", "headX", -40, 40)}
            <div style={{ fontSize: 9, color: "#475569", marginTop: 6, marginBottom: 4 }}>— LEFT ARM —</div>
            {row("leftArmX", "leftArmX", -160, 60)}
            {row("leftArmZ", "leftArmZ", -80, 80)}
            {row("leftElbow", "leftElbow", 0, 150)}
            <div style={{ fontSize: 9, color: "#475569", marginTop: 6, marginBottom: 4 }}>— RIGHT ARM —</div>
            {row("rightArmX", "rightArmX", -160, 60)}
            {row("rightArmZ", "rightArmZ", -80, 80)}
            {row("rightElbow", "rightElbow", 0, 150)}
            <div style={{ fontSize: 9, color: "#475569", marginTop: 6, marginBottom: 4 }}>— LEGS —</div>
            {row("leftLegX", "leftLegX", -80, 80)}
            {row("rightLegX", "rightLegX", -80, 80)}
        </div>
    );
}

export default function IslandEditorPanel() {
    const [cfg, setCfg] = useState<IslandConfig>(DEFAULT_CONFIG);
    const [open, setOpen] = useState(true);
    const [copied, setCopied] = useState(false);

    // ── Draggable panel ──
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const dragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const onHeaderMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
        if (!dragging.current) return;
        setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onMouseUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    };

    useEffect(() => { publish(cfg); }, [cfg]);
    // cleanup on unmount
    useEffect(() => () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); }, []);

    const update = useCallback((key: keyof IslandConfig, axis: string, v: number) => {
        setCfg((prev) => {
            const next = { ...prev, [key]: { ...(prev[key] as object), [axis]: v } };
            publish(next as IslandConfig);
            return next as IslandConfig;
        });
    }, []);

    const copyAll = () => {
        const out = JSON.stringify(cfg, null, 2);
        navigator.clipboard.writeText(out);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!open) return (
        <button onClick={() => setOpen(true)} style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 9999,
            background: "#0ea5e9", color: "white", border: "none", borderRadius: 8,
            padding: "8px 14px", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
        }}>🏝 Editor</button>
    );

    const RANGES = {
        ocean: { x: [-80, 80] as [number, number], y: [-20, 5] as [number, number], z: [-80, 80] as [number, number], scale: [0.05, 6] as [number, number] },
        island: { x: [-40, 40] as [number, number], y: [-15, 10] as [number, number], z: [-40, 40] as [number, number], scale: [0.05, 6] as [number, number] },
        mountain: { x: [-80, 20] as [number, number], y: [-10, 15] as [number, number], z: [-100, 0] as [number, number], scale: [0.05, 6] as [number, number] },
        char: { x: [-10, 10] as [number, number], y: [-2, 4] as [number, number], z: [-10, 10] as [number, number], scale: [0.1, 4] as [number, number] },
    };

    return (
        <div style={{
            position: "fixed",
            ...(pos ? { left: pos.x, top: pos.y } : { bottom: 16, right: 16 }),
            zIndex: 9999,
            background: "#0d1b2e", border: "1px solid #1e3a5f", borderRadius: 10,
            width: 310, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)", fontFamily: "monospace",
            userSelect: "none",
        }}>
            {/* Drag handle — grab the header */}
            <div
                onMouseDown={onHeaderMouseDown}
                style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", background: "#0a1628",
                    borderRadius: "10px 10px 0 0", borderBottom: "1px solid #1e3a5f",
                    cursor: "grab",
                }}>
                <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700, letterSpacing: 1 }}>⠿ 🏝 ISLAND EDITOR</span>
                <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "10px 12px" }}>
                <ObjBlock name="🌊 Ocean" val={cfg.ocean} ranges={RANGES.ocean} onChange={(a, v) => update("ocean", a, v)} />
                <ObjBlock name="🏝 Island+Trees" val={cfg.island} ranges={RANGES.island} onChange={(a, v) => update("island", a, v)} />
                <ObjBlock name="⛰ Mountain" val={cfg.mountain} ranges={RANGES.mountain} onChange={(a, v) => update("mountain", a, v)} />
                <ObjBlock name="🧍 Character Position" val={cfg.char} ranges={RANGES.char} onChange={(a, v) => update("char", a, v)} />
                <PoseBlock pose={cfg.pose} onChange={(k, v) => update("pose", k, v)} />

                <button onClick={copyAll} style={{
                    width: "100%", padding: "8px", marginTop: 4,
                    background: copied ? "#16a34a" : "#0ea5e9",
                    color: "white", border: "none", borderRadius: 6,
                    fontSize: 11, cursor: "pointer", letterSpacing: 1, transition: "background 0.3s",
                }}>
                    {copied ? "✅ COPIED!" : "📋 COPY ALL VALUES (JSON)"}
                </button>
                <p style={{ fontSize: 9, color: "#475569", marginTop: 6, textAlign: "center", lineHeight: 1.4 }}>
                    <b style={{ color: "#fbbf24" }}>S</b>=Scale &nbsp;|&nbsp; <b style={{ color: "#a78bfa" }}>Purple</b>=Pose (degrees)
                </p>
            </div>
        </div>
    );
}
