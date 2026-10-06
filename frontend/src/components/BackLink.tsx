"use client";

import { useRouter } from "next/navigation";

interface BackLinkProps {
    /**
     * Destino cuando <strong>no</strong> hay historial previo — URL escrita a
     * mano o recarga de la página.
     */
    href: string;
    /** Texto visible. */
    label?: string;
}

/**
 * «Volver» a la pantalla anterior (Tarea 5.5, R5).
 *
 * <p>Usa `router.back()` cuando hay historial; si no, `router.push(href)`.
 * Sin ese fallback el botón se quedaría mudo al entrar directamente en la URL,
 * que es justo lo que ocurre al recargar o al compartir un enlace.</p>
 */
export default function BackLink({ href, label = "Volver" }: BackLinkProps) {
    const router = useRouter();

    const handleBack = () => {
        // history.length incluye la entrada actual: 1 significa que no hay hacia dónde volver.
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
        } else {
            router.push(href);
        }
    };

    return (
        <button
            type="button"
            onClick={handleBack}
            data-testid="back-link"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-600 hover:text-neutral-900 transition-colors"
        >
            <span aria-hidden="true">&larr;</span>
            {label}
        </button>
    );
}
