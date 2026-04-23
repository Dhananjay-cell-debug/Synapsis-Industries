"use client";

import { useEffect, useState, useCallback } from "react";

interface CameraDebugData {
    x: number;
    y: number;
    z: number;
    scroll: number;
    phase: string;
}

export default function CameraDebugPanel() {
    const [data, setData] = useState<CameraDebugData | null>(null);
    const [bookmarks, setBookmarks] = useState<{ label: string; data: CameraDebugData }[]>([]);
    const [visible, setVisible] = useState(true);

    // Poll window.__cameraDebug every 100ms
    useEffect(() => {
        const interval = setInterval(() => {
            const d = (window as any).__cameraDebug;
            if (d) setData({ ...d });
        }, 100);
        return () => clearInterval(interval);
    }, []);

    const addBookmark = useCallback(() => {
        if (!data) return;
        const label = `📍 Scroll ${data.scroll}%`;
        setBookmarks(prev => [...prev, { label, data: { ...data } }]);
    }, [data]);

    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text).then(() => alert("✅ Copied!"));
    }, []);

    if (!visible) {
        return (
            <button
                onClick={() => setVisible(true)}
                style={{
                    position: "fixed", bottom: 20, right: 20, zIndex: 9999,
                    background: "#111", color: "#0ff", border: "1px solid #0ff",
                    padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                    fontFamily: "monospace", fontSize: 12,
                }}
            >
                📷 Debug
            </button>
        );
    }

    return (
        <div style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 9999,
            background: "rgba(0,0,0,0.88)", color: "#e0e0e0",
            borderRadius: 12, padding: "14px 18px", minWidth: 240,
            fontFamily: "monospace", fontSize: 13,
            border: "1px solid rgba(0,255,255,0.25)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 30px rgba(0,255,255,0.1)",
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: "#0ff", fontWeight: "bold", fontSize: 14 }}>🎥 Camera Debug</span>
                <button onClick={() => setVisible(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Live Data */}
            {data ? (
                <div style={{ lineHeight: 1.8 }}>
                    <div>
                        <span style={{ color: "#888" }}>Phase: </span>
                        <span style={{ color: "#ffd700" }}>{data.phase}</span>
                    </div>
                    <div>
                        <span style={{ color: "#888" }}>Scroll: </span>
                        <span style={{ color: "#7fff7f" }}>{data.scroll}%</span>
                    </div>
                    <div style={{ borderTop: "1px solid #333", marginTop: 6, paddingTop: 6 }}>
                        <div><span style={{ color: "#f87" }}>X: </span>{data.x}</div>
                        <div><span style={{ color: "#7cf" }}>Y: </span>{data.y}</div>
                        <div><span style={{ color: "#fc7" }}>Z: </span>{data.z}</div>
                    </div>
                </div>
            ) : (
                <div style={{ color: "#666" }}>Scroll karke data load karo...</div>
            )}

            {/* Bookmark Button */}
            <button
                onClick={addBookmark}
                style={{
                    marginTop: 10, width: "100%",
                    background: "rgba(0,255,255,0.1)", color: "#0ff",
                    border: "1px solid #0ff", borderRadius: 6,
                    padding: "5px", cursor: "pointer", fontFamily: "monospace",
                }}
            >
                📍 Bookmark This Position
            </button>

            {/* Bookmarks List */}
            {bookmarks.length > 0 && (
                <div style={{ marginTop: 10, maxHeight: 160, overflowY: "auto" }}>
                    <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>SAVED POSITIONS:</div>
                    {bookmarks.map((bm, i) => {
                        const val = `Scroll: ${bm.data.scroll}% | Phase: ${bm.data.phase} | X:${bm.data.x} Y:${bm.data.y} Z:${bm.data.z}`;
                        return (
                            <div key={i} style={{
                                background: "rgba(255,255,255,0.05)", borderRadius: 6,
                                padding: "4px 8px", marginBottom: 4,
                                fontSize: 11, cursor: "pointer",
                                border: "1px solid rgba(255,255,255,0.1)",
                                display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}>
                                <span>{bm.label}</span>
                                <button
                                    onClick={() => copyToClipboard(val)}
                                    style={{ background: "none", border: "none", color: "#0ff", cursor: "pointer", fontSize: 11 }}
                                >
                                    📋 Copy
                                </button>
                            </div>
                        );
                    })}
                    <button
                        onClick={() => copyToClipboard(bookmarks.map(b => `Scroll: ${b.data.scroll}% | Phase: ${b.data.phase} | X:${b.data.x} Y:${b.data.y} Z:${b.data.z}`).join('\n'))}
                        style={{
                            marginTop: 4, width: "100%",
                            background: "rgba(255,215,0,0.1)", color: "#ffd700",
                            border: "1px solid #ffd700", borderRadius: 6,
                            padding: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: 11,
                        }}
                    >
                        📋 Copy All Bookmarks
                    </button>
                </div>
            )}
        </div>
    );
}
