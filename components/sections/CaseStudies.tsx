"use client";

import { useEffect, useState } from "react";
import WordReveal from "@/components/dom/WordReveal";
import { ArrowUpRight } from "lucide-react";

interface Project {
    id: string;
    name: string;
    tagline: string;
    summary: string;
    category: string[];
    stack: string[];
}

const staticCaseStudies = [
    {
        title: "Nike Air Max Launch",
        metric: "+340% ROAS",
        description: "Full funnel 3D campaign architecture resulting in record D2C sales.",
        tag: "Web3 & 3D WebGL",
    },
    {
        title: "SuitSupply Horizon",
        metric: "12M Views",
        description: "Viral short-form organic strategy focused on high-end luxury lifestyle.",
        tag: "Organic Growth",
    },
    {
        title: "Rolex Heritage",
        metric: "2.1x Engagement",
        description: "Documentary-style brand film capturing the essence of timekeeping.",
        tag: "Production",
    },
];

export default function CaseStudies() {
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        fetch("/api/projects")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setProjects(data);
                }
            })
            .catch(() => {
                // Silently fallback to static data
            });
    }, []);

    // Combine dynamic and static data (prioritize dynamic)
    const displayItems = projects.length > 0 
        ? projects.map(p => ({
            title: p.name,
            metric: "LIVE", // Placeholder for now
            description: p.summary || p.tagline,
            tag: p.category.join(" & "),
        }))
        : staticCaseStudies;

    return (
        <section className="min-h-screen w-full py-32 px-[var(--spacing-container)] bg-white text-black">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex flex-col md:flex-row justify-between items-end mb-24 border-b border-black/10 pb-12">
                    <div>
                        <WordReveal
                            text="THE VAULT"
                            tag="h3"
                            className="mb-6 text-sm md:text-base font-outfit tracking-[0.3em] uppercase opacity-40 font-bold"
                        />
                        <WordReveal
                            text="Architectural Wins."
                            tag="h2"
                            className="text-4xl md:text-6xl font-outfit font-bold tracking-tight"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-12">
                    {displayItems.map((study, index) => (
                        <div key={index} className="group flex flex-col md:flex-row items-start md:items-center justify-between p-8 rounded-2xl hover:bg-black/5 transition-colors cursor-none border border-transparent hover:border-black/10">
                            <div className="flex-1 mb-6 md:mb-0 pr-0 md:pr-12">
                                <span className="text-xs font-outfit tracking-widest uppercase opacity-50 mb-4 block font-bold">{study.tag}</span>
                                <h4 className="text-3xl md:text-4xl font-outfit font-bold group-hover:text-blue-600 transition-colors">{study.title}</h4>
                                <p className="mt-4 text-lg font-outfit font-light opacity-70 max-w-lg leading-relaxed">{study.description}</p>
                            </div>

                            <div className="flex flex-col md:items-end w-full md:w-auto mt-6 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0 border-black/10">
                                <span className="text-4xl md:text-5xl font-outfit font-light tracking-tighter text-blue-600">{study.metric}</span>
                                <span className="text-sm font-outfit uppercase tracking-widest opacity-40 mt-2 font-bold">Key Result</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
