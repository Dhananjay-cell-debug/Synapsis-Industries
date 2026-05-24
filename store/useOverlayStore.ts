import { create } from "zustand";

interface OverlayState {
    top: number;   // percentage 0-100
    left: number;  // percentage 0-100
    setTop: (v: number) => void;
    setLeft: (v: number) => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
    top: 42.0,
    left: 82.0,
    setTop: (v) => set({ top: v }),
    setLeft: (v) => set({ left: v }),
}));
