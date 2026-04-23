"use client";

import WordReveal from "@/components/dom/WordReveal";
import { Play } from "lucide-react";

export default function TheShowreel() {
    return (
        <section className="h-screen w-full flex items-center justify-center relative overflow-hidden bg-black text-white px-[var(--spacing-container)]">
            {/* Background Video Placeholder */}
            <div className="absolute inset-0 z-0">
                <div className="w-full h-full bg-zinc-900" />
                <div className="absolute inset-0 bg-black/60" /> {/* Dark overlay for text readability */}
            </div>

            <div className="relative z-10 text-center flex flex-col items-center">
                <button className="w-24 h-24 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center mb-12 hover:scale-110 transition-transform duration-500 group" style={{ cursor: 'none' }}>
                    <Play className="w-8 h-8 text-white ml-2 group-hover:text-blue-400 transition-colors" />
                </button>

                <WordReveal
                    text="PLAY THE REEL"
                    tag="h3"
                    className="mb-6 text-sm md:text-base font-outfit tracking-[0.5em] uppercase opacity-80 font-bold"
                />

                <WordReveal
                    text="Witness the Architecture."
                    tag="h2"
                    className="text-4xl md:text-7xl font-outfit font-bold tracking-tight leading-tight"
                />
            </div>
        </section>
    );
}
