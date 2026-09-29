"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import { Product, Sku, PriceBreakdown, StockInfo, Order } from "@/types/commerce";

interface PageProps {
    params: Promise<{ reference: string }>;
}

export default function ProductDetailPage({ params }: PageProps) {
    const resolvedParams = use(params);
    const referenceCode = decodeURIComponent(resolvedParams.reference);

    const [product, setProduct] = useState<Product | null>(null);
    const [selectedSku, setSelectedSku] = useState<Sku | null>(null);
    const [pricing, setPricing] = useState<PriceBreakdown | null>(null);
    const [stock, setStock] = useState<StockInfo | null>(null);

    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [orderConfirmed, setOrderConfirmed] = useState<Order | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        async function loadProduct() {
            try {
                setLoading(true);
                const data = await api.searchByReference(referenceCode);
                setProduct(data);
                if (data.skus && data.skus.length > 0) {
                    setSelectedSku(data.skus[0]);
                }
            } catch (err: unknown) {
                setErrorMessage(err instanceof Error ? err.message : "Error al cargar la prenda");
            } finally {
                setLoading(false);
            }
        }
        loadProduct();
    }, [referenceCode]);

    useEffect(() => {
        if (!selectedSku) return;

        async function loadSkuData() {
            try {
                const [priceData, stockData] = await Promise.all([
                    api.getPrice(selectedSku!.id, "ES"),
                    api.getStock(selectedSku!.id),
                ]);
                setPricing(priceData);
                setStock(stockData);
            } catch (err: unknown) {
                console.error("Error al actualizar precio/stock:", err);
            }
        }
        loadSkuData();
    }, [selectedSku]);

    const handleCheckout = async () => {
        if (!selectedSku || !stock || stock.breakdown.length === 0) return;

        const targetWarehouse = stock.breakdown.find((w) => w.netAvailable > 0);
        if (!targetWarehouse) {
            setErrorMessage("No hay stock disponible en ningún almacén para esta talla.");
            return;
        }

        try {
            setCheckoutLoading(true);
            setErrorMessage(null);

            // Clave de Idempotencia generada en cliente (UUID estándar RFC 4122)
            const idempotencyKey = crypto.randomUUID();

            const order = await api.checkout(
                {
                    marketCode: "ES",
                    items: [
                        {
                            skuId: selectedSku.id,
                            warehouseCode: targetWarehouse.warehouseCode,
                            quantity: 1,
                        },
                    ],
                },
                idempotencyKey
            );

            setOrderConfirmed(order);
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Error al procesar el checkout");
        } finally {
            setCheckoutLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col">
                <Header />
                <div className="flex-1 flex items-center justify-center text-xs uppercase tracking-widest text-neutral-400">
                    Cargando ficha editorial...
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <p className="text-sm uppercase tracking-wider text-neutral-600 mb-4">
                        Prenda no encontrada (REF: {referenceCode})
                    </p>
                    <Link href="/" className="text-xs uppercase tracking-widest underline">
                        Volver a la colección
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
                <div className="mb-6">
                    <Link
                        href="/"
                        className="text-xs uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
                    >
                        &larr; Volver al catálogo
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 bg-white border border-neutral-200 p-8 sm:p-12">
                    {/* Panel Izquierdo: Ficha Estilística */}
                    <div className="md:col-span-7 border-b md:border-b-0 md:border-r border-neutral-200 md:pr-12">
            <span className="text-[11px] uppercase tracking-widest text-neutral-400 block mb-2">
              REF. {product.referenceCode} / {product.family}
            </span>
                        <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wide text-neutral-900 mb-6">
                            {product.name}
                        </h1>

                        <div className="space-y-4 text-xs leading-relaxed text-neutral-600 font-light">
                            <p>{product.description}</p>
                            <p className="text-[11px] text-neutral-400 italic">
                                Prenda confeccionada bajo control de calidad de hilatura. Acabados manuales en costuras y forro interior completo.
                            </p>
                        </div>

                        {/* Desglose de Stock Omnicanal */}
                        {stock && (
                            <div className="mt-10 pt-6 border-t border-neutral-100">
                <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-3">
                  Disponibilidad Omnicanal en Tiempo Real (ATS)
                </span>
                                <div className="space-y-2">
                                    {stock.breakdown.map((wh) => (
                                        <div
                                            key={wh.warehouseCode}
                                            className="flex items-center justify-between text-xs text-neutral-700 bg-neutral-50 px-3 py-2 border border-neutral-100"
                                        >
                                            <span className="font-mono text-[11px]">{wh.warehouseCode} ({wh.countryCode})</span>
                                            <span className="text-[11px]">
                        {wh.netAvailable > 0 ? (
                            <strong className="text-neutral-900">{wh.netAvailable} uds. disponibles</strong>
                        ) : (
                            <span className="text-red-500 uppercase text-[10px]">Sin existencias</span>
                        )}
                      </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Panel Derecho: Selección y Checkout */}
                    <div className="md:col-span-5 flex flex-col justify-between">
                        <div>
                            {/* Tarificación Financiera Dinámica */}
                            <div className="pb-6 border-b border-neutral-200">
                                <div className="flex items-baseline space-x-3">
                  <span className="text-2xl font-light tracking-tight text-neutral-900">
                    {pricing ? `${pricing.finalPrice.toFixed(2)} ${pricing.currency}` : "---"}
                  </span>
                                    {pricing?.hasDiscount && (
                                        <span className="text-xs text-neutral-400 line-through">
                      {pricing.originalPrice.toFixed(2)} {pricing.currency}
                    </span>
                                    )}
                                </div>
                                {pricing && (
                                    <span className="text-[11px] text-neutral-400 block mt-1 tracking-wider uppercase">
                    IVA incluido ({pricing.taxRate}%): {pricing.taxAmount.toFixed(2)} {pricing.currency} (Base: {pricing.netAmount.toFixed(2)} {pricing.currency})
                  </span>
                                )}
                            </div>

                            {/* Selector de Tallas */}
                            <div className="py-6">
                <span className="text-[11px] uppercase tracking-widest text-neutral-500 block mb-3">
                  Seleccionar Talla
                </span>
                                <div className="grid grid-cols-4 gap-2">
                                    {product.skus.map((sku) => (
                                        <button
                                            key={sku.id}
                                            onClick={() => setSelectedSku(sku)}
                                            className={`py-3 text-xs uppercase tracking-wider border transition-all ${
                                                selectedSku?.id === sku.id
                                                    ? "border-neutral-900 bg-neutral-900 text-white"
                                                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                                            }`}
                                        >
                                            {sku.size}
                                        </button>
                                    ))}
                                </div>
                                {selectedSku && (
                                    <span className="text-[10px] text-neutral-400 font-mono block mt-2">
                    Barcode: {selectedSku.barcode}
                  </span>
                                )}
                            </div>

                            {errorMessage && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs mb-4">
                                    {errorMessage}
                                </div>
                            )}
                        </div>

                        {/* Acción de Compra Idempotente */}
                        <div>
                            <button
                                onClick={handleCheckout}
                                disabled={checkoutLoading || !stock?.inStock}
                                className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-4 transition-all disabled:opacity-40 disabled:hover:bg-neutral-900"
                            >
                                {checkoutLoading
                                    ? "Procesando transacción..."
                                    : stock?.inStock
                                        ? "Comprar Ahora"
                                        : "Agotado"}
                            </button>

                            <div className="mt-4 text-center">
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">
                  Transacción protegida con Idempotency-Key
                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal de Confirmación de Pedido */}
                {orderConfirmed && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white max-w-md w-full border border-neutral-900 p-8 shadow-2xl">
              <span className="text-[10px] uppercase tracking-widest text-emerald-600 block mb-1 font-semibold">
                Compra completada con éxito
              </span>
                            <h2 className="text-xl font-light uppercase tracking-wide text-neutral-900 mb-4">
                                Pedido {orderConfirmed.orderNumber}
                            </h2>

                            <div className="space-y-2 text-xs text-neutral-600 pb-4 border-b border-neutral-200 mb-4">
                                <div className="flex justify-between">
                                    <span>Estado:</span>
                                    <span className="font-semibold text-neutral-900">{orderConfirmed.status}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Mercado:</span>
                                    <span>{orderConfirmed.marketCode} ({orderConfirmed.currency})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Base Imponible:</span>
                                    <span>{orderConfirmed.subtotalAmount.toFixed(2)} {orderConfirmed.currency}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Impuestos (IVA):</span>
                                    <span>{orderConfirmed.taxAmount.toFixed(2)} {orderConfirmed.currency}</span>
                                </div>
                                <div className="flex justify-between text-sm font-medium text-neutral-900 pt-2 border-t border-neutral-100">
                                    <span>Total Cargado:</span>
                                    <span>{orderConfirmed.totalAmount.toFixed(2)} {orderConfirmed.currency}</span>
                                </div>
                            </div>

                            <div className="text-[10px] font-mono text-neutral-400 break-all mb-6">
                                Idempotency-Key: {orderConfirmed.idempotencyKey}
                            </div>

                            <button
                                onClick={() => {
                                    setOrderConfirmed(null);
                                    window.location.reload();
                                }}
                                className="w-full bg-neutral-900 text-white text-xs uppercase tracking-widest py-3 hover:bg-black transition-colors"
                            >
                                Aceptar y Finalizar
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}