import { NextRequest, NextResponse } from "next/server";
import { mutateDeal } from "@/lib/phases/dealStore";

export async function POST(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    const { token } = params;
    const body = await req.json().catch(() => null);
    const answers = body?.answers;

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
        return NextResponse.json({ error: "Missing or invalid `answers` object" }, { status: 400 });
    }

    const updated = await mutateDeal(token, (deal) => ({
        ...deal,
        questionnaire: answers,
        questionnaireSubmittedAt: Date.now(),
        lastInteractionAt: Date.now(),
    }));

    if (!updated) {
        return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
}
