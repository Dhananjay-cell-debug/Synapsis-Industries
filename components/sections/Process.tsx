"use client";

import WordReveal from "@/components/dom/WordReveal";

const steps = [
    {
        number: "01",
        title: "The Blueprint.",
        description: "Deep-dive brand architecture. We audit, research, and map the entire customer journey and psychological triggers before a single frame is shot or line of code is written."
    },
    {
        number: "02",
        title: "The Assembly.",
        description: "Our elite production team and full-stack engineers execute the vision. Hyper-optimized video structures, bespoke 3D environments, and conversion-focused UI/UX."
    },
    {
        number: "03",
        title: "The Amplification.",
        description: "We deploy the assets into the ecosystem. Omni-channel distribution, aggressive paid media scaling, and relentless optimization to dominate market share."
    }
];

export default function Process() {
    return (
        <section className="min-h-screen w-full py-32 px-[var(--spacing-container)] bg-[#030303] text-white border-t border-white/5 relative overflow-hidden">
            {/* Subtle Grid Background */}
            <div className="absolute inset-0 z-0 opacity-10" style={{
                backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
                backgroundSize: "60px 60px"
            }} />

            <div className="max-w-6xl mx-auto w-full relative z-10">
                <div className="text-center mb-24">
                    <WordReveal
                        text="THE PROCESS"
                        tag="h3"
                        className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase opacity-40 font-bold"
                    />
                    <WordReveal
                        text="How We Build."
                        tag="h2"
                        className="text-4xl md:text-6xl font-outfit font-bold tracking-tight"
                    />
                </div>

                <div className="flex flex-col md:flex-row gap-8 relative">
                    {/* Connecting Line (Desktop only) */}
                    <div className="hidden md:block absolute top-[40px] left-0 w-full h-[1px] bg-white/10 z-0" />

                    {steps.map((step, index) => (
                        <div key={index} className="flex-1 relative z-10 group cursor-none">
                            <div className="w-20 h-20 rounded-full bg-black border border-white/20 flex items-center justify-center mb-8 relative group-hover:bg-white group-hover:text-black transition-colors duration-500">
                                <span className="font-outfit text-2xl font-bold">{step.number}</span>
                                <div className="absolute inset-0 rounded-full border border-white/40 scale-110 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
                            </div>
                            <h4 className="text-2xl font-outfit font-semibold mb-4 text-white group-hover:text-blue-400 transition-colors">{step.title}</h4>
                            <p className="opacity-70 font-outfit font-light leading-relaxed pr-0 md:pr-8">{step.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
