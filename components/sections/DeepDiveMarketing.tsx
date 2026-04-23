"use client";

import WordReveal from "@/components/dom/WordReveal";

export default function DeepDiveMarketing() {
    return (
        <section className="min-h-screen w-full flex items-center py-24 px-[var(--spacing-container)] bg-[#0a0a0a] text-white overflow-hidden relative border-t border-white/5">
            {/* Background Accent */}
            <div className="absolute top-[40%] left-[-100px] w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
                <div className="order-2 md:order-2 relative">
                    {/* Placeholder for Video/Image asset */}
                    <div className="aspect-[4/5] rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-outfit text-white/30 tracking-widest text-sm uppercase">Growth Matrix Asset</span>
                        </div>
                    </div>
                </div>

                <div className="order-1 md:order-1 pr-0 md:pr-12">
                    <WordReveal
                        text="02 / MARKETING"
                        tag="h4"
                        className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase text-purple-400 font-bold"
                    />
                    <WordReveal
                        text="Attention is Currency."
                        tag="h2"
                        className="mb-8 text-4xl md:text-6xl font-outfit font-bold tracking-tight leading-tight"
                    />
                    <WordReveal
                        text="A beautiful video with zero views is a tragedy. Our distribution network ensures your message lands in front of the exact eyeballs that convert. We deploy omni-channel paid strategies, ruthless organic scaling, and deep data analysis to monopolize market share."
                        tag="p"
                        className="text-lg md:text-xl leading-relaxed opacity-70 font-outfit font-light mb-8 block"
                    />

                    <ul className="space-y-4 font-outfit text-white/80">
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Omni-Channel Media Buying
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> High-Converting Sales Funnels
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Community Scaling & Moderation
                        </li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
