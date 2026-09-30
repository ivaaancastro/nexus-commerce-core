"use client";

import { useCart } from "@/context/CartContext";

/**
 * Icono de carrito con badge de items.
 * Estilo lineal, consistente con la estética editorial Zara.
 */
export default function CartIcon() {
    const { totalItems } = useCart();

    return (
        <button
            className="relative p-2 hover:bg-neutral-100 transition-colors"
            aria-label={`Carrito con ${totalItems} artículos`}
        >
            <svg
                className="w-5 h-5 stroke-neutral-900"
                fill="none"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
                />
            </svg>
            {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-neutral-900 text-white text-[10px] font-medium w-4 h-4 flex items-center justify-center rounded-full">
                    {totalItems > 99 ? "99+" : totalItems}
                </span>
            )}
        </button>
    );
}
