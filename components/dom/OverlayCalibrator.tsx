"use client";

import { useOverlayStore } from "@/store/useOverlayStore";

export default function OverlayCalibrator() {
    const { top, left, setTop, setLeft } = useOverlayStore();

    return (
        <div style={{
            position: "fixed",
            bottom: "20px",
            left: "20px",
            zIndex: 99999,
            background: "#0A0F1E",
            border: "1px solid #11B8EA",
            borderRadius: "8px",
            padding: "16px",
            color: "white",
            fontFamily: "monospace",
            fontSize: "12px",
            minWidth: "220px",
        }}>
            <div style={{ color: "#11B8EA", fontWeight: "bold", marginBottom: "12px" }}>
                TEXT CALIBRATOR
            </div>

            <div style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>Y (top)</span>
                    <span style={{ color: "#11B8EA" }}>{top}%</span>
                </div>
                <input
                    type="range" min={0} max={100} step={0.5}
                    value={top}
                    onChange={(e) => setTop(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#11B8EA" }}
                />
            </div>

            <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>X (left)</span>
                    <span style={{ color: "#11B8EA" }}>{left}%</span>
                </div>
                <input
                    type="range" min={0} max={100} step={0.5}
                    value={left}
                    onChange={(e) => setLeft(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#11B8EA" }}
                />
            </div>

            <div style={{ marginTop: "12px", color: "#94A3B8", fontSize: "10px" }}>
                Lock values → tell Claude: top={top} left={left}
            </div>
        </div>
    );
}
