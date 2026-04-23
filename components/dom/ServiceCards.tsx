"use client";

import { motion } from "framer-motion";
import { Film, Activity, Code } from "lucide-react";
import WordReveal from "@/components/dom/WordReveal";

const cardsData = [
    {
        title: "Production",
        description: "Content Ideation, Shoot, Edit, AI, VFX & Animation",
        icon: Film,
        delay: 0.1,
    },
    {
        title: "Marketing",
        description: "The 360° Marketing Solution Hub",
        icon: Activity,
        delay: 0.3,
    },
    {
        title: "Creative Tech",
        description: "Full-Stack Architecture, 3D WebGL & Interactive Experiences",
        icon: Code,
        delay: 0.5,
    }
];

export default function ServiceCards() {
    return (
        <section className="relative z-10 w-full min-h-screen flex items-center justify-center py-20 px-[var(--spacing-container)] bg-black text-white">
            <div className="max-w-7xl mx-auto w-full">

                <div className="mb-16 text-center">
                    <WordReveal
                        text="OUR EXPERTISE"
                        tag="h3"
                        className="text-sm tracking-[0.3em] uppercase opacity-60 mb-4"
                    />
                    <WordReveal
                        text="Crafting digital excellence across all dimensions."
                        tag="h2"
                        className="text-3xl md:text-5xl font-serif"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {cardsData.map((card, idx) => {
                        const Icon = card.icon;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.8, delay: card.delay, ease: [0.16, 1, 0.3, 1] }}
                                whileHover={{ y: -10, scale: 1.02 }}
                                animate={{ y: [0, -8, 0] }}
                                style={{
                                    animation: `floatBob 6s ease-in-out infinite ${card.delay * 2}s`
                                }}
                                className="premium-blue-gradient rounded-2xl p-8 h-[350px] flex flex-col justify-between shadow-2xl shadow-blue-900/20 border border-white/10 hover:border-white/30 transition-colors"
                            >
                                <div className="p-4 bg-white/10 rounded-full w-max backdrop-blur-md">
                                    <Icon size={32} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                                </div>

                                <div>
                                    <h4 className="text-3xl mb-3 font-medium bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
                                        {card.title}
                                    </h4>
                                    <p className="text-sm opacity-80 leading-relaxed font-light">
                                        {card.description}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes floatBob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-12px); }
                }
            `}} />
        </section>
    );
}
