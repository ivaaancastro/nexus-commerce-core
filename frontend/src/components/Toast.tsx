"use client";

import { useEffect, useState } from "react";

interface ToastProps {
    message: string;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

/**
 * Notificación temporal (toast) con estilo editorial Zara.
 * Desaparece automáticamente sin interacción del usuario.
 */
export default function Toast({ message, isVisible, onClose, duration = 2500 }: ToastProps) {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setIsAnimating(true);
            const timer = setTimeout(() => {
                setIsAnimating(false);
                setTimeout(onClose, 300);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onClose]);

    if (!isVisible && !isAnimating) return null;

    return (
        <div
            className={`
                fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                bg-neutral-900 text-white text-xs uppercase tracking-widest
                py-3 px-6 shadow-lg
                transition-all duration-300
                ${isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
            `}
            role="status"
            aria-live="polite"
        >
            {message}
        </div>
    );
}
