"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BackLink from "@/components/BackLink";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { Order } from "@/types/commerce";
import { useParams } from "next/navigation";

const printStyles = `
@media print {
    header, nav, footer, .no-print { display: none !important; }
    body { background: white !important; }
    main { max-width: 100% !important; padding: 0 !important; }
    .bg-white { border: none !important; box-shadow: none !important; }
    a { text-decoration: none !important; color: black !important; }
    button { display: none !important; }
}
`;

/**
 * Página de recibo del pedido.
 * Muestra el detalle completo del pedido con desglose fiscal.
 */
export default function ReceiptPage() {
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
                        : "Error al cargar el recibo"
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
                <div className="flex-1 flex items-center justify-center text-xs uppercase tracking-widest text-neutral-600">
                    Cargando recibo...
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
                        Recibo no encontrado
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
            <style>{printStyles}</style>
            <Header />

            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
                {/* R5: siempre hay una vía de vuelta; el recibo se consulta desde
                    la ficha o el historial, así que el fallback es `/orders`. */}
                <div className="mb-6">
                    <BackLink href="/orders" label="Mis pedidos" />
                </div>

                <div className="bg-white border border-neutral-200 p-8">
                    <div className="text-center mb-8">
                        <span className="text-[10px] uppercase tracking-widest text-neutral-600 block mb-2">
                            Recibo de Compra
                        </span>
                        <h1 className="text-2xl font-light uppercase tracking-wide text-neutral-900 mb-2">
                            Pedido {order.orderNumber}
                        </h1>
                        <p className="text-xs text-neutral-600">
                            Estado: <span className="font-medium uppercase">{order.status}</span>
                        </p>
                        <p className="text-xs text-neutral-600 mt-1">
                            Fecha: {new Date(order.createdAt).toLocaleDateString("es-ES")}
                        </p>
                    </div>

                    <div className="border-t border-neutral-100 pt-6 mb-6">
                        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-4">
                            Artículos
                        </h2>
                        <div className="space-y-3">
                            {order.items.map((item) => (
                                <div key={item.id} className="flex justify-between text-xs">
                                    <div>
                                        <p className="text-neutral-900">{item.skuCode}</p>
                                        <p className="text-neutral-500">
                                            {item.warehouseCode} × {item.quantity}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-neutral-900">
                                            {item.totalAmount.toFixed(2)} {order.currency}
                                        </p>
                                        <p className="text-neutral-500">
                                            Impuestos {item.taxRate}%: {item.taxAmount.toFixed(2)} {order.currency}
                                        </p>
                                    </div>
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

                    <div className="mt-8 text-center space-y-4">
                        <button
                            onClick={() => window.print()}
                            className="inline-block bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 px-8 transition-colors"
                        >
                            Descargar PDF
                        </button>
                        <div>
                            <Link
                                href="/"
                                className="text-xs uppercase tracking-wider text-neutral-600 hover:text-black underline transition-colors"
                            >
                                Volver a la colección
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
