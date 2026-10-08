"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary para capturar errores de renderizado en el árbol de componentes.
 * Muestra un fallback editorial elegante en lugar de una pantalla en blanco.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error("ErrorBoundary capturó un error:", error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-6">
                    <div className="max-w-md w-full bg-white border border-neutral-200 p-8 text-center">
                        <span className="text-[10px] uppercase tracking-widest text-neutral-600 block mb-2">
                            Error de Renderizado
                        </span>
                        <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900 mb-4">
                            Algo salió mal
                        </h1>
                        <p className="text-xs text-neutral-600 leading-relaxed mb-6">
                            Se ha producido un error inesperado al mostrar esta sección.
                            Nuestro equipo ha sido notificado.
                        </p>
                        <button
                            onClick={this.handleReset}
                            className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 transition-colors"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
