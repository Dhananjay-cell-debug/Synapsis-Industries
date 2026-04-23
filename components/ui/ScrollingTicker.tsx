'use client';
import { useRef, useEffect, forwardRef } from 'react';
import {
    motion,
    useScroll,
    useSpring,
    useTransform,
    useVelocity,
    useAnimationFrame,
    useMotionValue,
} from 'framer-motion';
import { cn } from '@/lib/utils';

// Inline wrap — avoids @motionone/utils dependency
function wrap(min: number, max: number, v: number) {
    const rangeSize = max - min;
    return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
}

interface ScrollingTickerProps {
    children: string;
    baseVelocity?: number;
    className?: string;
    scrollDependent?: boolean;
    delay?: number;
    fontSize?: string; // e.g. "8vw", "120px", "6rem"
}

const ScrollingTicker = forwardRef<HTMLDivElement, ScrollingTickerProps>((
    { children, baseVelocity = -5, className, scrollDependent = false, delay = 0, fontSize = '8vw' }, ref
) => {
    const baseX = useMotionValue(0);
    const { scrollY } = useScroll();
    const scrollVelocity = useVelocity(scrollY);
    const smoothVelocity = useSpring(scrollVelocity, {
        damping: 50,
        stiffness: 400,
    });
    const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 2], {
        clamp: false,
    });

    const x = useTransform(baseX, (v) => `${wrap(-20, -45, v)}%`);

    const directionFactor = useRef<number>(1);
    const hasStarted = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            hasStarted.current = true;
        }, delay);
        return () => clearTimeout(timer);
    }, [delay]);

    useAnimationFrame((_, delta) => {
        if (!hasStarted.current) return;

        let moveBy = directionFactor.current * baseVelocity * (delta / 1000);

        if (scrollDependent) {
            if (velocityFactor.get() < 0) {
                directionFactor.current = -1;
            } else if (velocityFactor.get() > 0) {
                directionFactor.current = 1;
            }
        }

        moveBy += directionFactor.current * moveBy * velocityFactor.get();
        baseX.set(baseX.get() + moveBy);
    });

    return (
        <div ref={ref} className='overflow-hidden whitespace-nowrap flex flex-nowrap'>
            <motion.div
                className='flex whitespace-nowrap gap-10 flex-nowrap'
                style={{ x }}
            >
                <span className={cn('block', className)} style={{ fontSize }}>{children}</span>
                <span className={cn('block', className)} style={{ fontSize }}>{children}</span>
                <span className={cn('block', className)} style={{ fontSize }}>{children}</span>
                <span className={cn('block', className)} style={{ fontSize }}>{children}</span>
            </motion.div>
        </div>
    );
});

ScrollingTicker.displayName = 'ScrollingTicker';
export default ScrollingTicker;
