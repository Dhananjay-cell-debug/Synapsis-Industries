"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";

function FloatingLines({ position }: { position: number }) {
    const paths = Array.from({ length: 28 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.4 + i * 0.025,
        strokeOpacity: 0.06 + i * 0.012,
    }));

    return (
        <div className="absolute inset-0 pointer-events-none z-0">
            <svg className="w-full h-full" viewBox="0 0 696 316" fill="none">
                {paths.map((path) => (
                    <motion.path
                        key={path.id}
                        d={path.d}
                        stroke="#11B8EA"
                        strokeWidth={path.width}
                        strokeOpacity={path.strokeOpacity}
                        initial={{ pathLength: 0.3, opacity: 0.3 }}
                        animate={{ pathLength: 1, opacity: [0.15, 0.35, 0.15], pathOffset: [0, 1, 0] }}
                        transition={{ duration: 22 + Math.random() * 12, repeat: Infinity, ease: "linear" }}
                    />
                ))}
            </svg>
        </div>
    );
}

export default function SignInPage() {
    return (
        <div className="h-screen w-full flex flex-col bg-[#0A0F1E] relative overflow-hidden font-outfit text-white">

            {/* Ambient glow blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
                <FloatingLines position={1} />
                <FloatingLines position={-1} />
                <div className="absolute -bottom-[20vh] -left-[10vw] w-[55vw] h-[55vh] rounded-full bg-[#11B8EA]/10 blur-[120px] animate-[blob_20s_infinite_alternate]" />
                <div className="absolute top-[-10vh] right-[5vw] w-[40vw] h-[40vh] rounded-full bg-[#3B6AE8]/12 blur-[100px] animate-[blob_28s_infinite_alternate-reverse]" />
                {/* Grain overlay */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: "128px 128px" }} />
                <style>{`
                    @keyframes blob {
                        0% { transform: translate(0,0) scale(1); }
                        33% { transform: translate(40px,-60px) scale(1.1); }
                        66% { transform: translate(-30px,30px) scale(0.9); }
                        100% { transform: translate(0,0) scale(1); }
                    }
                `}</style>
            </div>

            {/* Header */}
            <header className="w-full flex items-center justify-between px-8 lg:px-12 py-6 relative z-20 shrink-0 border-b border-white/5">
                <Link href="/" className="text-xl font-serif tracking-tight font-bold text-white">
                    SYNAPSIS INDUSTRIES
                </Link>
                <Link href="/" className="px-5 py-2.5 text-xs font-semibold tracking-[0.16em] uppercase border border-white/15 text-white/50 hover:text-white hover:border-white/40 transition-all duration-300">
                    ← Back to Home
                </Link>
            </header>

            {/* Main split layout */}
            <main className="flex-1 flex w-full relative z-10">

                {/* Left — copy + auth form */}
                <div className="flex flex-col justify-center px-8 lg:pl-[10%] xl:pl-[14%] lg:pr-12 pb-12 lg:pb-0 h-full w-[50%]">
                    <div className="w-full flex flex-col items-start">

                        {/* Eyebrow */}
                        <p className="text-[10px] tracking-[0.4em] uppercase text-[#11B8EA]/70 mb-5 font-semibold">
                            Welcome Back
                        </p>

                        {/* Headline */}
                        <h1 className="font-serif text-white mb-4" style={{ fontSize: "4.2rem", lineHeight: 0.92 }}>
                            Systems<br />
                            <em>that scale.</em>
                        </h1>
                        <p className="text-white/40 mb-10 text-base">
                            Automation that works while you sleep.
                        </p>

                        {/* Auth card */}
                        <div className="w-full max-w-[420px] rounded-2xl p-8 border border-white/8 bg-white/[0.03] backdrop-blur-sm" style={{ boxShadow: "0 24px 60px -12px rgba(17,184,234,0.12)" }}>

                            {/* Google button */}
                            <button
                                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                                className="w-full flex items-center justify-center gap-3 bg-white text-[#0A0F1E] px-6 py-3.5 rounded-xl text-[14px] font-semibold hover:bg-white/90 active:scale-[0.98] transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                                    <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
                                    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
                                    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.312 0-9.823-3.534-11.408-8.418l-6.534 5.034C9.392 39.078 16.092 44 24 44z" fill="#4CAF50" />
                                    <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l6.19 5.238C39.712 35.942 44 30.417 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
                                </svg>
                                Continue with Google
                            </button>

                            <div className="flex items-center gap-4 my-5">
                                <div className="h-px bg-white/10 flex-1" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">or</span>
                                <div className="h-px bg-white/10 flex-1" />
                            </div>

                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="w-full bg-white/5 border border-white/10 px-5 py-3.5 rounded-xl text-[14px] text-white outline-none focus:border-[#11B8EA]/50 transition-colors mb-4 placeholder:text-white/25"
                            />

                            <button className="w-full px-6 py-3.5 rounded-xl text-[14px] font-semibold text-[#0A0F1E] hover:opacity-90 active:scale-[0.98] transition-all" style={{ background: "#11B8EA" }}>
                                Continue with email
                            </button>

                            <p className="text-[11px] text-center text-white/25 mt-5 leading-relaxed">
                                By continuing, you agree to our{" "}
                                <a href="#" className="text-white/40 underline hover:text-white/60 transition-colors">Privacy Policy</a>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right — brand visual panel */}
                <div className="h-full flex items-center justify-center w-[50%] p-8 relative">
                    <div className="w-full h-full max-h-[80vh] rounded-2xl border border-white/8 bg-white/[0.02] relative overflow-hidden flex flex-col items-center justify-center" style={{ boxShadow: "inset 0 0 80px rgba(17,184,234,0.04)" }}>

                        {/* Central glowing orb */}
                        <div className="relative flex items-center justify-center mb-8">
                            <div className="absolute w-48 h-48 rounded-full bg-[#11B8EA]/8 blur-3xl" />
                            <div className="absolute w-28 h-28 rounded-full bg-[#3B6AE8]/15 blur-2xl" />
                            {/* Outer orbit ring */}
                            <svg width="200" height="200" className="absolute animate-[spin_18s_linear_infinite]">
                                <circle cx="100" cy="100" r="90" fill="none" stroke="#11B8EA" strokeWidth="0.6" strokeOpacity="0.25" strokeDasharray="4 8" />
                            </svg>
                            {/* Inner orbit ring */}
                            <svg width="140" height="140" className="absolute animate-[spin_10s_linear_infinite_reverse]">
                                <circle cx="70" cy="70" r="62" fill="none" stroke="#3B6AE8" strokeWidth="0.6" strokeOpacity="0.3" strokeDasharray="2 6" />
                            </svg>
                            {/* Core sphere */}
                            <div className="w-16 h-16 rounded-full flex items-center justify-center relative z-10" style={{ background: "radial-gradient(circle at 35% 35%, #3B6AE8, #0a1628)", boxShadow: "0 0 30px rgba(17,184,234,0.35), inset 0 0 20px rgba(17,184,234,0.15)" }}>
                                <span className="font-serif text-white text-lg font-bold">SI</span>
                            </div>
                        </div>

                        {/* Brand text */}
                        <p className="text-[10px] tracking-[0.5em] uppercase text-white/25 mb-3">Synapsis Industries</p>
                        <p className="font-serif text-white/60 text-2xl text-center leading-tight">
                            Systems that scale.<br />
                            <em className="text-white/30 text-xl">Automation that works.</em>
                        </p>

                        {/* Bottom accent line */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#11B8EA]/30 to-transparent" />
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3B6AE8]/20 to-transparent" />
                    </div>
                </div>
            </main>
        </div>
    );
}
