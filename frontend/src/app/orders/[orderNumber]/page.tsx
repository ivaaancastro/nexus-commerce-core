"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { Order } from "@/types/commerce";
import { useParams } from "next/navigation";

/**
 * Página de confirmación de pedido.
 * Muestra el resumen del pedido y acceso al recibo.
 */
export default function OrderConfirmationPage() {
    const params = useParams();
    const orderNumber = params?.orderNumber
        ? decodeURIComponent(params.orderNumber as string)
        : "";

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadOrder() {
            try {
                setLoading(true);
                const data = await api.getOrder(orderNumber);
                setOrder(data);
            } catch (err: unknown) {
                setError(
                    err instanceof Error
                        ? getFriendlyErrorMessage(err)
                        : "Error al cargar el pedido"
                );
            } finally {
                setLoading(false);
            }
        }
        loadOrder();
    }, [orderNumber]);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center text-xs uppercase tracking-widest text-neutral-400">
                    Cargando confirmación...
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <p className="text-sm uppercase tracking-wider text-neutral-600 mb-4">
                        Pedido no encontrado
                    </p>
                    <Link
                        href="/"
                        className="text-xs uppercase tracking-widest underline"
                    >
                        Volver a la colección
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
                <div className="bg-white border border-neutral-200 p-8">
                    <div className="text-center mb-8">
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-2">
                            Pedido Confirmado
                        </span>
                        <h1 className="text-2xl font-light uppercase tracking-wide text-neutral-900 mb-2">
                            Gracias por tu compra
                        </h1>
                        <p className="text-xs text-neutral-600">
                            Número de pedido: <span className="font-mono">{order.orderNumber}</span>
                        </p>
                    </div>

                    <div className="border-t border-neutral-100 pt-6 mb-6">
                        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-4">
                            Resumen del pedido
                        </h2>
                        <div className="space-y-3">
                            {order.items.map((item) => (
                                <div key={item.id} className="flex justify-between text-xs">
                                    <span className="text-neutral-600">
                                        {item.skuCode} × {item.quantity}
                                    </span>
                                    <span className="text-neutral-900">
                                        {item.totalAmount.toFixed(2)} {order.currency}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-neutral-100 pt-6 space-y-2">
                        <div className="flex justify-between text-xs uppercase tracking-wider">
                            <span className="text-neutral-600">Subtotal</span>
                            <span className="text-neutral-900">
                                {order.subtotalAmount.toFixed(2)} {order.currency}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs uppercase tracking-wider">
                            <span className="text-neutral-600">Impuestos</span>
                            <span className="text-neutral-900">
                                {order.taxAmount.toFixed(2)} {order.currency}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm uppercase tracking-wider pt-2 border-t border-neutral-100">
                            <span className="font-medium text-neutral-900">Total</span>
                            <span className="font-medium text-neutral-900">
                                {order.totalAmount.toFixed(2)} {order.currency}
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-neutral-600 mb-4">
                            Hemos enviado la confirmación a tu correo electrónico.
                        </p>
                        <Link
                            href={`/receipt/${encodeURIComponent(order.orderNumber)}`}
                            className="inline-block bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 px-8 transition-colors"
                        >
                            Ver recibo
                        </Link>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Link
                        href="/"
                        className="text-xs uppercase tracking-wider text-neutral-600 hover:text-black underline transition-colors"
                    >
                        Volver a la colección
                    </Link>
                </div>
            </main>
        </div>
    );
}
