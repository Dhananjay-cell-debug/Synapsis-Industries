import { create } from "zustand";
import { PROBLEM_CONFIG } from "@/config/problem-animation";

interface ProblemState {
    // Phases
    headlineIn: number;
    subheadlineIn: number;
    holdStart: number;
    eraseStart: number;
    clearedStart: number;

    // Scroll
    startVh: number;
    durationVh: number;
    timelineOffsetVh: number;

    // Text
    headline1: string;
    headline2: string;
    subheadline: string;

    // Actions
    setConfig: (updates: Partial<Omit<ProblemState, 'setConfig'>>) => void;
}

export const useProblemStore = create<ProblemState>((set) => ({
    // Initialize from static config
    headlineIn: PROBLEM_CONFIG.PHASES.HEADLINE_IN,
    subheadlineIn: PROBLEM_CONFIG.PHASES.SUBHEADLINE_IN,
    holdStart: PROBLEM_CONFIG.PHASES.HOLD_START,
    eraseStart: PROBLEM_CONFIG.PHASES.ERASE_START,
    clearedStart: PROBLEM_CONFIG.PHASES.CLEARED_START,

    startVh: PROBLEM_CONFIG.SCROLL.START_VH,
    durationVh: PROBLEM_CONFIG.SCROLL.DURATION_VH,
    timelineOffsetVh: PROBLEM_CONFIG.SCROLL.TIMELINE_OFFSET_VH,

    headline1: PROBLEM_CONFIG.TEXT.HEADLINE_1,
    headline2: PROBLEM_CONFIG.TEXT.HEADLINE_2,
    subheadline: PROBLEM_CONFIG.TEXT.SUBHEADLINE,

    setConfig: (updates) => set((state) => ({ ...state, ...updates })),
}));
