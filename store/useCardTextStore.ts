import { create } from "zustand";

interface CardTextState {
    titleSize: number;
    descSize: number;
    titleScale: number; // For Text3D direct size scaling
    descScale: number;  // For Text3D direct size scaling
    iconSize: number;
    padding: number;
    cardScale: number;
    cardY: number;
    descLineSpacing: number; // For manual 2nd line offset control
    emblemScale: number; // Scale for the 3D logo emblems
    emblemY: number;     // Y offset for the emblem relative to card top

    // NEW Positional Controls
    titleX: number; titleY: number; titleZ: number;
    descX: number; descY: number; descZ: number;
    iconX: number; iconY: number; iconZ: number;

    cardThickness: number;

    setCardTextConfig: (updates: Partial<CardTextState>) => void;
}

export const useCardTextStore = create<CardTextState>((set) => ({
    titleSize: 23,
    descSize: 13,
    titleScale: 1.29,     // user value: 1.29
    descScale: 1.86,      // user value: 1.86
    iconSize: 28,
    padding: 18,
    cardScale: 0.9,
    cardY: 0,
    descLineSpacing: 1.2,
    emblemScale: 0.86,    // user value: 0.86
    emblemY: 0.35,

    // NEW Positional Controls
    titleX: 0, titleY: -0.12, titleZ: -0.01,   // user values
    descX: 0, descY: -0.07, descZ: -0.01,    // user values
    iconX: 0, iconY: -0.1, iconZ: -0.01,     // user values

    // NEW state for card thickness (depth)
    cardThickness: 0.12, // user value: 0.12

    setCardTextConfig: (updates) => set((state) => ({ ...state, ...updates })),
}));
