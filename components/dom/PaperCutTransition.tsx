'use client';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

// 6 strips — each has custom width percentage so they look organic (not uniform)
const STRIPS = [
    { widthPercent: 14, left: 0 },
    { widthPercent: 18, left: 14 },
    { widthPercent: 16, left: 32 },
    { widthPercent: 20, left: 48 },
    { widthPercent: 15, left: 68 },
    { widthPercent: 17, left: 83 },
];

const STRIP_COLOR = '#ffffff'; // white pieces — revealing white sign-up page

type Phase = 'idle' | 'enter' | 'exit';

export default function PaperCutTransition() {
    const [phase, setPhase] = useState<Phase>('idle');
    const triggered = useRef(false);
    const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
    const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (triggered.current) return;

            const scrollY = window.scrollY;
            const vh = window.innerHeight;
            // Hero spacer = 500vh = 5 * innerHeight
            // Trigger at 90% through (4.5x) so strips arrive just before white page reveals
            const threshold = vh * 4.5;

            if (scrollY >= threshold) {
                triggered.current = true;

                // Step 1 — strips sweep UP from below covering the cave exit
                setPhase('enter');

                // Step 2 — strips sweep UP and away, revealing white page below
                t1.current = setTimeout(() => setPhase('exit'), 650);

                // Step 3 — cleanup
                t2.current = setTimeout(() => setPhase('idle'), 1400);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (t1.current) clearTimeout(t1.current);
            if (t2.current) clearTimeout(t2.current);
        };
    }, []);

    if (phase === 'idle') return null;

    return (
        <div
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 9990 }}
        >
            {STRIPS.map((strip, i) => (
                <motion.div
                    key={i}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: `${strip.left}%`,
                        width: `${strip.widthPercent + 1}%`, // +1% overlap to avoid gaps
                        height: '115%',
                        background: STRIP_COLOR,
                        // Slight shadow to give paper depth
                        boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
                    }}
                    // All strips start below viewport, sweep UP to cover, then UP and out
                    initial={{ y: '115%' }}
                    animate={{ y: phase === 'enter' ? '0%' : '-115%' }}
                    transition={{
                        duration: 0.45,
                        delay: i * 0.06, // stagger: 60ms per strip = left-to-right reveal
                        ease: [0.76, 0, 0.24, 1],
                    }}
                />
            ))}
        </div>
    );
}
