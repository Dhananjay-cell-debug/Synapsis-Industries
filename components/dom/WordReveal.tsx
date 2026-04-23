"use client";

import { useEffect, useRef } from "react";

export default function WordReveal({ text, className, tag = "p" }: {
    text: string, className?: string, tag?: "p" | "h2" | "h3" | "h4"
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const words = ref.current?.querySelectorAll(".word");
        if (!words) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                words.forEach((el, i) => {
                    const span = el as HTMLElement;
                    setTimeout(() => {
                        span.style.opacity = "1";
                        span.style.transform = "translateY(0)";
                    }, i * 50);
                });
                observer.disconnect();
            }
        }, { threshold: 0.2 });

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    const Tag = tag;

    return (
        <Tag ref={ref as any} className={className}>
            {text.split(" ").map((word, i) => (
                <span
                    key={i}
                    className="word inline-block mr-[0.3em] transition-all duration-700 ease-out"
                    style={{ opacity: 0, transform: "translateY(8px)" }}
                >
                    {word}
                </span>
            ))}
        </Tag>
    );
}
