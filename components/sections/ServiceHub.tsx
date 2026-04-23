"use client";

import WordReveal from "@/components/dom/WordReveal";
import { Film, Activity, Code } from "lucide-react";

export default function ServiceHub() {
    return (
        <section className="min-h-screen w-full flex items-center justify-center py-24 px-[var(--spacing-container)] bg-black text-white">
            <div className="max-w-6xl mx-auto w-full">
                <div className="text-center mb-20">
                    <WordReveal
                        text="CORE CAPABILITIES"
                        tag="h3"
                        className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase opacity-40 font-bold"
                    />
                    <WordReveal
                        text="The Trinity of Hyper-Growth."
                        tag="h2"
                        className="text-4xl md:text-6xl font-outfit font-bold tracking-tight"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Production Card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors duration-500 group">
                        <div className="bg-blue-500/20 w-16 h-16 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                            <Film className="w-8 h-8 text-blue-400" />
                        </div>
                        <h4 className="text-2xl font-outfit font-semibold mb-4">Production</h4>
                        <p className="opacity-70 font-outfit font-light leading-relaxed mb-6 block">
                            Cinematic video, VFX, 3D animation, and AI-driven content generation that breaks the scroll.
                        </p>
                    </div>

                    {/* Marketing Card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors duration-500 group">
                        <div className="bg-purple-500/20 w-16 h-16 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                            <Activity className="w-8 h-8 text-purple-400" />
                        </div>
                        <h4 className="text-2xl font-outfit font-semibold mb-4">Marketing</h4>
                        <p className="opacity-70 font-outfit font-light leading-relaxed mb-6 block">
                            Data-driven funnels, precision ad-buying, and omnipresent distribution strategies.
                        </p>
                    </div>

                    {/* Tech Card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors duration-500 group">
                        <div className="bg-emerald-500/20 w-16 h-16 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                            <Code className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h4 className="text-2xl font-outfit font-semibold mb-4">Creative Tech</h4>
                        <p className="opacity-70 font-outfit font-light leading-relaxed mb-6 block">
                            Bespoke WebGL experiences, AI applications, and scalable full-stack ecosystem architecture.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
