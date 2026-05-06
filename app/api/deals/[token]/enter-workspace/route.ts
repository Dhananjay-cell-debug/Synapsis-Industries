// Client-triggered action after questionnaire completion.
// Bumps deal from phase 1 → 2, no admin preconditions required.
import { NextRequest, NextResponse } from "next/server";
import { mutateDeal } from "@/lib/phases/dealStore";

export async function POST(
    _req: NextRequest,
    { params }: { params: { token: string } }
) {
    const { token } = params;

    const updated = await mutateDeal(token, (deal) => {
        if (!deal.questionnaire || Object.keys(deal.questionnaire).length === 0) {
            return deal; // guard: questionnaire must exist
        }
        return {
            ...deal,
            phase: 2,
            status: deal.status === "pending" ? "elected" : deal.status,
            electedAt: deal.electedAt ?? Date.now(),
            phaseData: {
                ...(deal.phaseData || {}),
                phase2: {
                    ...(deal.phaseData?.phase2 || {}),
                    startedAt: Date.now(),
                    levelTab: "overview",
                    changeRequestCount: 0,
                },
            },
            lastInteractionAt: Date.now(),
        } as typeof deal;
    });

    if (!updated) {
        return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
}
