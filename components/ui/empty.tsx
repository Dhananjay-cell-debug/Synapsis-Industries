'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

// ── Empty ── compound component for hero/empty states ──

export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-6 text-center', className)}>
            {children}
        </div>
    );
}

export function EmptyHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center gap-2', className)}>
            {children}
        </div>
    );
}

export function EmptyTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <h1
            className={cn('font-extrabold text-9xl select-none', className)}
            style={{
                // Wall pink — matches the 3D scene background
                color: '#d4777e',
                WebkitMaskImage: 'linear-gradient(to bottom, #d4777e 20%, transparent 80%)',
                maskImage: 'linear-gradient(to bottom, #d4777e 20%, transparent 80%)',
            }}
        >
            {children}
        </h1>
    );
}

export function EmptyDescription({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={cn('text-base text-black/60 leading-relaxed', className)}>
            {children}
        </p>
    );
}

export function EmptyContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center gap-4', className)}>
            {children}
        </div>
    );
}
