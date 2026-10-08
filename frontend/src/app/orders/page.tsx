"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BackLink from "@/components/BackLink";
import Header from "@/components/Header";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import ProductThumb from "@/components/ProductThumb";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { OrderPage, OrderSummary } from "@/types/commerce";

const PAGE_SIZE = 20;

function OrderCard({ order }: { order: OrderSummary }) {
    const purchaseDate = new Date(order.createdAt).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });

    return (
        <article className="bg-white border border-neutral-200 p-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1">
                        Pedido
                    </p>
                    <p className="text-sm font-medium tracking-wide text-neutral-900">
                        {order.orderNumber}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    {/* R10: el badge también en la tarjeta, no solo en la ficha */}
                    {order.returnRequested && (
                        <span
                            data-testid={`return-badge-${order.orderNumber}`}
                            className="border border-neutral-900 px-3 py-1 text-[10px] uppercase tracking-widest text-neutral-900"
                        >
                            Devolución solicitada
                        </span>
                    )}
                </div>
            </div>

            {/* R9: nombre, variante y miniatura de cada producto en vez de un
                contador de artículos sin más. */}
            <ul className="space-y-3 border-y border-neutral-100 py-4">
                {order.items.map((item, index) => (
                    <li key={`${order.id}-${index}`} className="flex gap-3">
                        <ProductThumb
                            name={item.productName}
                            family={item.productFamily}
                            size={item.size}
                            className="w-12 h-14 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-900 truncate">
                                {item.productName}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                                {item.productFamily}
                                {item.size && <> · Talla {item.size}</>}
                                {item.color && <> · {item.color}</>}
                            </p>
                            <p className="text-[10px] text-neutral-600">
                                {item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}
                            </p>
                        </div>
                        <p className="text-[11px] text-neutral-900 whitespace-nowrap">
                            {item.totalAmount.toFixed(2)} {order.currency}
                        </p>
                    </li>
                ))}
            </ul>

            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-neutral-600">
                <div>
                    <span className="block text-[10px] uppercase tracking-widest text-neutral-600">
                        Fecha
                    </span>
                    <span className="text-neutral-900">{purchaseDate}</span>
                </div>
                <div>
                    <span className="block text-[10px] uppercase tracking-widest text-neutral-600">
                        Artículos
                    </span>
                    <span className="text-neutral-900">{order.itemCount}</span>
                </div>
                <div>
                    <span className="block text-[10px] uppercase tracking-widest text-neutral-600">
                        Total
                    </span>
                    <span className="text-neutral-900">
                        {order.totalAmount.toFixed(2)} {order.currency}
                    </span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 self-start">
                {/* El detalle es donde vive la sección de devoluciones (Tarea 5.4, R7),
                    así que es la acción principal; el recibo queda como secundaria. */}
                <Link
                    href={`/orders/${encodeURIComponent(order.orderNumber)}`}
                    className="text-xs uppercase tracking-widest text-neutral-900 border-b border-neutral-900 pb-1 hover:opacity-60 transition-all"
                >
                    Ver pedido
                </Link>
                <Link
                    href={`/receipt/${encodeURIComponent(order.orderNumber)}`}
                    className="text-xs uppercase tracking-widest text-neutral-600 border-b border-neutral-300 pb-1 hover:opacity-60 transition-all"
                >
                    Ver recibo
                </Link>
            </div>
        </article>
    );
}

function OrderHistoryContent() {
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Aplica una página de resultados. Solo se invoca desde callbacks
    // asíncronos o desde manejadores de evento, nunca síncronamente en un efecto.
    const applyPage = (data: OrderPage) => {
        setOrders(data.orders);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);
        setError(null);
    };

    useEffect(() => {
        api.getMyOrders(0, PAGE_SIZE)
            .then(applyPage)
            .catch((err: unknown) => setError(getFriendlyErrorMessage(err)))
            .finally(() => setLoading(false));
    }, []);

    const goToPage = async (targetPage: number) => {
        setLoading(true);
        try {
            applyPage(await api.getMyOrders(targetPage, PAGE_SIZE));
        } catch (err: unknown) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
            <header className="mb-8">
                <BackLink href="/" label="Inicio" />
                <h1 className="mt-4 text-lg font-medium uppercase tracking-widest text-neutral-900">
                    Mis pedidos
                </h1>
                <p className="mt-2 text-xs text-neutral-500">
                    {totalElements === 1 ? "1 pedido" : `${totalElements} pedidos`}
                </p>
            </header>

            {loading ? (
                <p
                    role="status"
                    className="py-12 text-center text-xs uppercase tracking-widest text-neutral-600"
                >
                    Cargando pedidos...
                </p>
            ) : error ? (
                <div className="bg-white border border-neutral-200 p-8 text-center">
                    <p className="text-xs uppercase tracking-widest text-neutral-600 mb-4">
                        {error}
                    </p>
                    <button
                        type="button"
                        onClick={() => goToPage(page)}
                        className="text-xs uppercase tracking-widest text-neutral-900 border-b border-neutral-900 pb-1 hover:opacity-60 transition-all"
                    >
                        Reintentar
                    </button>
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white border border-neutral-200 p-12 text-center">
                    <p className="text-xs uppercase tracking-widest text-neutral-600 mb-4">
                        Todavía no has hecho ningún pedido
                    </p>
                    <Link
                        href="/"
                        className="inline-block bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest px-8 py-3 transition-colors"
                    >
                        Ver la colección
                    </Link>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-4">
                        {orders.map((order) => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <nav
                            aria-label="Paginación"
                            className="mt-8 flex items-center justify-between text-xs uppercase tracking-widest"
                        >
                            <button
                                type="button"
                                onClick={() => goToPage(page - 1)}
                                disabled={page === 0}
                                className="text-neutral-900 border-b border-neutral-900 pb-1 disabled:text-neutral-300 disabled:border-neutral-200 disabled:cursor-not-allowed transition-all"
                            >
                                Anterior
                            </button>

                            <span className="text-neutral-500">
                                Página {page + 1} de {totalPages}
                            </span>

                            <button
                                type="button"
                                onClick={() => goToPage(page + 1)}
                                disabled={page >= totalPages - 1}
                                className="text-neutral-900 border-b border-neutral-900 pb-1 disabled:text-neutral-300 disabled:border-neutral-200 disabled:cursor-not-allowed transition-all"
                            >
                                Siguiente
                            </button>
                        </nav>
                    )}
                </>
            )}
        </main>
    );
}

export default function OrderHistoryPage() {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
                <Header />
                <OrderHistoryContent />
            </div>
        </ProtectedRoute>
    );
}
