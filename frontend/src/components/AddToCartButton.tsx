"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { CartItem } from "@/types/commerce";

interface AddToCartButtonProps {
    productId: number;
    referenceCode: string;
    name: string;
    family: string;
    skuId: number;
    size: string;
    color: string;
    unitPrice: number;
    currency: string;
    imageUrl?: string;
    disabled?: boolean;
}

/**
 * Botón "Añadir a la bolsa" con confirmación visual temporal.
 * Reemplaza al botón "Comprar Ahora" (modelo Zara).
 */
export default function AddToCartButton({
    productId,
    referenceCode,
    name,
    family,
    skuId,
    size,
    color,
    unitPrice,
    currency,
    imageUrl,
    disabled = false,
}: AddToCartButtonProps) {
    const { addItem } = useCart();
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleAdd = () => {
        const item: CartItem = {
            productId,
            referenceCode,
            name,
            family,
            skuId,
            size,
            color,
            quantity: 1,
            unitPrice,
            currency,
            imageUrl,
        };
        addItem(item);
        setShowConfirmation(true);
        setTimeout(() => setShowConfirmation(false), 2500);
    };

    return (
        <div className="relative">
            <button
                onClick={handleAdd}
                disabled={disabled}
                className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-4 transition-all disabled:opacity-40 disabled:hover:bg-neutral-900"
            >
                Añadir a la bolsa
            </button>

            {showConfirmation && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-neutral-900 text-white text-xs uppercase tracking-widest py-3 px-4 text-center animate-fade-in">
                    Añadido a la bolsa — {name} (Talla {size})
                </div>
            )}
        </div>
    );
}
