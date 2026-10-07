"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import ProductDetailSkeleton from "@/components/ProductDetailSkeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import AddToCartButton from "@/components/AddToCartButton";
import ProductGallery, { GALLERY_SIZES } from "@/components/ProductGallery";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage, isNotFoundError } from "@/lib/errors";
import { useMarket } from "@/context/MarketContext";
import { Product, Sku, PriceBreakdown, StockInfo } from "@/types/commerce";
import { useParams } from "next/navigation";

export default function ProductDetailPage() {
    const params = useParams();
    const referenceCode = params?.reference
        ? decodeURIComponent(params.reference as string)
        : "";
    const { market } = useMarket();
    const marketCode = market.code;

    const [product, setProduct] = useState<Product | null>(null);
    const [selectedSku, setSelectedSku] = useState<Sku | null>(null);
    const [pricing, setPricing] = useState<PriceBreakdown | null>(null);
    const [stock, setStock] = useState<StockInfo | null>(null);
    // R4: el mercado activo no tiene precio para este SKU — no es un error.
    const [priceUnavailable, setPriceUnavailable] = useState(false);

    const [loading, setLoading] = useState(true);
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
                setErrorMessage(
                    err instanceof Error
                        ? getFriendlyErrorMessage(err)
                        : "Error al cargar la prenda"
                );
            } finally {
                setLoading(false);
            }
        }
        loadProduct();
    }, [referenceCode]);

    useEffect(() => {
        if (!selectedSku) return;

        // El efecto ahora también se dispara al cambiar de mercado, así que una
        // respuesta tardía de un mercado anterior no debe sobrescribir la nueva.
        let cancelled = false;

        async function loadSkuData() {
            // 1. Limpiamos el estado anterior para evitar datos residuales
            setStock(null);
            setPricing(null);
            setErrorMessage(null);
            setPriceUnavailable(false);

            const [priceResult, stockResult] = await Promise.allSettled([
                api.getPrice(selectedSku!.id, marketCode),
                api.getStock(selectedSku!.id),
            ]);

            if (cancelled) return;

            // El stock se pinta aunque falle el precio: la prenda existe, lo que
            // puede faltar es su precio en este mercado (R4).
            if (stockResult.status === "fulfilled") {
                setStock(stockResult.value);
            } else {
                setErrorMessage("No se pudieron recuperar las existencias para la talla seleccionada.");
            }

            if (priceResult.status === "fulfilled") {
                setPricing(priceResult.value);
            } else if (isNotFoundError(priceResult.reason)) {
                // Ese mercado no tiene precio para este SKU → estado, no error.
                setPriceUnavailable(true);
            } else {
                setErrorMessage("No se pudo recuperar el precio para la talla seleccionada.");
            }
        }
        loadSkuData();

        return () => {
            cancelled = true;
        };
    }, [selectedSku, marketCode]);

    if (loading) {
        return <ProductDetailSkeleton />;
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
        <ErrorBoundary>
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

                    {/*
                        R7 — galería + panel de compra + descripción.

                        El orden del DOM es también el de móvil (galería, compra,
                        descripción); la disposición de escritorio se consigue con
                        colocación explícita de rejilla, **nunca** reordenando el
                        DOM: así el tabulador y un lector de pantalla recorren la
                        página en el mismo sentido que la ve el usuario.
                    */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-x-12 bg-white border border-neutral-200 p-8 sm:p-12">
                        {/* Galería: 1 columna en móvil, 2 a partir de 768px */}
                        <div className="md:col-start-1 md:col-span-7 md:row-start-1">
                            <ProductGallery
                                referenceCode={product.referenceCode}
                                name={product.name}
                                family={product.family}
                                sizes={GALLERY_SIZES}
                            />
                        </div>

                        {/* Panel de compra: fijo al hacer scroll en escritorio */}
                        <div
                            className="md:col-start-8 md:col-span-5 md:row-start-1 md:row-span-2 md:self-start md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto flex flex-col"
                            data-testid="purchase-panel"
                        >
                            <div>
                                <span className="text-[11px] uppercase tracking-widest text-neutral-400 block mb-2">
                                    REF. {product.referenceCode} / {product.family}
                                </span>
                                <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wide text-neutral-900 mb-6">
                                    {product.name}
                                </h1>

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
                                    {priceUnavailable ? (
                                        <span className="text-xs uppercase tracking-widest text-neutral-500 block mt-1">
                                            No disponible en {market.name}
                                        </span>
                                    ) : (
                                        pricing && (
                                            <span className="text-[11px] text-neutral-400 block mt-1 tracking-wider uppercase">
                                                Impuestos ({pricing.taxRate}%): {pricing.taxAmount.toFixed(2)} {pricing.currency} (Base: {pricing.netAmount.toFixed(2)} {pricing.currency})
                                            </span>
                                        )
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

                                {/* Desglose de Stock Omnicanal */}
                                {stock && (
                                    <div className="pt-6 border-t border-neutral-100">
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

                            {/* Acción de Compra Idempotente */}
                            <div className="pt-6">
                                <AddToCartButton
                                    productId={product.id}
                                    referenceCode={product.referenceCode}
                                    name={product.name}
                                    family={product.family}
                                    skuId={selectedSku!.id}
                                    size={selectedSku!.size}
                                    color={selectedSku!.color}
                                    unitPrice={pricing?.finalPrice ?? 0}
                                    currency={pricing?.currency ?? market.currency}
                                    disabled={
                                        priceUnavailable ||
                                        !stock?.inStock ||
                                        !stock?.breakdown.some(w => w.netAvailable > 0)
                                    }
                                />

                                <div className="mt-4 text-center">
                                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">
                                        Envío gratuito en pedidos superiores a 50 {market.currency}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Descripción: bajo la galería, no en una columna propia */}
                        <div
                            className="md:col-start-1 md:col-span-7 md:row-start-2 border-t border-neutral-200 pt-8"
                            data-testid="product-description"
                        >
                            <div className="space-y-4 text-xs leading-relaxed text-neutral-600 font-light">
                                <p>{product.description}</p>
                                <p className="text-[11px] text-neutral-400 italic">
                                    Prenda confeccionada bajo control de calidad de hilatura. Acabados manuales en costuras y forro interior completo.
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </ErrorBoundary>
    );
}
