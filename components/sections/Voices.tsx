"use client";

import WordReveal from "@/components/dom/WordReveal";
import { Quote } from "lucide-react";

const testimonials = [
    {
        quote: "Kontentwala doesn't just make videos; they build entire digital ecosystems that print money. Our ROAS tripled within the first 30 days of deploying their funnel.",
        author: "Sarah J.",
        role: "CMO, TechVision"
    },
    {
        quote: "The 3D WebGL experience they built for our launch completely redefined our brand identity. It wasn't just a website, it was a piece of interactive art.",
        author: "Mark D.",
        role: "Founder, Aura"
    }
];

export default function Voices() {
    return (
        <section className="min-h-[80vh] w-full py-32 px-[var(--spacing-container)] bg-black text-white border-t border-white/5 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/10 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full relative z-10">
                <div className="text-center mb-24">
                    <WordReveal
                        text="VOICES"
                        tag="h3"
                        className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase opacity-40 font-bold"
                    />
                    <WordReveal
                        text="What the Industry Says."
                        tag="h2"
                        className="text-4xl md:text-6xl font-outfit font-bold tracking-tight"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {testimonials.map((testi, index) => (
                        <div key={index} className="bg-white/5 border border-white/10 p-12 rounded-3xl relative group hover:bg-white/10 transition-colors duration-500 cursor-none">
                            <Quote className="w-12 h-12 text-blue-500/20 absolute top-8 left-8 group-hover:text-blue-500/40 transition-colors duration-500" />
                            <p className="text-xl md:text-2xl font-outfit font-light leading-relaxed mb-12 relative z-10 opacity-90">
                                "{testi.quote}"
                            </p>
                            <div className="flex items-center gap-4 border-t border-white/10 pt-6">
                                <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center font-outfit font-bold text-lg">
                                    {testi.author.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-outfit font-semibold text-lg">{testi.author}</h4>
                                    <span className="font-outfit text-sm opacity-50 uppercase tracking-widest block font-bold mt-1">{testi.role}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
