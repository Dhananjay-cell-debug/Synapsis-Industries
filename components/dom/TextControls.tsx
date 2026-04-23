"use client";

import { useState } from "react";

export interface TextStyleOverrides {
    // Title block (Welcome to + KONTENTWALA + subtitle) — treated as one group
    titleX: number;       // right offset in vw
    titleY: number;       // top offset in %
    welcomeSize: number;  // font-size in rem
    headingSize: number;  // font-size in vw
    subtitleSize: number; // font-size in rem
    // Brand tag "W."
    brandX: number;       // left offset in vw
    brandY: number;       // vertical center offset in %
    // Scroll indicator
    scrollX: number;      // right offset in vw
    scrollY: number;      // bottom offset in vw
}

export const defaultTextStyles: TextStyleOverrides = {
    titleX: 8,
    titleY: 45,
    welcomeSize: 1.5,
    headingSize: 5,
    subtitleSize: 1,
    brandX: 5,
    brandY: 50,
    scrollX: 10,
    scrollY: 10,
};

interface TextControlsProps {
    styles: TextStyleOverrides;
    onChange: (key: keyof TextStyleOverrides, val: number) => void;
    onLock: () => void;
    locked: boolean;
}

function Slider({ label, value, min, max, step, unit, onChange }: {
    label: string; value: number; min: number; max: number; step: number; unit: string;
    onChange: (v: number) => void;
}) {
    return (
        <div style={{ marginBottom: 6 }}>
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span>{label}</span>
                <span style={{ color: "#F5889E" }}>{value.toFixed(1)}{unit}</span>
            </label>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#F5889E", height: 4 }} />
        </div>
    );
}

export default function TextControls({ styles, onChange, onLock, locked }: TextControlsProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [activeGroup, setActiveGroup] = useState<"title" | "brand" | "scroll">("title");

    if (locked) {
        return (
            <div style={{
                position: "fixed", bottom: 20, left: 20, zIndex: 9999,
                background: "rgba(0,0,0,0.85)", color: "#0f0", padding: "12px 16px",
                borderRadius: 8, fontFamily: "monospace", fontSize: 11,
            }}>
                ✅ TEXT LOCKED — Values ready to hardcode.
            </div>
        );
    }

    if (collapsed) {
        return (
            <button onClick={() => setCollapsed(false)} style={{
                position: "fixed", bottom: 20, left: 20, zIndex: 9999,
                background: "rgba(0,0,0,0.85)", color: "#fff", border: "1px solid #555",
                padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace",
            }}>
                🔤 Text Controls
            </button>
        );
    }

    const tabs: { key: "title" | "brand" | "scroll"; label: string }[] = [
        { key: "title", label: "Title" },
        { key: "brand", label: "W. Tag" },
        { key: "scroll", label: "Scroll" },
    ];

    return (
        <div style={{
            position: "fixed", bottom: 20, left: 20, zIndex: 9999,
            background: "rgba(0,0,0,0.92)", color: "#fff", padding: "14px 18px",
            borderRadius: 12, fontFamily: "monospace", fontSize: 12,
            minWidth: 300, backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.1)",
            maxHeight: "80vh", overflowY: "auto",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: "bold", fontSize: 13 }}>🔤 Text Controls</span>
                <button onClick={() => setCollapsed(true)} style={{
                    background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16
                }}>✕</button>
            </div>

            {/* Tab Buttons */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveGroup(t.key)} style={{
                        flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                        fontFamily: "monospace", fontSize: 11, border: "none",
                        background: activeGroup === t.key ? "#F5889E" : "rgba(255,255,255,0.08)",
                        color: activeGroup === t.key ? "#000" : "#aaa",
                        fontWeight: activeGroup === t.key ? "bold" : "normal",
                    }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Title Group Controls */}
            {activeGroup === "title" && (
                <>
                    <div style={{ color: "#888", fontSize: 10, marginBottom: 6, textTransform: "uppercase" }}>
                        "Welcome to / KONTENTWALA / Subtitle" Block
                    </div>
                    <Slider label="Right Offset" value={styles.titleX} min={0} max={80} step={0.5} unit="vw" onChange={v => onChange("titleX", v)} />
                    <Slider label="Vertical Position" value={styles.titleY} min={10} max={80} step={1} unit="%" onChange={v => onChange("titleY", v)} />
                    <Slider label='"Welcome to" Size' value={styles.welcomeSize} min={0.5} max={4} step={0.1} unit="rem" onChange={v => onChange("welcomeSize", v)} />
                    <Slider label="KONTENTWALA Size" value={styles.headingSize} min={2} max={15} step={0.5} unit="vw" onChange={v => onChange("headingSize", v)} />
                    <Slider label="Subtitle Size" value={styles.subtitleSize} min={0.3} max={3} step={0.1} unit="rem" onChange={v => onChange("subtitleSize", v)} />
                </>
            )}

            {/* Brand Tag Controls */}
            {activeGroup === "brand" && (
                <>
                    <div style={{ color: "#888", fontSize: 10, marginBottom: 6, textTransform: "uppercase" }}>
                        "W." Brand Tag
                    </div>
                    <Slider label="Left Offset" value={styles.brandX} min={0} max={80} step={0.5} unit="vw" onChange={v => onChange("brandX", v)} />
                    <Slider label="Vertical Position" value={styles.brandY} min={10} max={90} step={1} unit="%" onChange={v => onChange("brandY", v)} />
                </>
            )}

            {/* Scroll Indicator Controls */}
            {activeGroup === "scroll" && (
                <>
                    <div style={{ color: "#888", fontSize: 10, marginBottom: 6, textTransform: "uppercase" }}>
                        "Scroll To Discover" Indicator
                    </div>
                    <Slider label="Right Offset" value={styles.scrollX} min={0} max={100} step={0.5} unit="vw" onChange={v => onChange("scrollX", v)} />
                    <Slider label="Bottom Offset" value={styles.scrollY} min={0} max={100} step={0.5} unit="vw" onChange={v => onChange("scrollY", v)} />
                </>
            )}

            {/* Lock Button */}
            <button onClick={onLock} style={{
                width: "100%", padding: "10px", background: "#F5889E", color: "#000",
                border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold",
                fontFamily: "monospace", fontSize: 12, marginTop: 10,
            }}>
                🔒 LOCK TEXT POSITIONS
            </button>
        </div>
    );
}
