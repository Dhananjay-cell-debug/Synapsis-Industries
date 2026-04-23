"use client";

import WordReveal from "@/components/dom/WordReveal";
import { storyContent } from "@/config/neverlandContent";

export default function TerminalCTA() {
    return (
        <section className="h-screen w-full flex items-center justify-center bg-black text-white px-[var(--spacing-container)] relative overflow-hidden">
            {/* Dark abstract pulse at the end of the journey */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[800px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black opacity-50 blur-[50px] pointer-events-none" />
            </div>

            <div className="text-center relative z-10 max-w-4xl mx-auto flex flex-col items-center">
                <WordReveal
                    text="TERMINAL"
                    tag="h3"
                    className="mb-8 text-sm md:text-base font-outfit tracking-[0.5em] uppercase opacity-40 font-bold"
                />

                <WordReveal
                    text={storyContent.connect}
                    tag="h2"
                    className="mb-16 text-5xl md:text-7xl lg:text-8xl font-outfit font-bold tracking-tighter leading-none text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                />

                <a
                    href="mailto:hello@kontentwala.com"
                    className="group relative inline-flex items-center justify-center px-8 py-4 font-outfit font-bold text-lg tracking-widest uppercase text-black bg-white rounded-full overflow-hidden transition-transform duration-300 hover:scale-105 active:scale-95"
                    style={{ cursor: "none" }}
                >
                    <span className="absolute inset-0 w-full h-full bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)]" />
                    <span className="relative z-10 group-hover:text-white transition-colors duration-500">
                        Initialize Project
                    </span>
                </a>
            </div>
        </section>
    );
}
