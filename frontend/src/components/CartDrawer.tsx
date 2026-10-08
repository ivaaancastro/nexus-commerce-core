"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useCartDrawer } from "@/context/CartDrawerContext";
import CartItemRow from "./CartItemRow";

/**
 * Drawer lateral del carrito con animación suave.
 * Estilo Zara: overlay oscuro + panel blanco deslizante.
 */
export default function CartDrawer() {
    const { items, subtotal, taxEstimate, currency, totalItems } = useCart();
    const { isOpen, closeDrawer } = useCartDrawer();
    const router = useRouter();

    // Cerrar con tecla Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeDrawer();
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "";
        };
    }, [isOpen, closeDrawer]);

    const handleViewCart = () => {
        closeDrawer();
        router.push("/cart");
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`
                    fixed inset-0 bg-black/40 z-40 transition-opacity duration-300
                    ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
                `}
                onClick={closeDrawer}
                aria-hidden="true"
            />

            {/* Panel lateral */}
            <div
                className={`
                    fixed top-0 right-0 h-full w-full sm:w-96 bg-white z-50 shadow-2xl
                    transform transition-transform duration-300 ease-out
                    flex flex-col
                    ${isOpen ? "translate-x-0" : "translate-x-full"}
                `}
                role="dialog"
                aria-modal="true"
                aria-label="Carrito de compra"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                    <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-900">
                        Tu Bolsa ({totalItems})
                    </h2>
                    <button
                        onClick={closeDrawer}
                        className="p-1 text-neutral-600 hover:text-black transition-colors"
                        aria-label="Cerrar carrito"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto px-6">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <p className="text-xs uppercase tracking-widest text-neutral-600">
                                Tu bolsa está vacía
                            </p>
                        </div>
                    ) : (
                        <div>
                            {items.map((item) => (
                                <CartItemRow
                                    key={`${item.skuId}-${item.size}`}
                                    item={item}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="border-t border-neutral-200 px-6 py-4 space-y-3">
                        <div className="flex justify-between text-xs uppercase tracking-wider">
                            <span className="text-neutral-600">Subtotal</span>
                            <span className="font-medium text-neutral-900">
                                {subtotal.toFixed(2)} {currency}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs uppercase tracking-wider">
                            <span className="text-neutral-600">Impuestos estimados</span>
                            <span className="text-neutral-900">
                                {taxEstimate.toFixed(2)} {currency}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm uppercase tracking-wider pt-2 border-t border-neutral-100">
                            <span className="font-medium text-neutral-900">Total estimado</span>
                            <span className="font-medium text-neutral-900">
                                {(subtotal + taxEstimate).toFixed(2)} {currency}
                            </span>
                        </div>

                        <button
                            onClick={handleViewCart}
                            className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-4 transition-colors mt-4"
                        >
                            Ver carrito completo
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
