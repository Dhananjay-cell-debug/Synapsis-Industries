"use client";

import WordReveal from "@/components/dom/WordReveal";

export default function ThePhilosophy() {
    return (
        <section className="min-h-screen w-full flex items-center py-24 px-[var(--spacing-container)] bg-white text-black relative overflow-hidden">
            {/* Very subtle background noise/texture for premium feel */}
            <div className="absolute inset-0 z-0 opacity-[0.02]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            }} />

            <div className="max-w-5xl mx-auto text-center relative z-10">
                <WordReveal
                    text="THE PHILOSOPHY"
                    tag="h3"
                    className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase opacity-40 font-bold"
                />

                <WordReveal
                    text="We build Digital Cathedrals."
                    tag="h2"
                    className="mb-12 text-5xl md:text-7xl font-outfit font-bold tracking-tighter leading-none"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left mt-16 mt-8 border-t border-black/10 pt-12">
                    <div>
                        <WordReveal
                            text="Architecture over Templates."
                            tag="h4"
                            className="text-2xl font-outfit font-semibold mb-4"
                        />
                        <WordReveal
                            text="A template is forgotten instantly. Architecture stands the test of time. We construct bespoke digital experiences designed to convert, mesmerize, and dominate."
                            tag="p"
                            className="text-lg opacity-70 font-outfit font-light leading-relaxed"
                        />
                    </div>
                    <div>
                        <WordReveal
                            text="Ecosystems over Posts."
                            tag="h4"
                            className="text-2xl font-outfit font-semibold mb-4"
                        />
                        <WordReveal
                            text="Brands don't grow on single posts. They grow on interconnected systems of high-converting funnels, elite production, and ruthless performance tech."
                            tag="p"
                            className="text-lg opacity-70 font-outfit font-light leading-relaxed"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

