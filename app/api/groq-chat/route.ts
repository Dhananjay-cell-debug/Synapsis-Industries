import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { messages, clientContext } = await req.json();

    const systemPrompt = `You are a strategic discovery assistant helping Dhananjay Chitmilla (founder of Vark Industries — a premium software agency) craft the perfect 6 Phase 1 discovery questions for a specific client.

Vark builds: AI automation systems, full-stack web apps, agentic workflows, payment integrations, API integrations, digital ecosystem architecture.

CLIENT DETAILS:
- Name: ${clientContext.name}
- Company: ${clientContext.company}
- What they need: ${clientContext.need}
- Budget: ${clientContext.budget || "not specified"}
- Their message: ${clientContext.message}

YOUR JOB:
Help craft 6 targeted discovery questions specifically for this client. Each question should extract:
Q1 — The exact failure point / real problem (specific, not generic)
Q2 — Definition of success (measurable outcome, number, before/after)
Q3 — What they've already tried (tools, agencies, internal attempts)
Q4 — Technical reality (current stack, integrations needed, what they already have)
Q5 — Non-negotiables (fixed features or constraints that cannot change)
Q6 — Stakeholders & decision speed (who approves, how fast)

RULES:
- Questions must be specific to THIS client, not generic
- Short questions — detail comes from the answer
- No corporate jargon
- Direct and curious, not interrogatory
- As we chat, suggest questions and refine them based on feedback
- When a question is confirmed, format it like: ✓ Q[N]: "question text"
- When all 6 are confirmed, present a final clean list

Be direct. Think like a senior technical architect who has built 50+ systems and knows exactly what information kills projects when missing.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages,
            ],
            temperature: 0.7,
            max_tokens: 1500,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("Groq API error:", err);
        return NextResponse.json({ error: "Groq API failed", detail: err }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content });
}
