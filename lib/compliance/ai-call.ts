// ─── AI CALL — non-streaming JSON-mode caller ──────────────────────────────
// Mirrors the syn/providers.ts waterfall but in non-streaming JSON mode,
// for tasks like expense extraction where we need a full structured object
// back, not a stream. Same env keys, same fallback order.

import "server-only";

interface Msg { role: "system" | "user" | "assistant"; content: string }

interface Provider {
    name: string;
    endpoint: string;
    model: string;
    keys: string[];
    extraHeaders?: Record<string, string>;
}

function pickKeys(...vars: (string | undefined)[]): string[] {
    return vars.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function buildProviders(): Provider[] {
    return [
        {
            name: "openrouter/deepseek",
            endpoint: "https://openrouter.ai/api/v1/chat/completions",
            model: "deepseek/deepseek-chat",
            keys: pickKeys(
                process.env.OPENROUTER_API_KEY_1,
                process.env.OPENROUTER_API_KEY_2,
                process.env.OPENROUTER_API_KEY_3,
            ),
            extraHeaders: {
                "HTTP-Referer": "https://synapsis-industries.vercel.app",
                "X-Title": "Synapsis Compliance",
            },
        },
        {
            name: "groq/llama-3.3-70b",
            endpoint: "https://api.groq.com/openai/v1/chat/completions",
            model: "llama-3.3-70b-versatile",
            keys: pickKeys(
                process.env.GROQ_API_KEY,
                process.env.GROQ_API_KEY_2,
                process.env.GROQ_API_KEY_3,
                process.env.GROQ_API_KEY_4,
            ),
        },
        {
            name: "cerebras/llama-3.3-70b",
            endpoint: "https://api.cerebras.ai/v1/chat/completions",
            model: "llama-3.3-70b",
            keys: pickKeys(
                process.env.CEREBRAS_API_KEY_1,
                process.env.CEREBRAS_API_KEY_2,
            ),
        },
        {
            name: "nvidia/llama-3.3-70b",
            endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
            model: "meta/llama-3.3-70b-instruct",
            keys: pickKeys(
                process.env.NVIDIA_API_KEY_1,
                process.env.NVIDIA_API_KEY_2,
            ),
        },
    ].filter(p => p.keys.length > 0);
}

export interface CallResult {
    content: string;
    provider: string;
    model: string;
}

/**
 * Non-streaming call. Returns the full text content from the first provider
 * that succeeds. Throws if every key on every provider fails.
 */
export async function callAiJson(
    messages: Msg[],
    opts?: { temperature?: number; maxTokens?: number; responseFormatJson?: boolean }
): Promise<CallResult> {
    const providers = buildProviders();
    if (providers.length === 0) throw new Error("no_ai_providers_configured");

    const errors: string[] = [];
    for (const p of providers) {
        for (const key of p.keys) {
            const keyHint = key.slice(-4);
            try {
                const body: Record<string, unknown> = {
                    model: p.model,
                    stream: false,
                    temperature: opts?.temperature ?? 0.2,
                    max_tokens: opts?.maxTokens ?? 2400,
                    messages,
                };
                if (opts?.responseFormatJson) {
                    body.response_format = { type: "json_object" };
                }
                const res = await fetch(p.endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${key}`,
                        ...(p.extraHeaders || {}),
                    },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    errors.push(`${p.name}#${keyHint}: ${res.status} ${text.slice(0, 200)}`);
                    continue;
                }
                const data = await res.json();
                const content = data?.choices?.[0]?.message?.content;
                if (typeof content === "string" && content.length > 0) {
                    return { content, provider: p.name, model: p.model };
                }
                errors.push(`${p.name}#${keyHint}: empty content`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                errors.push(`${p.name}#${keyHint}: ${msg.slice(0, 200)}`);
            }
        }
    }
    const err = new Error("all_ai_providers_failed") as Error & { details: string[] };
    err.details = errors;
    throw err;
}

/**
 * Extracts the JSON object from an LLM response. Handles:
 *  - raw JSON string
 *  - JSON wrapped in ```json ... ``` fences
 *  - JSON embedded in surrounding prose
 */
export function extractJsonObject(text: string): unknown {
    const trimmed = text.trim();
    // Try direct parse first
    try { return JSON.parse(trimmed); } catch { /* try other strategies */ }
    // Strip fenced code blocks
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fence) {
        try { return JSON.parse(fence[1].trim()); } catch { /* fall through */ }
    }
    // Find first { ... last }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
        try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* give up */ }
    }
    throw new Error("Could not parse JSON from LLM response");
}
