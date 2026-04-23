'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps {
    variant?: 'default' | 'outline';
    /** When true, renders children directly (pass a single <a> as child) */
    asChild?: boolean;
    children?: React.ReactNode;
    className?: string;
}

export function Button({ variant = 'default', asChild, children, className }: ButtonProps) {
    const base =
        'inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer select-none no-underline';
    const variants = {
        default: 'bg-black text-white hover:bg-neutral-800 active:scale-95',
        outline: 'border border-black/20 text-black hover:bg-black/5 active:scale-95',
    };
    const cls = cn(base, variants[variant], className);

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
            className: cn(cls, (children as React.ReactElement<{ className?: string }>).props.className),
        });
    }

    return <span className={cls}>{children}</span>;
}

