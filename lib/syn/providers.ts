// ─── SYN MULTI-PROVIDER WATERFALL ──────────────────────────────────────────
// Never-fail chat caller. Tries providers in order, rotating through keys.
// On any error (rate-limit, balance, 5xx, network) — moves to the next key,
// then the next provider. Returns the first streaming Response that works.
//
// Order matters — primary is OpenRouter (DeepSeek V3, the user's chosen
// "feel"), then Groq Llama 3.3 (sub-second TTFT), Cerebras (insane speed),
// Nvidia (catch-all). Adding new providers = drop one entry into PROVIDERS.

type Msg = { role: string; content: string };

interface Provider {
    name: string;
    endpoint: string;
    model: string;
    keys: string[];
    extraHeaders?: Record<string, string>;
    // Some providers (Nvidia) require slightly different body shape, but for
    // chat-completions v1 the OpenAI shape is universally accepted.
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
                "X-Title": "Synapsis Syn",
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

interface SuccessResult {
    response: Response;          // streaming body — caller pipes it
    provider: string;
    model: string;
    keyHint: string;             // last 4 chars of the working key (for logs)
}

export async function callSynStream(
    messages: Msg[],
    opts?: { temperature?: number; maxTokens?: number },
): Promise<SuccessResult> {
    const providers = buildProviders();
    if (providers.length === 0) {
        throw new Error("no_providers_configured");
    }

    const errors: string[] = [];
    for (const p of providers) {
        for (const key of p.keys) {
            const keyHint = key.slice(-4);
            try {
                const res = await fetch(p.endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${key}`,
                        ...(p.extraHeaders || {}),
                    },
                    body: JSON.stringify({
                        model: p.model,
                        stream: true,
                        temperature: opts?.temperature ?? 0.6,
                        max_tokens: opts?.maxTokens ?? 1200,
                        messages,
                    }),
                });
                if (res.ok && res.body) {
                    return { response: res, provider: p.name, model: p.model, keyHint };
                }
                const text = await res.text().catch(() => "");
                errors.push(`${p.name}#${keyHint}: ${res.status} ${text.slice(0, 200)}`);
                // 401 = bad key; 402 = insufficient balance; 429 = rate-limit. Move on.
            } catch (e: any) {
                errors.push(`${p.name}#${keyHint}: ${String(e?.message || e).slice(0, 200)}`);
            }
        }
    }
    const err: any = new Error("all_providers_failed");
    err.details = errors;
    throw err;
}
