import { useRef, useState, useEffect } from "react";
import OrbitalBackground from "@/components/ui/OrbitalBackground";
import { motion } from "framer-motion";
import { PROBLEM_CONFIG } from "@/config/problem-animation";
import { useProblemStore } from "@/store/useProblemStore";

const Typewriter = ({
    text,
    show,
    reverse,
    speed = PROBLEM_CONFIG.TEXT.TYPE_SPEED,
    delay = 0
}: {
    text: string,
    show: boolean,
    reverse: boolean,
    speed?: number,
    delay?: number
}) => {
    const characters = text.split("");

    return (
        <motion.span
            initial="hidden"
            animate={show ? (reverse ? "hidden" : "visible") : "hidden"}
            variants={{
                visible: {
                    transition: { staggerChildren: speed, delayChildren: delay }
                },
                hidden: {
                    transition: { staggerChildren: speed / 2, staggerDirection: -1 }
                }
            }}
            aria-label={text}
            className="inline-block"
        >
            {characters.map((char, i) => (
                <motion.span
                    key={i}
                    aria-hidden="true"
                    variants={{
                        hidden: { opacity: 0, y: 15, filter: 'blur(8px)', scale: 0.95 },
                        visible: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }
                    }}
                    className="inline-block"
                >
                    {char === " " ? "\u00A0" : char}
                </motion.span>
            ))}
        </motion.span>
    );
};

export default function TheProblem({ progress = 0 }: { progress?: number }) {
    const sectionRef = useRef<HTMLElement>(null);
    const [phase, setPhase] = useState<'hidden' | 'headline' | 'subheadline' | 'hold' | 'erase' | 'cleared'>('hidden');

    const config = useProblemStore();

    useEffect(() => {
        if (progress < config.headlineIn) {
            if (phase !== 'hidden') setPhase('hidden');
        } else if (progress < config.subheadlineIn) {
            if (phase !== 'headline') setPhase('headline');
        } else if (progress < config.holdStart) {
            if (phase !== 'subheadline') setPhase('subheadline');
        } else if (progress < config.eraseStart) {
            if (phase !== 'hold') setPhase('hold');
        } else if (progress < config.clearedStart) {
            if (phase !== 'erase') setPhase('erase');
        } else {
            if (phase !== 'cleared') setPhase('cleared');
        }
    }, [progress, phase, config]);

    // Derived states
    const showHeadline = phase !== 'hidden' && phase !== 'cleared';
    const reverseHeadline = phase === 'erase' || phase === 'cleared';

    const showSub = phase === 'subheadline' || phase === 'hold' || phase === 'erase';
    const reverseSub = phase === 'erase' || phase === 'cleared';

    return (
        <section
            ref={sectionRef}
            className="min-h-screen h-full w-full flex items-center justify-center py-24 px-[var(--spacing-container)] text-white"
            style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#111311' }}
        >
            <OrbitalBackground />

            <motion.div
                className="max-w-6xl mx-auto text-center"
                style={{
                    position: 'relative',
                    zIndex: PROBLEM_CONFIG.Z_INDEX.SECTION,
                }}
            >
                {/* Header Label - Subtle and fixed */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: (phase !== 'hidden' && phase !== 'cleared') ? 1 : 0 }}
                    transition={{ duration: 1 }}
                    className="mb-8"
                >
                    <span className="text-[12px] font-outfit tracking-[0.6em] uppercase text-white/40 font-medium">
                        THE PROBLEM
                    </span>
                </motion.div>

                {/* HEADLINE - TWO LINES */}
                <h2
                    className="mb-10 font-outfit font-black tracking-tight leading-[1.05] text-white flex flex-col items-center justify-center min-h-[2.5em]"
                    style={{ fontSize: `clamp(${PROBLEM_CONFIG.TEXT.HEADLINE_SIZE_MOBILE}, 8vw, ${PROBLEM_CONFIG.TEXT.HEADLINE_SIZE_DESKTOP})` }}
                >
                    <span className="block mb-2">
                        <Typewriter
                            text={config.headline1}
                            show={showHeadline}
                            reverse={reverseHeadline}
                        />
                    </span>
                    <span className="block">
                        <Typewriter
                            text={config.headline2}
                            show={showHeadline}
                            reverse={reverseHeadline}
                            delay={0.6}
                        />
                    </span>
                </h2>

                {/* SUBHEADLINE */}
                <div className="min-h-[2.5em] flex items-start justify-center px-4">
                    <h4
                        className="font-outfit font-bold tracking-tight text-[#a3d8ff] drop-shadow-[0_0_15px_rgba(163,216,255,0.4)] max-w-2xl"
                        style={{ fontSize: PROBLEM_CONFIG.TEXT.SUBHEADLINE_SIZE }}
                    >
                        <Typewriter
                            text={config.subheadline}
                            show={showSub}
                            reverse={reverseSub}
                            delay={1.4}
                        />
                    </h4>
                </div>
            </motion.div>
        </section>
    );
}
