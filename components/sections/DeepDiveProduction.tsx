"use client";

import WordReveal from "@/components/dom/WordReveal";

export default function DeepDiveProduction() {
    return (
        <section className="min-h-screen w-full flex items-center py-24 px-[var(--spacing-container)] bg-[#050505] text-white overflow-hidden relative border-t border-white/5">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
                <div className="order-2 md:order-1 relative">
                    {/* Placeholder for Video/Image asset - Can be swapped later */}
                    <div className="aspect-[4/5] rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-outfit text-white/30 tracking-widest text-sm uppercase">Cinematic Asset</span>
                        </div>
                    </div>
                </div>

                <div className="order-1 md:order-2">
                    <WordReveal
                        text="01 / PRODUCTION"
                        tag="h4"
                        className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase text-blue-400 font-bold"
                    />
                    <WordReveal
                        text="We Shoot to Kill Algorithms."
                        tag="h2"
                        className="mb-8 text-4xl md:text-6xl font-outfit font-bold tracking-tight leading-tight"
                    />
                    <WordReveal
                        text="Your product isn't boring, your presentation is. We utilize cinema-grade cameras, insane VFX pipelines, and AI-driven edits to create visual assets that demand respect. From short-form viral hooks to documentary-style brand films, we manufacture authority."
                        tag="p"
                        className="text-lg md:text-xl leading-relaxed opacity-70 font-outfit font-light mb-8 block"
                    />

                    <ul className="space-y-4 font-outfit text-white/80">
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Viral Short-Form Architecture
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> High-End Brand Films
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 3D Product Renders & VFX
                        </li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
