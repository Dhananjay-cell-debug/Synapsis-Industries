"use client";

import { motion } from "framer-motion";

interface ScrollNavigationProps {
    activeIndex: number;
}

const sections = [
    { num: "01", name: "THE GATE" },
    { num: "02", name: "THE MONUMENT" },
    { num: "03", name: "THE STORY" },
];

export default function ScrollNavigation({ activeIndex }: ScrollNavigationProps) {
    return (
        <div className="fixed right-6 md:right-12 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-12 pointer-events-none mix-blend-difference text-white/50">
            {sections.map((section, idx) => {
                const isActive = activeIndex === idx;

                return (
                    <div key={section.num} className="relative flex items-center justify-end group">

                        {/* The Text Label (Shows on hover or active) */}
                        <motion.span
                            initial={{ opacity: 0, x: 20 }}
                            animate={{
                                opacity: isActive ? 1 : 0,
                                x: isActive ? 0 : 20
                            }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="absolute right-8 text-xs font-mono tracking-widest whitespace-nowrap text-white"
                        >
                            {section.name}
                        </motion.span>

                        {/* The Number */}
                        <span
                            className={`font-mono text-sm transition-colors duration-500 ${isActive ? "text-white font-bold" : "text-white/40"
                                }`}
                        >
                            {section.num}
                        </span>

                        {/* The Indicator Line */}
                        <motion.div
                            className="absolute -right-4 top-1/2 -translate-y-1/2 w-[2px] bg-white rounded-full"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{
                                height: isActive ? 32 : 0,
                                opacity: isActive ? 1 : 0
                            }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
