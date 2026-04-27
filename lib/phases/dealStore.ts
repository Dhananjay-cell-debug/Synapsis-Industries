// ─── DEAL STORE (filesystem JSON for V1) ───────────────────────────────────
// Shared read/write helpers for data/deals.json. Future: swap to Supabase.
// Keep this file pure-IO — no business logic. Transitions own the logic.

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Deal } from "@/app/api/deals/route";

const DATA_FILE = path.join(process.cwd(), "data", "deals.json");

export async function readAllDeals(): Promise<Deal[]> {
    try {
        const raw = await readFile(DATA_FILE, "utf8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export async function writeAllDeals(deals: Deal[]): Promise<void> {
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(deals, null, 2));
}

export async function findDealByToken(token: string): Promise<Deal | null> {
    const deals = await readAllDeals();
    return deals.find(d => d.token === token) || null;
}

/**
 * Apply a mutation function to a deal and persist. Returns the updated deal,
 * or null if the deal wasn't found.
 */
export async function mutateDeal(
    token: string,
    fn: (deal: Deal) => Deal
): Promise<Deal | null> {
    const deals = await readAllDeals();
    const idx = deals.findIndex(d => d.token === token);
    if (idx === -1) return null;
    deals[idx] = fn(deals[idx]);
    await writeAllDeals(deals);
    return deals[idx];
}
