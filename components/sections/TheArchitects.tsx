"use client";

import WordReveal from "@/components/dom/WordReveal";
import { ArrowRight } from "lucide-react";

const teamMembers = [
    {
        name: "DHANANJAY CHITMILLA",
        role: "Chief Architect & Founder",
        description: "Visionary behind the Kontentwala ecosystem. Bridging the gap between elite visual production and high-converting performance architecture.",
        image: "" // Placeholder for photo
    },
    {
        name: "THE COLLECTIVE",
        role: "VFX, Code & Growth",
        description: "A decentralized strike team of 3D artists, full-stack engineers, and media buyers operating at the highest level of digital execution.",
        image: "" // Placeholder
    }
];

export default function TheArchitects() {
    return (
        <section className="min-h-screen w-full py-32 px-[var(--spacing-container)] bg-[#f4f4f4] text-black">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex flex-col md:flex-row justify-between md:items-end mb-20">
                    <div className="max-w-2xl">
                        <WordReveal
                            text="THE ARCHITECTS"
                            tag="h3"
                            className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase opacity-40 font-bold"
                        />
                        <WordReveal
                            text="Minds behind the Machine."
                            tag="h2"
                            className="text-4xl md:text-6xl font-outfit font-bold tracking-tight leading-tight"
                        />
                    </div>
                    <div className="mt-8 md:mt-0 text-left md:text-right max-w-sm">
                        <WordReveal
                            text="We are not an agency. We are an assembly of obsessives, engineered to build brand monopolies."
                            tag="p"
                            className="text-lg opacity-70 font-outfit font-light leading-relaxed"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {teamMembers.map((member, index) => (
                        <div key={index} className="group relative overflow-hidden rounded-2xl bg-white border border-black/5 aspect-[4/5] md:aspect-square flex flex-col justify-end p-8 cursor-none">
                            {/* Inner Background gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 transition-opacity duration-500 opacity-60 group-hover:opacity-80" />

                            {/* Placeholder Image Box */}
                            <div className="absolute inset-0 bg-zinc-200 z-0 scale-100 group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-center">
                                <span className="font-outfit uppercase tracking-widest text-zinc-400 opacity-50 text-sm font-bold animate-pulse">Team Asset</span>
                            </div>

                            <div className="relative z-20 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                <h4 className="text-3xl font-outfit font-bold text-white mb-2">{member.name}</h4>
                                <span className="text-blue-400 font-outfit tracking-widest uppercase text-xs mb-4 block font-bold">{member.role}</span>
                                <p className="text-white/80 font-outfit font-light leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                                    {member.description}
                                </p>
                            </div>

                            {/* Hover Arrow */}
                            <div className="absolute top-8 right-8 z-20 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 -translate-x-4 group-hover:translate-x-0">
                                <ArrowRight className="text-white w-5 h-5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
