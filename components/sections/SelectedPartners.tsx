"use client";

import WordReveal from "@/components/dom/WordReveal";
import { brandData } from "@/config/neverlandContent";

export default function SelectedPartners() {
    return (
        <section className="min-h-[80vh] w-full flex flex-col justify-center px-[var(--spacing-container)] py-32 bg-white text-black">
            <div className="max-w-6xl mx-auto w-full">
                <WordReveal
                    text="SELECTED PARTNERS"
                    tag="h3"
                    className="mb-16 text-sm md:text-base font-outfit tracking-[0.3em] uppercase opacity-40 font-bold"
                />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-0">
                    {brandData.map((brand) => (
                        <div key={brand.name} className="border-t border-black/10 py-12 group hover:bg-black/5 transition-colors duration-500 cursor-none px-4 -mx-4 rounded-xl">
                            <h4 className="text-3xl md:text-4xl font-outfit font-bold group-hover:translate-x-4 group-hover:text-blue-600 transition-all duration-500">{brand.name}</h4>
                            <span className="text-sm font-outfit font-light opacity-50 mt-4 block">{brand.year}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
