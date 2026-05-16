"use client";

// ─── SYN LAUNCHER ──────────────────────────────────────────────────────────
// Two separate circular buttons (chat + voice), bottom-left of the portal.
// Hover slides a tooltip in from the right. Voice agent is NOT a disabled
// placeholder — it's fully styled, clickable; functionality lands in v2.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";
import SynChatPanel from "./SynChatPanel";
import SynVoicePanel from "./SynVoicePanel";

interface Props {
    token?: string;
    clientName?: string;
    phase?: number;
    mode?: "client" | "admin";
}

const ACCENT_CHAT = "#11B8EA";   // azure — chat button
const ACCENT_VOICE = "#3B6AE8";  // royal blue — voice button

export default function SynLauncher({ token, clientName, phase, mode = "client" }: Props) {
    const [chatOpen, setChatOpen] = useState(false);
    const [voiceOpen, setVoiceOpen] = useState(false);
    const [hovered, setHovered] = useState<null | "chat" | "voice">(null);
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        if (mode !== "client" || !token) return;
        let cancelled = false;
        const load = async () => {
            try {
                const r = await fetch(`/api/syn/raised/${token}`, { cache: "no-store" });
                if (!r.ok || cancelled) return;
                const d = await r.json();
                if (!cancelled) setUnread(d?.counts?.unread || 0);
            } catch { /* silent */ }
        };
        load();
        const iv = setInterval(load, 30_000);
        return () => { cancelled = true; clearInterval(iv); };
    }, [token, mode]);

    function onVoiceClick() {
        setVoiceOpen(true);
    }

    // Lift FAB above the sidebar bottom card (Switch Account on client,
    // user identity card on admin). Different offsets per mode.
    const bottomClass = mode === "admin" ? "bottom-[100px]" : "bottom-20";

    return (
        <>
            <div className={`fixed ${bottomClass} left-5 z-[80] flex items-center gap-3 pointer-events-none`}>
                <div className="pointer-events-auto">
                    <CircleButton
                        ariaLabel="Open Syn chat — need help"
                        accent={ACCENT_CHAT}
                        onClick={() => setChatOpen(true)}
                        onMouseEnter={() => setHovered("chat")}
                        onMouseLeave={() => setHovered(null)}
                        tooltipVisible={hovered === "chat"}
                        tooltipLabel="Need help?"
                        badge={unread}
                    >
                        <MessageCircle size={18} strokeWidth={2.2} />
                    </CircleButton>
                </div>

                <div className="pointer-events-auto">
                    <CircleButton
                        ariaLabel="Voice agent"
                        accent={ACCENT_VOICE}
                        onClick={onVoiceClick}
                        onMouseEnter={() => setHovered("voice")}
                        onMouseLeave={() => setHovered(null)}
                        tooltipVisible={hovered === "voice"}
                        tooltipLabel="Voice agent"
                    >
                        <Phone size={18} strokeWidth={2.2} />
                    </CircleButton>
                </div>
            </div>

            {/* Slide-in chat panel */}
            <AnimatePresence>
                {chatOpen && (
                    <SynChatPanel
                        mode={mode}
                        token={token}
                        clientName={clientName}
                        phase={phase}
                        onClose={() => setChatOpen(false)}
                        onRaisedResolved={() => setUnread(0)}
                    />
                )}
            </AnimatePresence>

            {/* Full-screen voice panel */}
            <AnimatePresence>
                {voiceOpen && (
                    <SynVoicePanel
                        mode={mode}
                        token={token}
                        clientName={clientName}
                        phase={phase}
                        onClose={() => setVoiceOpen(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

// ─── CircleButton — premium circular button with side tooltip ─────────────
function CircleButton({
    children, ariaLabel, accent, onClick, onMouseEnter, onMouseLeave,
    tooltipVisible, tooltipLabel, badge,
}: {
    children: React.ReactNode;
    ariaLabel: string;
    accent: string;
    onClick: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    tooltipVisible: boolean;
    tooltipLabel: string;
    badge?: number;
}) {
    return (
        <div
            className="relative flex items-center"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <button
                type="button"
                aria-label={ariaLabel}
                onClick={onClick}
                className="relative grid place-items-center w-12 h-12 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${accent}55`,
                    color: accent,
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    boxShadow: `0 8px 24px -10px ${accent}60, inset 0 1px 0 rgba(255,255,255,0.08)`,
                }}
            >
                {children}

                {/* Hover ring glow */}
                <span
                    className="absolute inset-0 rounded-full pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-200"
                    style={{ boxShadow: `0 0 0 4px ${accent}25`, opacity: tooltipVisible ? 1 : 0 }}
                />

                {/* Notification badge */}
                {!!badge && badge > 0 && (
                    <span
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-rose-500 text-white text-[10px] font-bold ring-2 ring-[#0A0F1E]"
                    >
                        {badge > 9 ? "9+" : badge}
                    </span>
                )}
            </button>

            {/* Tooltip — slides right from button edge */}
            <AnimatePresence>
                {tooltipVisible && (
                    <motion.div
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15 }}
                        className="ml-3 px-3 py-1.5 rounded-lg backdrop-blur-md whitespace-nowrap pointer-events-none"
                        style={{
                            background: "rgba(10,15,30,0.92)",
                            border: `1px solid ${accent}40`,
                        }}
                    >
                        <span className="text-white/90 text-[11px] font-medium tracking-wide">{tooltipLabel}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
