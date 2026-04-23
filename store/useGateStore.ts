import { create } from 'zustand';

interface GateState {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    setGateConfig: (x: number, y: number, scaleX: number, scaleY: number) => void;
}

export const useGateStore = create<GateState>((set) => ({
    x: 0.00,
    y: -2.60,
    scaleX: 0.65,
    scaleY: 0.80,
    setGateConfig: (x, y, scaleX, scaleY) => set({ x, y, scaleX, scaleY }),
}));
