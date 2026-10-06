"use client";

import ProductThumb from "@/components/ProductThumb";
import { useCart } from "@/context/CartContext";
import { CartItem } from "@/types/commerce";

interface CartItemRowProps {
    item: CartItem;
}

/**
 * Fila de item en el carrito con controles de cantidad.
 * Estilo editorial Zara: limpio, minimalista, funcional.
 */
export default function CartItemRow({ item }: CartItemRowProps) {
    const { updateQuantity, removeItem } = useCart();

    const handleIncrement = () => {
        updateQuantity(item.skuId, item.size, item.quantity + 1);
    };

    const handleDecrement = () => {
        if (item.quantity <= 1) {
            removeItem(item.skuId, item.size);
        } else {
            updateQuantity(item.skuId, item.size, item.quantity - 1);
        }
    };

    const handleRemove = () => {
        removeItem(item.skuId, item.size);
    };

    return (
        <div className="flex gap-4 py-4 border-b border-neutral-100">
            {/* Imagen: placeholder editorial compartido con el historial y la ficha.
                La rama <img> anterior era código muerto: `imageUrl` nunca llega
                a asignarse en ningún sitio (Tarea 5.5, R8). */}
            <ProductThumb
                name={item.name}
                family={item.family}
                size={item.size}
                className="w-20 h-24"
            />

            {/* Info */}
            <div className="flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-900">
                        {item.name}
                    </h3>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-0.5">
                        Talla {item.size} · {item.color}
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    {/* Controles de cantidad */}
                    <div className="flex items-center border border-neutral-200">
                        <button
                            onClick={handleDecrement}
                            className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 transition-colors"
                            aria-label="Disminuir cantidad"
                        >
                            −
                        </button>
                        <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                        <button
                            onClick={handleIncrement}
                            className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 transition-colors"
                            aria-label="Aumentar cantidad"
                        >
                            +
                        </button>
                    </div>

                    {/* Precio */}
                    <span className="text-xs font-medium text-neutral-900">
                        {(item.unitPrice * item.quantity).toFixed(2)} {item.currency}
                    </span>
                </div>
            </div>

            {/* Eliminar */}
            <button
                onClick={handleRemove}
                className="self-start text-neutral-400 hover:text-neutral-900 transition-colors"
                aria-label={`Eliminar ${item.name} del carrito`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
