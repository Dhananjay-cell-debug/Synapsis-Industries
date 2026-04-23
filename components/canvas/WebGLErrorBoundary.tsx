"use client";

import React from "react";

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export default class WebGLErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.warn("[WebGL ErrorBoundary] Caught:", error.message);
        console.warn("[WebGL ErrorBoundary] Info:", errorInfo.componentStack);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#ECA7A7] to-[#d4898a] overflow-auto">
                    <div className="text-center p-8 w-full max-w-4xl text-left">
                        <div className="text-5xl mb-4 text-center">🌐</div>
                        <h2 className="text-2xl font-serif font-bold text-[#4a1520] mb-3 text-center">
                            3D Scene Crashed
                        </h2>
                        <div className="bg-black/80 p-6 rounded-xl text-red-300 font-mono text-xs mb-6 overflow-auto" style={{ maxHeight: '400px' }}>
                            <p className="font-bold text-red-500 text-sm mb-4">Error: {this.state.error?.message}</p>

                            {typeof window !== 'undefined' && this.state.error?.message?.includes('WebGL') && (
                                <div className="bg-red-900/50 border border-red-500 p-4 rounded mb-4 text-white">
                                    <h4 className="font-bold text-orange-400 mb-2">⚠️ DEV-ONLY BROWSER LIMIT HIT</h4>
                                    <p className="opacity-90 leading-relaxed">
                                        You are seeing this because Next.js <strong>Hot Reloading</strong> creates new WebGL contexts on every save, and your browser (Chrome/Edge) has a hard limit (usually 16) per tab.
                                    </p>
                                    <p className="mt-2 text-cyan-300 font-bold">
                                        👉 FIX: Press <kbd className="bg-gray-800 px-1 rounded">Ctrl + Shift + R</kbd> to Hard Refresh the page.
                                    </p>
                                    <p className="opacity-70 mt-2 text-[10px]">
                                        This is purely a development environment annoyance and will <strong>never</strong> happen in production.
                                    </p>
                                </div>
                            )}

                            <pre className="whitespace-pre-wrap opacity-60">{this.state.error?.stack}</pre>
                            {this.state.errorInfo && (
                                <div className="mt-4 pt-4 border-t border-red-900/50">
                                    <h3 className="font-bold text-red-400 mb-2">Component Stack:</h3>
                                    <pre className="text-orange-200 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-[#4a1520] text-white rounded-full text-sm font-medium hover:bg-[#6b2a38] transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
