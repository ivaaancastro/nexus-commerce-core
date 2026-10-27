"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { getFriendlyErrorMessage } from "@/lib/errors";
import Toast from "@/components/Toast";

interface WishlistButtonProps {
    productId: number;
    /** Nombre accesible: «Guardar {productName} en favoritos». */
    productName: string;
    /**
     * `square`: botón con borde para la ficha, junto a «Añadir a la bolsa».
     * `overlay`: corazón superpuesto arriba-derecha de la imagen de la tarjeta
     * (hermano del enlace, nunca dentro — plan D7).
     */
    variant?: "square" | "overlay";
}

const CONTENEDOR: Record<NonNullable<WishlistButtonProps["variant"]>, string> = {
    square:
        "shrink-0 w-14 border border-neutral-900 text-neutral-900 " +
        "hover:bg-neutral-900 hover:text-white",
    overlay:
        "absolute top-3 right-3 z-10 p-2 border border-neutral-200 " +
        "bg-white/90 text-neutral-900 hover:bg-white hover:border-neutral-900",
};

/**
 * Corazón de favoritos (spec V3 wishlist, plan D7) — un solo componente para la
 * ficha (PDP) y la tarjeta del catálogo/búsqueda.
 *
 * <p>**`aria-pressed` siempre correcto** y nombre accesible en español; icono
 * lineal `stroke-width` 1.5 de la casa, relleno cuando el producto está
 * guardado. **Sin sesión el pulso lleva a `/login`** (mismo trato que el
 * checkout, R5.3) sin emitir ninguna petición.</p>
 *
 * <p>El fallo de red **no mueve el estado** (la mutación es del contexto y no
 * es optimista) y se pinta un toast con `getFriendlyErrorMessage()` (R5.4);
 * el botón queda operativo para reintentar.</p>
 */
export default function WishlistButton({
    productId,
    productName,
    variant = "square",
}: WishlistButtonProps) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { isSaved, toggle } = useWishlist();
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const saved = isSaved(productId);

    async function handleToggle() {
        if (!isAuthenticated) {
            // Sin sesión no hay favoritos: la página de login ya redirige al
            // volver (ProtectedRoute). Ningún POST se emite (R5.3).
            router.push("/login");
            return;
        }
        if (busy) return;
        setBusy(true);
        try {
            await toggle(productId);
        } catch (error) {
            setToast(getFriendlyErrorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={handleToggle}
                disabled={busy}
                aria-pressed={saved}
                aria-label={
                    saved
                        ? `Quitar ${productName} de favoritos`
                        : `Guardar ${productName} en favoritos`
                }
                className={`${CONTENEDOR[variant]} transition-all duration-300 flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:opacity-50`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={saved ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                    aria-hidden="true"
                >
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
            </button>
            <Toast
                message={toast ?? ""}
                isVisible={toast !== null}
                onClose={() => setToast(null)}
            />
        </>
    );
}
