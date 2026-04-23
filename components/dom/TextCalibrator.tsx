import { useTextStore } from "@/store/useTextStore";

export default function TextCalibrator() {
    const { x, y, z, scale, distanceFactor, setTextConfig } = useTextStore();

    return (
        <div className="fixed top-4 right-4 z-[9999] bg-black/80 backdrop-blur-md text-white p-4 rounded-lg font-mono text-xs w-72 pointer-events-auto border border-white/20 shadow-2xl">
            <h3 className="text-[#FF4500] font-bold mb-3 uppercase tracking-wider text-sm border-b border-white/10 pb-2">
                <span className="opacity-50 mr-2">█</span> Text Overlay Calibrator
            </h3>

            <div className="flex flex-col gap-3">
                {/* X Position */}
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center opacity-70">
                        <span>Position X</span>
                        <span className="font-bold text-white">{x.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="-10" max="10" step="0.05"
                        value={x}
                        onChange={(e) => setTextConfig(parseFloat(e.target.value), y, z, scale, distanceFactor)}
                        className="w-full accent-[#FF4500]"
                    />
                </div>

                {/* Y Position */}
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center opacity-70">
                        <span>Position Y</span>
                        <span className="font-bold text-white">{y.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="-10" max="10" step="0.05"
                        value={y}
                        onChange={(e) => setTextConfig(x, parseFloat(e.target.value), z, scale, distanceFactor)}
                        className="w-full accent-[#FF4500]"
                    />
                </div>

                {/* Z Position */}
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center opacity-70">
                        <span>Position Z</span>
                        <span className="font-bold text-white">{z.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="-15" max="15" step="0.05"
                        value={z}
                        onChange={(e) => setTextConfig(x, y, parseFloat(e.target.value), scale, distanceFactor)}
                        className="w-full accent-[#FF4500]"
                    />
                </div>

                <div className="h-px w-full bg-white/10 my-1" />

                {/* Scale */}
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center opacity-70">
                        <span>Physical Scale</span>
                        <span className="font-bold text-white">{scale.toFixed(4)}</span>
                    </div>
                    <input
                        type="range"
                        min="0.01" max="5.0" step="0.01"
                        value={scale}
                        onChange={(e) => setTextConfig(x, y, z, parseFloat(e.target.value), distanceFactor)}
                        className="w-full accent-[#FF4500]"
                    />
                </div>

                {/* Distance Factor */}
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center opacity-70">
                        <span>Distance Factor <span className="text-[9px] opacity-50">(or 0 to disable)</span></span>
                        <span className="font-bold text-white">{distanceFactor.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="25" step="0.5"
                        value={distanceFactor}
                        onChange={(e) => setTextConfig(x, y, z, scale, parseFloat(e.target.value))}
                        className="w-full accent-[#FF4500]"
                    />
                </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/10 text-[10px] opacity-50 text-center uppercase tracking-widest">
                Real-time DOM Engine sync
            </div>
        </div>
    );
}
