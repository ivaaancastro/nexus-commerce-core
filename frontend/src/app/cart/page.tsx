"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import CartItemRow from "@/components/CartItemRow";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";

/**
 * Página completa del carrito con checkout multilínea.
 * Accesible desde el drawer lateral con botón "Ver carrito completo".
 */
export default function CartPage() {
    const { items, subtotal, taxEstimate, currency, totalItems, clearCart } = useCart();
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCheckout = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            const idempotencyKey = crypto.randomUUID();

            const order = await api.checkout(
                {
                    marketCode: "ES",
                    items: items.map((item) => ({
                        skuId: item.skuId,
                        warehouseCode: "AUTO",
                        quantity: item.quantity,
                    })),
                    destinationCountryCode: "ES",
                    destinationLatitude: 40.4168,
                    destinationLongitude: -3.7038,
                },
                idempotencyKey
            );

            clearCart();
            router.push(`/orders/${encodeURIComponent(order.orderNumber)}`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error al procesar el checkout");
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
                <div className="mb-8">
                    <h1 className="text-lg font-medium uppercase tracking-wider text-neutral-900">
                        Tu Bolsa ({totalItems} {totalItems === 1 ? "artículo" : "artículos"})
                    </h1>
                </div>

                {items.length === 0 ? (
                    <div className="bg-white border border-neutral-200 p-12 text-center">
                        <p className="text-sm uppercase tracking-wider text-neutral-500 mb-6">
                            Tu bolsa está vacía
                        </p>
                        <Link
                            href="/"
                            className="inline-block bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 px-8 transition-colors"
                        >
                            Volver a la colección
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Lista de items */}
                        <div className="lg:col-span-2">
                            <div className="bg-white border border-neutral-200 p-6">
                                {items.map((item) => (
                                    <CartItemRow
                                        key={`${item.skuId}-${item.size}`}
                                        item={item}
                                    />
                                ))}

                                <div className="mt-6 pt-4 border-t border-neutral-100">
                                    <button
                                        onClick={clearCart}
                                        className="text-xs uppercase tracking-wider text-neutral-500 hover:text-black underline transition-colors"
                                    >
                                        Vaciar bolsa
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Resumen */}
                        <div className="lg:col-span-1">
                            <div className="bg-white border border-neutral-200 p-6 sticky top-24">
                                <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-900 mb-4">
                                    Resumen
                                </h2>

                                <div className="space-y-3 text-xs uppercase tracking-wider">
                                    <div className="flex justify-between">
                                        <span className="text-neutral-600">Subtotal</span>
                                        <span className="font-medium text-neutral-900">
                                            {subtotal.toFixed(2)} {currency}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-600">Impuestos estimados</span>
                                        <span className="text-neutral-900">
                                            {taxEstimate.toFixed(2)} {currency}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-3 border-t border-neutral-100">
                                        <span className="font-medium text-neutral-900">Total estimado</span>
                                        <span className="font-medium text-neutral-900">
                                            {(subtotal + taxEstimate).toFixed(2)} {currency}
                                        </span>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                                        {error}
                                    </div>
                                )}

                                <button
                                    onClick={handleCheckout}
                                    disabled={isProcessing}
                                    className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-4 transition-colors disabled:opacity-40 disabled:hover:bg-neutral-900 mt-6"
                                >
                                    {isProcessing ? "Procesando..." : "Tramitar pedido"}
                                </button>

                                <p className="text-[10px] text-neutral-400 mt-4 leading-relaxed">
                                    Impuestos calculados al 21% IVA (mercado ES). El cálculo final se realizará en el checkout.
                                </p>

                                <Link
                                    href="/"
                                    className="block text-center mt-6 text-xs uppercase tracking-wider text-neutral-600 hover:text-black underline transition-colors"
                                >
                                    Seguir comprando
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
