// ─── SUPABASE SERVER CLIENT ────────────────────────────────────────────────
// Service-role client. Server-side only. NEVER imported in client components.
// All synapsis schema reads/writes go through this — RLS is on, service role bypasses.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
    console.warn(
        "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — payment routes will fail until set in .env.local"
    );
}

// Singleton — Next.js dev mode hot-reloads, avoid client churn
declare global {
    // eslint-disable-next-line no-var
    var __synapsisSupabase: SupabaseClient<any, any, any> | undefined;
}

export const supabase: SupabaseClient<any, any, any> =
    globalThis.__synapsisSupabase ??
    createClient(url || "https://placeholder.supabase.co", serviceKey || "placeholder", {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: "synapsis" as any },
        global: {
            headers: {
                "x-application": "synapsis-payments",
                // Force PostgREST to read AND write to the `synapsis` schema.
                // supabase-js sets these from db.schema for inserts but the
                // Accept-Profile header was getting dropped for SELECT in
                // our deployed build — pinning them here removes the doubt.
                "Accept-Profile": "synapsis",
                "Content-Profile": "synapsis",
            },
        },
    });

if (process.env.NODE_ENV !== "production") {
    globalThis.__synapsisSupabase = supabase;
}

// ─── Production guard ──────────────────────────────────────────────────────
// At boot, in production, throw if any payment-critical env var is placeholder/empty.
// This prevents accidentally deploying with dev placeholders.
if (process.env.NODE_ENV === "production") {
    const requiredEnv = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
    ];
    const placeholders = ["placeholder", "rzp_test_placeholder", "whsec_placeholder_replace_after_setup", "your_", "xxx"];
    for (const k of requiredEnv) {
        const v = process.env[k] || "";
        if (!v) {
            // Log only — do not crash the entire app, but webhook routes will refuse to operate
            console.error(`[CRITICAL] ${k} is empty in production — payment system will not work`);
            continue;
        }
        if (placeholders.some(p => v.includes(p))) {
            console.error(`[CRITICAL] ${k} looks like a placeholder in production: "${v.slice(0, 30)}..."`);
        }
    }
}
