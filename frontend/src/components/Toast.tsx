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
    const [prevVisible, setPrevVisible] = useState(isVisible);

    // Ajuste de estado durante el render (react.dev, «Adjusting state when a
    // prop changes»): al ocultarse, la animación de salida se deriva aquí mismo,
    // en el render en que cambia la prop. Escribirla en el cuerpo del efecto es
    // lo que prohíbe react-hooks/set-state-in-effect (renders en cascada).
    if (isVisible !== prevVisible) {
        setPrevVisible(isVisible);
        if (!isVisible) {
            setIsAnimating(false);
        }
    }

    useEffect(() => {
        if (!isVisible) return;
        // Entrada y cierre: sólo dentro de un temporizador. El cuerpo del efecto
        // no escribe estado, y la entrada sigue llegando tras el primer pintado,
        // así que la transición de 300 ms se conserva igual que siempre.
        const show = setTimeout(() => setIsAnimating(true), 0);
        const hide = setTimeout(() => {
            setIsAnimating(false);
            setTimeout(onClose, 300);
        }, duration);
        return () => {
            clearTimeout(show);
            clearTimeout(hide);
        };
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
