"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { Order } from "@/types/commerce";

export default function OrderDetailPage() {
    const params = useParams();
    const orderNumber = params?.orderNumber
        ? decodeURIComponent(params.orderNumber as string)
        : "";

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderNumber) return;

        async function fetchOrder() {
            try {
                setLoading(true);
                setError(null);
                const data = await api.getOrder(orderNumber);
                setOrder(data);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "No se pudo recuperar el pedido");
            } finally {
                setLoading(false);
            }
        }
        fetchOrder();
    }, [orderNumber]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
                <Header />
                <div className="flex-1 flex items-center justify-center text-xs uppercase tracking-widest text-neutral-400">
                    Recuperando justificante transaccional...
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
                <Header />
                <main className="flex-1 max-w-xl w-full mx-auto px-6 py-20 text-center">
          <span className="text-[11px] uppercase tracking-widest text-red-600 block mb-2 font-semibold">
            Registro No Encontrado
          </span>
                    <h1 className="text-xl font-light uppercase tracking-wide text-neutral-900 mb-4">
                        Pedido {orderNumber}
                    </h1>
                    <p className="text-xs text-neutral-500 mb-8 font-light">
                        No se ha localizado ningún pedido con este identificador en el núcleo transaccional.
                    </p>
                    <Link
                        href="/"
                        className="inline-block bg-neutral-900 text-white text-xs uppercase tracking-widest px-6 py-3 hover:bg-black transition-colors"
                    >
                        Volver a la Colección
                    </Link>
                </main>
            </div>
        );
    }

    const formattedDate = new Date(order.createdAt).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <div className="print:hidden">
                <Header />
            </div>

            <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
                {/* Acciones superiores */}
                <div className="flex items-center justify-between mb-8 print:hidden">
                    <Link
                        href="/"
                        className="text-xs uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
                    >
                        &larr; Volver al Catálogo
                    </Link>
                    <button
                        onClick={handlePrint}
                        className="border border-neutral-300 bg-white text-neutral-800 text-xs uppercase tracking-widest px-4 py-2 hover:border-black transition-colors"
                    >
                        Imprimir / Guardar Recibo
                    </button>
                </div>

                {/* Documento Editorial / Ticket Fiscal */}
                <div className="bg-white border border-neutral-200 p-8 sm:p-14 shadow-sm print:border-none print:shadow-none print:p-0">
                    <div className="border-b border-neutral-900 pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
              <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-1">
                Justificante de Compra Transaccional
              </span>
                            <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-tight text-neutral-900">
                                {order.orderNumber}
                            </h1>
                        </div>
                        <div className="sm:text-right">
              <span className="inline-block bg-neutral-900 text-white text-[10px] tracking-widest uppercase px-3 py-1 font-medium mb-1">
                {order.status}
              </span>
                            <span className="text-xs text-neutral-500 block font-light">
                {formattedDate}
              </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs mb-10 pb-8 border-b border-neutral-100">
                        <div>
              <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-1">
                Mercado Fiscal
              </span>
                            <span className="font-medium text-neutral-800">
                {order.marketCode} / {order.currency}
              </span>
                        </div>
                        <div>
              <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-1">
                Canal de Entrega
              </span>
                            <span className="font-medium text-neutral-800">
                Logística Centralizada
              </span>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-1">
                Estado Transacción
              </span>
                            <span className="font-medium text-neutral-800">
                Liquidado & Confirmado
              </span>
                        </div>
                    </div>

                    <div className="mb-10">
            <span className="text-[11px] uppercase tracking-widest text-neutral-900 block mb-4 font-medium">
              Líneas del Pedido
            </span>
                        <div className="divide-y divide-neutral-100 border-t border-b border-neutral-100">
                            {order.items.map((item) => (
                                <div key={item.id} className="py-4 flex items-center justify-between text-xs">
                                    <div>
                    <span className="font-mono text-neutral-900 font-medium block">
                      SKU: {item.skuCode}
                    </span>
                                        <span className="text-[11px] text-neutral-500 font-light">
                      Origen: {item.warehouseCode} &bull; Cantidad: {item.quantity} ud(s). &bull; IVA {item.taxRate}%
                    </span>
                                    </div>
                                    <div className="text-right">
                    <span className="font-medium text-neutral-900 block">
                      {item.totalAmount.toFixed(2)} {order.currency}
                    </span>
                                        <span className="text-[10px] text-neutral-400 font-light block">
                      ({item.unitPrice.toFixed(2)} {order.currency}/ud)
                    </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-neutral-50 p-6 border border-neutral-100 mb-8">
                        <div className="space-y-2 text-xs text-neutral-600">
                            <div className="flex justify-between">
                                <span>Base Imponible (Subtotal Neto):</span>
                                <span>{order.subtotalAmount.toFixed(2)} {order.currency}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Cuota de IVA Repercutido:</span>
                                <span>{order.taxAmount.toFixed(2)} {order.currency}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-neutral-900 pt-3 border-t border-neutral-200">
                                <span className="uppercase tracking-wider">Total Liquidado:</span>
                                <span>{order.totalAmount.toFixed(2)} {order.currency}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-neutral-200 text-[10px] text-neutral-400 space-y-1">
                        <p className="font-mono break-all">
                            <strong className="text-neutral-500">IDEMPOTENCY-KEY:</strong> {order.idempotencyKey}
                        </p>
                        <p className="italic">
                            Documento expedido bajo registro inmutable en PostgreSQL con índice B-Tree de unicidad.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}