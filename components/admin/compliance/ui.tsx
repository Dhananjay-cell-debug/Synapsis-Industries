// ─── COMPLIANCE UI KIT ─────────────────────────────────────────────────────
// Shared premium primitives for the white compliance panel.
// Client-safe (no server-only imports). Accent: #0C97C4 (deeper premium cyan).

"use client";

import React from "react";
import { cn } from "@/lib/utils";

// ─── Design tokens ─────────────────────────────────────────────────────────
export const COMPLIANCE = {
    accent: "#0C97C4",          // deeper premium cyan — chosen for white layout
    accentDark: "#0A7CA0",      // hover / pressed
    accentSoft: "rgba(12,151,196,0.08)",
    accentSofter: "rgba(12,151,196,0.04)",
    ink: "#0A0F1E",             // primary text — brand navy
    body: "#3F4856",            // body text
    muted: "#8A93A0",           // muted text
    hairline: "#E9ECEF",        // borders
    panel: "#FBFCFD",           // content panel background
    cardShadow: "0 1px 2px rgba(10,15,30,0.04), 0 8px 24px -12px rgba(10,15,30,0.08)",
    sidebar: "#0B1120",         // secondary sidebar (connected to primary)
    sidebarHi: "#111A2E",       // sidebar hover
} as const;

// ─── Money formatting (paise → ₹, Indian grouping) ─────────────────────────
export function formatINR(paise: number | bigint | null | undefined, opts?: { decimals?: boolean }): string {
    const p = typeof paise === "bigint" ? Number(paise) : Number(paise ?? 0);
    const rupees = p / 100;
    const isWhole = Number.isInteger(rupees);
    const showDecimals = opts?.decimals ?? !isWhole;
    return "₹" + rupees.toLocaleString("en-IN", {
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
    });
}

export function formatINRCompact(paise: number | bigint | null | undefined): string {
    const p = typeof paise === "bigint" ? Number(paise) : Number(paise ?? 0);
    const r = p / 100;
    const abs = Math.abs(r);
    if (abs >= 1e7) return "₹" + (r / 1e7).toFixed(r % 1e7 === 0 ? 0 : 2) + "Cr";
    if (abs >= 1e5) return "₹" + (r / 1e5).toFixed(r % 1e5 === 0 ? 0 : 2) + "L";
    if (abs >= 1e3) return "₹" + Math.round(r / 1e3) + "k";
    return "₹" + r.toLocaleString("en-IN");
}

export function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? iso + "T00:00:00Z" : iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function daysUntil(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const d = new Date((iso.length <= 10 ? iso + "T00:00:00Z" : iso));
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return Math.floor((d.getTime() - todayUtc) / 86_400_000);
}

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, className, padded = true }: {
    children: React.ReactNode; className?: string; padded?: boolean;
}) {
    return (
        <div
            className={cn("rounded-2xl bg-white border", padded && "p-6", className)}
            style={{ borderColor: COMPLIANCE.hairline, boxShadow: COMPLIANCE.cardShadow }}
        >
            {children}
        </div>
    );
}

// ─── Section label — tiny uppercase ────────────────────────────────────────
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <p
            className={cn("text-[10px] font-semibold uppercase tracking-[0.22em]", className)}
            style={{ color: COMPLIANCE.muted }}
        >
            {children}
        </p>
    );
}

// ─── View header ───────────────────────────────────────────────────────────
export function ViewHeader({ eyebrow, title, subtitle, action }: {
    eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-6 mb-8">
            <div>
                {eyebrow && <SectionLabel className="mb-2">{eyebrow}</SectionLabel>}
                <h1
                    className="font-serif leading-[0.95]"
                    style={{ color: COMPLIANCE.ink, fontSize: "2.4rem", letterSpacing: "-0.03em" }}
                >
                    {title}
                </h1>
                {subtitle && (
                    <p className="mt-2 text-sm max-w-xl" style={{ color: COMPLIANCE.body }}>{subtitle}</p>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

// ─── Stat tile ─────────────────────────────────────────────────────────────
export function StatTile({ label, value, sub, accent, className }: {
    label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean; className?: string;
}) {
    return (
        <Card className={cn("flex flex-col gap-1", className)}>
            <SectionLabel>{label}</SectionLabel>
            <p
                className="font-serif leading-none mt-1"
                style={{ color: accent ? COMPLIANCE.accent : COMPLIANCE.ink, fontSize: "2rem", letterSpacing: "-0.02em" }}
            >
                {value}
            </p>
            {sub && <p className="text-xs mt-1" style={{ color: COMPLIANCE.muted }}>{sub}</p>}
        </Card>
    );
}

// ─── Badge / pill ──────────────────────────────────────────────────────────
type BadgeTone = "accent" | "neutral" | "success" | "warn" | "danger";
const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
    accent: { bg: "rgba(12,151,196,0.10)", fg: "#0A7CA0" },
    neutral: { bg: "#F0F2F4", fg: "#5A6472" },
    success: { bg: "rgba(16,158,90,0.10)", fg: "#0E8A50" },
    warn: { bg: "rgba(217,142,12,0.12)", fg: "#A8700A" },
    danger: { bg: "rgba(214,69,69,0.10)", fg: "#C23B3B" },
};
export function Badge({ children, tone = "neutral", className }: {
    children: React.ReactNode; tone?: BadgeTone; className?: string;
}) {
    const t = BADGE_TONES[tone];
    return (
        <span
            className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]", className)}
            style={{ background: t.bg, color: t.fg }}
        >
            {children}
        </span>
    );
}

// ─── Button ────────────────────────────────────────────────────────────────
export function Button({ children, onClick, variant = "solid", size = "md", type = "button", disabled, className }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: "solid" | "ghost" | "outline";
    size?: "sm" | "md";
    type?: "button" | "submit";
    disabled?: boolean;
    className?: string;
}) {
    const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none";
    const sizes = { sm: "px-3.5 py-2 text-xs", md: "px-5 py-2.5 text-sm" };
    const styles: React.CSSProperties =
        variant === "solid"
            ? { background: COMPLIANCE.accent, color: "#fff" }
            : variant === "outline"
                ? { background: "#fff", color: COMPLIANCE.ink, border: `1px solid ${COMPLIANCE.hairline}` }
                : { background: "transparent", color: COMPLIANCE.accent };
    return (
        <button
            type={type} onClick={onClick} disabled={disabled}
            className={cn(base, sizes[size], variant === "solid" && "hover:opacity-90", variant !== "solid" && "hover:bg-black/[0.03]", className)}
            style={styles}
        >
            {children}
        </button>
    );
}

// ─── Form field ────────────────────────────────────────────────────────────
export function Field({ label, children, hint, className }: {
    label: string; children: React.ReactNode; hint?: string; className?: string;
}) {
    return (
        <label className={cn("flex flex-col gap-1.5", className)}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: COMPLIANCE.muted }}>
                {label}
            </span>
            {children}
            {hint && <span className="text-[11px]" style={{ color: COMPLIANCE.muted }}>{hint}</span>}
        </label>
    );
}

export const inputClass =
    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#0C97C4]";
export const inputStyle: React.CSSProperties = { borderColor: COMPLIANCE.hairline, color: COMPLIANCE.ink };

// ─── Empty state ───────────────────────────────────────────────────────────
export function EmptyState({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            {icon && (
                <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: COMPLIANCE.accentSoft, color: COMPLIANCE.accent }}
                >
                    {icon}
                </div>
            )}
            <p className="font-serif text-xl" style={{ color: COMPLIANCE.ink }}>{title}</p>
            {hint && <p className="text-sm mt-1.5 max-w-sm" style={{ color: COMPLIANCE.muted }}>{hint}</p>}
        </div>
    );
}

// ─── Loading shimmer ───────────────────────────────────────────────────────
export function LoadingBlock({ label = "Loading" }: { label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: COMPLIANCE.accent, borderTopColor: "transparent" }}
            />
            <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: COMPLIANCE.muted }}>{label}</p>
        </div>
    );
}

// ─── Error inline ──────────────────────────────────────────────────────────
export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <Card className="flex items-center justify-between gap-4">
            <div>
                <p className="text-sm font-semibold" style={{ color: "#C23B3B" }}>Something broke</p>
                <p className="text-xs mt-0.5" style={{ color: COMPLIANCE.muted }}>{message}</p>
            </div>
            {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
        </Card>
    );
}
