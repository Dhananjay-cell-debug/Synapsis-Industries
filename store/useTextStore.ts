import { create } from "zustand";

interface TextState {
    x: number;
    y: number;
    z: number;
    scale: number;
    distanceFactor: number;
    setTextConfig: (x: number, y: number, z: number, scale: number, distanceFactor: number) => void;
}

export const useTextStore = create<TextState>((set) => ({
    x: 0.00,
    y: -0.50,
    z: 1.00,
    scale: 0.33,
    distanceFactor: 9.00,
    setTextConfig: (x, y, z, scale, distanceFactor) => set({ x, y, z, scale, distanceFactor }),
}));
