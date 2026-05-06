// ─── DEAL FILE STORE — JSON file source of truth for deal records ──────────
// Payments-related tables live in Supabase (synapsis schema). Deal record
// itself stays on disk for now (phase, blueprint, questionnaire, audit).
//
// Concurrency note: Node's fs.writeFile is not atomic. We do best-effort
// serialization via per-token in-process locks. Real bulletproofing comes
// when the deal record itself migrates to Supabase.

import { readFile, writeFile, mkdir, rename } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import type { Deal } from "@/app/api/deals/route";

const DATA_FILE = path.join(process.cwd(), "data", "deals.json");

// In-process per-token lock — prevents two concurrent writers in the same Node instance
const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((res) => { release = res; });
    locks.set(key, prev.then(() => next));
    await prev;
    try {
        return await fn();
    } finally {
        release();
        if (locks.get(key) === next as unknown) locks.delete(key);
    }
}

async function readAll(): Promise<Deal[]> {
    try {
        const raw = await readFile(DATA_FILE, "utf8");
        return JSON.parse(raw) as Deal[];
    } catch {
        return [];
    }
}

async function writeAllAtomic(deals: Deal[]): Promise<void> {
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, JSON.stringify(deals, null, 2), "utf8");
    await rename(tmp, DATA_FILE);            // atomic on same filesystem
}

export async function getDeal(token: string): Promise<Deal | null> {
    const deals = await readAll();
    return deals.find(d => d.token === token) ?? null;
}

export async function listDeals(): Promise<Deal[]> {
    return readAll();
}

/**
 * Mutate a single deal under a per-token lock. Reader-modifier-writer pattern,
 * serialized in-process. fn receives the latest deal, returns the updated one
 * (or null to skip the write).
 */
export async function updateDeal(
    token: string,
    fn: (deal: Deal) => Deal | null | Promise<Deal | null>
): Promise<Deal | null> {
    return withLock(token, async () => {
        const deals = await readAll();
        const idx = deals.findIndex(d => d.token === token);
        if (idx === -1) return null;
        const updated = await fn(deals[idx]);
        if (!updated) return deals[idx];
        deals[idx] = updated;
        await writeAllAtomic(deals);
        return deals[idx];
    });
}
