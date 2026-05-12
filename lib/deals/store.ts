// ─── DEAL STORE — thin shim over Supabase store ─────────────────────────────
// This module historically wrote deals to data/deals.json on disk. That stops
// working on Vercel (ephemeral filesystem) and the source of truth is now the
// Supabase `deals` table via lib/phases/dealStore. We keep this file so every
// payment route (Razorpay, Stripe, manual NEFT) can keep its existing imports
// while reading/writing the real data.

import type { Deal } from "@/app/api/deals/route";
import {
    findDealByToken,
    mutateDeal,
    readAllDeals,
} from "@/lib/phases/dealStore";

export async function getDeal(token: string): Promise<Deal | null> {
    return findDealByToken(token);
}

export async function listDeals(): Promise<Deal[]> {
    return readAllDeals();
}

/**
 * Mutate a single deal. fn receives the latest deal and returns the updated
 * one. Returning null means "no-op" — we just return the existing deal.
 *
 * Note: Supabase mutateDeal expects a non-null Deal. We adapt: if fn returns
 * null we re-fetch and return as-is; otherwise we forward the updated deal.
 */
export async function updateDeal(
    token: string,
    fn: (deal: Deal) => Deal | null | Promise<Deal | null>
): Promise<Deal | null> {
    const current = await findDealByToken(token);
    if (!current) return null;

    const next = await fn(current);
    if (!next) return current;

    return mutateDeal(token, () => next);
}
