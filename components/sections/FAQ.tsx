"use client";

import WordReveal from "@/components/dom/WordReveal";
import { Plus } from "lucide-react";
import { useState } from "react";

const faqs = [
    {
        question: "How long does a standard project take?",
        answer: "We don't do 'standard' projects. But typically, a full 3D WebGL ecosystem or high-end production campaign takes between 4 to 8 weeks from strategic blueprint to final deployment."
    },
    {
        question: "Do you work with early-stage startups?",
        answer: "Yes, if the vision is aggressively ambitious. We prefer to partner with founders who understand that exceptional design and engineering are growth levers, not expenses."
    },
    {
        question: "What is your pricing architecture?",
        answer: "Every digital cathedral is bespoke. Engagements typically start in the mid five-figures, scaling with the complexity of the WebGL environments, production days, and marketing scope."
    }
];

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="min-h-screen w-full py-32 px-[var(--spacing-container)] bg-[#f4f4f4] text-black border-t border-black/5">
            <div className="max-w-4xl mx-auto w-full">
                <div className="text-center mb-24">
                    <WordReveal
                        text="INTELLIGENCE"
                        tag="h3"
                        className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase opacity-40 font-bold"
                    />
                    <WordReveal
                        text="Frequently Asked."
                        tag="h2"
                        className="text-4xl md:text-6xl font-outfit font-bold tracking-tight"
                    />
                </div>

                <div className="flex flex-col gap-4">
                    {faqs.map((faq, index) => (
                        <div key={index} className="bg-white rounded-2xl border border-black/5 overflow-hidden transition-all duration-500 hover:border-black/20">
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full text-left px-8 py-6 flex items-center justify-between cursor-none"
                            >
                                <span className="font-outfit font-semibold text-xl md:text-2xl tracking-tight pr-8">{faq.question}</span>
                                <div className={`w-10 h-10 rounded-full border border-black/10 flex items-center justify-center transition-transform duration-500 ${openIndex === index ? 'rotate-45 bg-black text-white border-black' : 'bg-transparent text-black'}`}>
                                    <Plus className="w-5 h-5" />
                                </div>
                            </button>

                            <div
                                className={`px-8 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${openIndex === index ? 'max-h-96 pb-8 opacity-100' : 'max-h-0 opacity-0'}`}
                            >
                                <p className="font-outfit font-light text-lg opacity-70 leading-relaxed border-t border-black/5 pt-6 mt-2">
                                    {faq.answer}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
