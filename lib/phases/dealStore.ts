// ─── DEAL STORE (Supabase for persistent storage) ───────────────────────────
// Replaces filesystem JSON. All reads/writes go through Supabase synapsis schema.

import { supabase } from "@/lib/supabase";
import type { Deal } from "@/app/api/deals/route";

function rowToDeal(row: any): Deal {
    return {
        token: row.token,
        submissionId: row.submission_id,
        name: row.name,
        company: row.company || "",
        need: row.need || "",
        budget: row.budget || "",
        message: row.message || "",
        createdAt: new Date(row.created_at).getTime(),
        status: row.status,
        phase: row.phase,
        electedAt: row.elected_at ? new Date(row.elected_at).getTime() : undefined,
        rejectedAt: row.rejected_at ? new Date(row.rejected_at).getTime() : undefined,
        rejectionNote: row.rejection_note || undefined,
        extendedUntil: row.extended_until ? new Date(row.extended_until).getTime() : undefined,
        clientNote: row.client_note || undefined,
        questionnaire: row.questionnaire || undefined,
        questionnaireSubmittedAt: row.questionnaire_submitted_at ? new Date(row.questionnaire_submitted_at).getTime() : undefined,
        messages: row.messages || undefined,
        totalPrice: row.total_price ? Number(row.total_price) : undefined,
        currency: row.currency || "INR",
        paymentProvider: row.payment_provider || "razorpay",
        acceptInternationalCards: row.accept_international_cards || false,
        clientCountry: row.client_country || undefined,
        payments: row.payments || undefined,
        projectDays: row.project_days || undefined,
        customQuestions: row.custom_questions || undefined,
        interestChatHistory: row.interest_chat_history || undefined,
        phaseData: row.phase_data || undefined,
        audit: row.audit || undefined,
        chatMessages: row.chat_messages || undefined,
        clientId: row.client_id || undefined,
        lastInteractionAt: row.last_interaction_at ? new Date(row.last_interaction_at).getTime() : undefined,
    };
}

function dealToDbUpdate(deal: Deal): Record<string, any> {
    return {
        token: deal.token,
        submission_id: deal.submissionId,
        name: deal.name,
        company: deal.company,
        need: deal.need,
        budget: deal.budget,
        message: deal.message,
        status: deal.status,
        phase: deal.phase,
        elected_at: deal.electedAt ? new Date(deal.electedAt).toISOString() : null,
        rejected_at: deal.rejectedAt ? new Date(deal.rejectedAt).toISOString() : null,
        rejection_note: deal.rejectionNote || null,
        extended_until: deal.extendedUntil ? new Date(deal.extendedUntil).toISOString() : null,
        client_note: deal.clientNote || null,
        questionnaire: deal.questionnaire || null,
        questionnaire_submitted_at: deal.questionnaireSubmittedAt ? new Date(deal.questionnaireSubmittedAt).toISOString() : null,
        messages: deal.messages || [],
        total_price: deal.totalPrice || null,
        currency: deal.currency || "INR",
        payment_provider: deal.paymentProvider || "razorpay",
        accept_international_cards: deal.acceptInternationalCards || false,
        client_country: deal.clientCountry || null,
        payments: deal.payments || [],
        project_days: deal.projectDays || null,
        custom_questions: deal.customQuestions || [],
        interest_chat_history: deal.interestChatHistory || [],
        phase_data: deal.phaseData || null,
        audit: deal.audit || [],
        chat_messages: deal.chatMessages || [],
        client_id: deal.clientId || null,
        last_interaction_at: deal.lastInteractionAt ? new Date(deal.lastInteractionAt).toISOString() : null,
    };
}

export async function readAllDeals(): Promise<Deal[]> {
    const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[dealStore] readAllDeals error:", error.message);
        return [];
    }

    return (data || []).map(rowToDeal);
}

export async function writeAllDeals(deals: Deal[]): Promise<void> {
    // Bulk upsert — used sparingly (migration, bulk updates)
    for (const deal of deals) {
        await supabase
            .from("deals")
            .upsert(dealToDbUpdate(deal), { onConflict: "token" });
    }
}

export async function findDealByToken(token: string): Promise<Deal | null> {
    const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("token", token)
        .single();

    if (error || !data) return null;
    return rowToDeal(data);
}

export async function mutateDeal(
    token: string,
    fn: (deal: Deal) => Deal
): Promise<Deal | null> {
    const { data: existing, error: fetchErr } = await supabase
        .from("deals")
        .select("*")
        .eq("token", token)
        .single();

    if (fetchErr || !existing) return null;

    const updated = fn(rowToDeal(existing));
    const { data, error } = await supabase
        .from("deals")
        .update(dealToDbUpdate(updated))
        .eq("token", token)
        .select()
        .single();

    if (error) {
        console.error("[dealStore] mutateDeal error:", error.message);
        return null;
    }

    return rowToDeal(data);
}
