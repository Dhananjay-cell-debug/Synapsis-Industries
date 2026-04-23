"use client";

import { useState } from "react";

export interface ColorValues {
    wallColor: string;
    wallEmissive: string;
    wallEmissiveIntensity: number;
    groundColor: string;
    bgColor: string;
}

export const defaultColorValues: ColorValues = {
    wallColor: "#E0A8B0",
    wallEmissive: "#3D2028",
    wallEmissiveIntensity: 0.35,
    groundColor: "#E8B5BC",
    bgColor: "#E0A8B0",
};

// Convert hex to HSL
function hexToHSL(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
    const sN = s / 100, lN = l / 100;
    const c = (1 - Math.abs(2 * lN - 1)) * sN;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = lN - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (v: number) => void;
    gradient?: string;
}

function Slider({ label, value, min, max, step = 1, unit = "", onChange, gradient }: SliderProps) {
    return (
        <div style={{ marginBottom: 8 }}>
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                <span>{label}</span>
                <span style={{ color: "#F5889E" }}>{value}{unit}</span>
            </label>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{
                    width: "100%",
                    accentColor: "#F5889E",
                    ...(gradient ? { background: gradient } : {}),
                }}
            />
        </div>
    );
}

interface ColorControlsProps {
    colors: ColorValues;
    onChange: (key: keyof ColorValues, val: string | number) => void;
    onLock: () => void;
    locked: boolean;
}

export default function ColorControls({ colors, onChange, onLock, locked }: ColorControlsProps) {
    const [tab, setTab] = useState<"wall" | "ground">("wall");
    const [collapsed, setCollapsed] = useState(false);

    const wallHSL = hexToHSL(colors.wallColor);
    const groundHSL = hexToHSL(colors.groundColor);
    const emissiveHSL = hexToHSL(colors.wallEmissive);

    if (locked) {
        return (
            <div style={{
                position: "fixed", bottom: 20, right: 20, zIndex: 9999,
                background: "rgba(0,0,0,0.85)", color: "#0f0", padding: "12px 16px",
                borderRadius: 8, fontFamily: "monospace", fontSize: 11,
            }}>
                ✅ COLORS LOCKED<br />
                Wall: {colors.wallColor}<br />
                Ground: {colors.groundColor}<br />
                Emissive: {colors.wallEmissive} @ {colors.wallEmissiveIntensity}
            </div>
        );
    }

    if (collapsed) {
        return (
            <button onClick={() => setCollapsed(false)} style={{
                position: "fixed", bottom: 20, right: 20, zIndex: 9999,
                background: "rgba(0,0,0,0.85)", color: "#fff", border: "1px solid #555",
                padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace",
            }}>
                🎨 Color Panel
            </button>
        );
    }

    return (
        <div style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 9999,
            background: "rgba(0,0,0,0.92)", color: "#fff", padding: "16px 20px",
            borderRadius: 12, fontFamily: "monospace", fontSize: 12,
            minWidth: 320, maxHeight: "85vh", overflowY: "auto",
            backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: "bold", fontSize: 13 }}>🎨 Color Panel</span>
                <button onClick={() => setCollapsed(true)} style={{
                    background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16
                }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {(["wall", "ground"] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                        border: tab === t ? "1px solid #F5889E" : "1px solid #444",
                        background: tab === t ? "#F5889E" : "transparent",
                        color: tab === t ? "#000" : "#aaa",
                        fontFamily: "monospace", fontSize: 11, fontWeight: tab === t ? "bold" : "normal",
                    }}>
                        {t === "wall" ? "🏛️ Walls / Arches" : "🟫 Ground"}
                    </button>
                ))}
            </div>

            {tab === "wall" && (
                <>
                    <div style={{ color: "#888", fontSize: 9, marginBottom: 4, textTransform: "uppercase" }}>
                        Wall & Arch Material Color
                    </div>

                    {/* Color preview + hex input */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <input
                            type="color" value={colors.wallColor}
                            onChange={(e) => onChange("wallColor", e.target.value)}
                            style={{ width: 40, height: 30, border: "none", borderRadius: 4, cursor: "pointer" }}
                        />
                        <input
                            type="text" value={colors.wallColor}
                            onChange={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange("wallColor", e.target.value); }}
                            style={{
                                flex: 1, background: "#222", border: "1px solid #444", borderRadius: 4,
                                color: "#fff", padding: "4px 8px", fontFamily: "monospace", fontSize: 12,
                            }}
                        />
                    </div>

                    {/* HSL Sliders for wall */}
                    <Slider label="Hue" value={wallHSL[0]} min={0} max={360} step={1} unit="°"
                        onChange={v => onChange("wallColor", hslToHex(v, wallHSL[1], wallHSL[2]))} />
                    <Slider label="Saturation" value={wallHSL[1]} min={0} max={100} step={1} unit="%"
                        onChange={v => onChange("wallColor", hslToHex(wallHSL[0], v, wallHSL[2]))} />
                    <Slider label="Lightness" value={wallHSL[2]} min={10} max={95} step={1} unit="%"
                        onChange={v => onChange("wallColor", hslToHex(wallHSL[0], wallHSL[1], v))} />

                    {/* Emissive (shadow depth) */}
                    <div style={{ color: "#888", fontSize: 9, marginBottom: 4, marginTop: 8, textTransform: "uppercase" }}>
                        Shadow / Depth Tint (Emissive)
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <input
                            type="color" value={colors.wallEmissive}
                            onChange={(e) => onChange("wallEmissive", e.target.value)}
                            style={{ width: 40, height: 30, border: "none", borderRadius: 4, cursor: "pointer" }}
                        />
                        <span style={{ color: "#aaa", fontSize: 10 }}>{colors.wallEmissive}</span>
                    </div>
                    <Slider label="Shadow Intensity" value={colors.wallEmissiveIntensity} min={0} max={1} step={0.05} unit=""
                        onChange={v => onChange("wallEmissiveIntensity", v)} />
                </>
            )}

            {tab === "ground" && (
                <>
                    <div style={{ color: "#888", fontSize: 9, marginBottom: 4, textTransform: "uppercase" }}>
                        Ground / Floor Color
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <input
                            type="color" value={colors.groundColor}
                            onChange={(e) => onChange("groundColor", e.target.value)}
                            style={{ width: 40, height: 30, border: "none", borderRadius: 4, cursor: "pointer" }}
                        />
                        <input
                            type="text" value={colors.groundColor}
                            onChange={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange("groundColor", e.target.value); }}
                            style={{
                                flex: 1, background: "#222", border: "1px solid #444", borderRadius: 4,
                                color: "#fff", padding: "4px 8px", fontFamily: "monospace", fontSize: 12,
                            }}
                        />
                    </div>

                    <Slider label="Hue" value={groundHSL[0]} min={0} max={360} step={1} unit="°"
                        onChange={v => onChange("groundColor", hslToHex(v, groundHSL[1], groundHSL[2]))} />
                    <Slider label="Saturation" value={groundHSL[1]} min={0} max={100} step={1} unit="%"
                        onChange={v => onChange("groundColor", hslToHex(groundHSL[0], v, groundHSL[2]))} />
                    <Slider label="Lightness" value={groundHSL[2]} min={10} max={95} step={1} unit="%"
                        onChange={v => onChange("groundColor", hslToHex(groundHSL[0], groundHSL[1], v))} />
                </>
            )}

            {/* Current values display */}
            <div style={{
                background: "rgba(255,255,255,0.05)", padding: "8px 10px", borderRadius: 6,
                marginTop: 10, marginBottom: 10, fontSize: 10, color: "#aaa",
            }}>
                Wall: {colors.wallColor} | Ground: {colors.groundColor}<br />
                Emissive: {colors.wallEmissive} @ {colors.wallEmissiveIntensity.toFixed(2)}
            </div>

            {/* Lock Button */}
            <button onClick={onLock} style={{
                width: "100%", padding: "10px", background: "#F5889E", color: "#000",
                border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold",
                fontFamily: "monospace", fontSize: 12,
            }}>
                🔒 LOCK COLORS
            </button>
        </div>
    );
}
