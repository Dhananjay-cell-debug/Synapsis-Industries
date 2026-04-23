"use client";

import WordReveal from "@/components/dom/WordReveal";

export default function DeepDiveTech() {
    return (
        <section className="min-h-screen w-full flex items-center py-24 px-[var(--spacing-container)] bg-[#050505] text-white overflow-hidden relative border-t border-white/5 pb-32">
            {/* Background Accent */}
            <div className="absolute bottom-0 right-10 w-[500px] h-[500px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
                <div className="order-2 md:order-1 relative">
                    {/* Placeholder for Video/Image asset */}
                    <div className="aspect-[4/5] rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/40 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-outfit text-white/30 tracking-widest text-sm uppercase">WebGL Ecosystem Asset</span>
                        </div>
                    </div>
                </div>

                <div className="order-1 md:order-2">
                    <WordReveal
                        text="03 / CREATIVE TECH"
                        tag="h4"
                        className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase text-emerald-400 font-bold"
                    />
                    <WordReveal
                        text="Code that Commands."
                        tag="h2"
                        className="mb-8 text-4xl md:text-6xl font-outfit font-bold tracking-tight leading-tight"
                    />
                    <WordReveal
                        text="We don't do basic templates. Kontentwala Engineering builds bespoke WebGL experiences, interactive 3D environments, and scalable AI applications. From immersive landing pages that hook the viewer instantly, to deep SaaS product architecture."
                        tag="p"
                        className="text-lg md:text-xl leading-relaxed opacity-70 font-outfit font-light mb-8 block"
                    />

                    <ul className="space-y-4 font-outfit text-white/80">
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Three.js / R3F Experiences
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Custom AI Tooling & RAG
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Scalable Full-Stack Engineering
                        </li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
