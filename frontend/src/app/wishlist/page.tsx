"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProductImage from "@/components/ProductImage";
import Toast from "@/components/Toast";
import { useWishlist } from "@/context/WishlistContext";
import { useMarket } from "@/context/MarketContext";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { getProductImages } from "@/lib/product-images";
import { WishlistItem } from "@/types/commerce";

/**
 * `sizes` de la miniatura de fila: `w-20` (80 px) en móvil y `w-24` (96 px)
 * a partir de `sm`. Valor fijo por breakpoint (no deriva de la rejilla).
 */
const WISHLIST_THUMB_SIZES = "(max-width: 639px) 80px, 96px";

/**
 * Mismo formateo que `AdminMetrics` — `Intl.NumberFormat`, jamás el símbolo de
 * euro a mano (guardia `TaxCopy`) — con `currencyDisplay: "narrowSymbol"`.
 *
 * <p>Medido en Node **y** Chromium: por defecto `es-ES` imprime el EUR con su
 * símbolo pero el GBP como **código** («79,99 GBP»), y una misma lista
 * quedaría a mixtas. `narrowSymbol` da símbolo en todos los mercados (GBP
 * pasa a su libra) siguiendo mandando **Intl**: en `src/` no hay ni un
 * símbolo escrito —ni siquiera en este comentario, que `TaxCopy` lo lee—
 * (decisión del usuario, 2026-10-26 — plan D13).</p>
 */
function formatearPrecio(valor: number, currency: string): string {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
    }).format(valor);
}

/**
 * Página de favoritos (spec V3 wishlist, plan D8).
 *
 * <p>Lista editorial con miniatura por manifiesto (cero 404), enlace «Ver
 * producto» con la URL codificada (`%2F`, lección de `color-and-care`),
 * «Quitar» por fila, «Vaciar favoritos» con `window.confirm` (patrón 7.4/7.5)
 * y toasts locales (patrón `orders/[orderNumber]` — no hay `ToastProvider`
 * global y no hace falta uno).</p>
 *
 * <p>**Precios «desde» del mercado activo** (R7.6, decisión del usuario):
 * mínimo `finalPrice` entre los SKUs de cada producto, pedido al endpoint
 * existente `/pricing` y **re-pedido al cambiar de mercado** — nunca se
 * guardan importes en ningún sitio (D13).</p>
 */
export default function WishlistPage() {
    const { items, isHydrated, hasLoadError, remove, clear, reload } = useWishlist();
    const { market } = useMarket();

    const [toast, setToast] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [clearing, setClearing] = useState(false);

    // Precios por producto (R7.6). La clave identifica mercado + lista; si lo
    // guardado no corresponde a la clave vigente se **deriva** «sin datos»
    // (línea de precio en «…») sin escribir estado en el cuerpo del efecto —
    // regla `react-hooks/set-state-in-effect`. Al resolver, la clave pasada a
    // mano deja de coincidir si el usuario cambió de mercado a mitad de
    // vuelo, y ese resultado viejo se descarta solo.
    const preciosKey = `${market.code}:${items.map((i) => i.product.id).join(",")}`;
    const [precios, setPrecios] = useState<{ key: string; data: Record<number, number | null> }>({
        key: "",
        data: {},
    });

    useEffect(() => {
        if (items.length === 0) return;
        let cancelled = false;

        const consultas = items.map((item) =>
            Promise.all(
                item.product.skus.map((sku) =>
                    api.getPrice(sku.id, market.code)
                        .then((p) => p.finalPrice)
                        // SKU sin precio en este mercado: no es un error (3.2 R6).
                        .catch(() => null)
                )
            ).then((valores) => {
                const conPrecio = valores.filter((v): v is number => v !== null);
                return {
                    id: item.product.id,
                    min: conPrecio.length > 0 ? Math.min(...conPrecio) : null,
                };
            })
        );

        Promise.all(consultas).then((resultados) => {
            if (cancelled) return;
            const data: Record<number, number | null> = {};
            resultados.forEach((r) => {
                data[r.id] = r.min;
            });
            setPrecios({ key: preciosKey, data });
        });
        // Cancelación al cambiar de mercado o al desmontar: además de la guarda
        // de `key`, el resultado viejo ni siquiera se intenta guardar.
        return () => {
            cancelled = true;
        };
        // `items` entero a propósito: cada recarga de la lista cambia el
        // conjunto de precios que hay que pedir.
    }, [items, market.code, preciosKey]);

    const preciosVisibles = precios.key === preciosKey ? precios.data : {};

    async function handleRemove(item: WishlistItem) {
        setRemovingId(item.id);
        try {
            await remove(item.product.id);
            setToast("Producto eliminado de favoritos");
        } catch (error) {
            setToast(getFriendlyErrorMessage(error));
        } finally {
            setRemovingId(null);
        }
    }

    async function handleClear() {
        if (!window.confirm("¿Vaciar tu lista de favoritos? Esta acción no se puede deshacer.")) {
            return;
        }
        setClearing(true);
        try {
            await clear();
            setToast("Lista de favoritos vaciada");
        } catch (error) {
            setToast(getFriendlyErrorMessage(error));
        } finally {
            setClearing(false);
        }
    }

    return (
        <ProtectedRoute>
            <Header />
            <main className="flex-1 bg-neutral-50">
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <div className="flex items-baseline justify-between mb-10">
                        <h1 className="text-lg font-medium uppercase tracking-widest text-neutral-900">
                            Favoritos
                        </h1>
                        {items.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={clearing}
                                className="text-[11px] uppercase tracking-widest text-neutral-600 hover:text-neutral-900 underline underline-offset-4 transition-colors disabled:opacity-40"
                            >
                                {clearing ? "Vaciando…" : "Vaciar favoritos"}
                            </button>
                        )}
                    </div>

                    {isHydrated && hasLoadError && items.length === 0 ? (
                        /* Carga fallida: amigable + Reintentar (R7.5) */
                        <div className="border border-neutral-200 bg-white p-12 text-center">
                            <p className="text-xs text-neutral-600 font-light mb-6">
                                No se pudo cargar tu lista de favoritos. Comprueba tu
                                conexión e inténtalo de nuevo.
                            </p>
                            <button
                                type="button"
                                onClick={reload}
                                className="bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest px-8 py-3 transition-colors"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : !isHydrated ? (
                        <p
                            role="status"
                            className="text-[11px] uppercase tracking-widest text-neutral-600 text-center py-12"
                        >
                            Cargando favoritos…
                        </p>
                    ) : items.length === 0 ? (
                        <div className="border border-neutral-200 bg-white p-12 text-center">
                            <p className="text-xs text-neutral-600 font-light mb-6">
                                Tu lista de favoritos está vacía. Guarda productos con
                                el corazón de la ficha o del catálogo.
                            </p>
                            <Link
                                href="/catalog"
                                className="inline-block bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest px-8 py-3 transition-colors"
                            >
                                Ver colección
                            </Link>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {items.map((item) => {
                                const precio = preciosVisibles[item.product.id];
                                return (
                                    <li
                                        key={item.id}
                                        className="flex gap-4 sm:gap-6 border border-neutral-200 bg-white p-4"
                                        data-testid="wishlist-row"
                                    >
                                        <div className="w-20 sm:w-24 shrink-0">
                                            <ProductImage
                                                src={getProductImages(item.product.referenceCode)[0]}
                                                alt={item.product.name}
                                                sizes={WISHLIST_THUMB_SIZES}
                                                name={item.product.name}
                                                family={item.product.family}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] tracking-widest uppercase text-neutral-600 block mb-1">
                                                REF. {item.product.referenceCode}
                                            </span>
                                            <span className="text-[11px] uppercase tracking-wider text-neutral-500 block mb-1">
                                                {item.product.family}
                                            </span>
                                            <h2 className="text-sm font-medium text-neutral-900 mb-2">
                                                {item.product.name}
                                            </h2>
                                            {/* Precio «desde» del mercado activo (R7.6/D13) */}
                                            <p
                                                className="text-xs text-neutral-900"
                                                data-testid={`wishlist-price-${item.product.id}`}
                                            >
                                                {precio === undefined ? (
                                                    <span className="text-neutral-400">…</span>
                                                ) : precio === null ? (
                                                    <span className="text-[11px] uppercase tracking-wider text-neutral-600">
                                                        No disponible en este mercado
                                                    </span>
                                                ) : (
                                                    <span>
                                                        Desde {formatearPrecio(precio, market.currency)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex flex-col items-end justify-between gap-3 shrink-0">
                                            <Link
                                                href={`/products/${encodeURIComponent(item.product.referenceCode)}`}
                                                className="text-[11px] uppercase tracking-widest text-neutral-900 underline underline-offset-4 hover:text-neutral-600 transition-colors"
                                            >
                                                Ver producto
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(item)}
                                                disabled={removingId === item.id}
                                                aria-label={`Quitar ${item.product.name} de favoritos`}
                                                className="text-[11px] uppercase tracking-widest text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-40"
                                            >
                                                {removingId === item.id ? "Quitando…" : "Quitar"}
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </main>
            <Toast
                message={toast ?? ""}
                isVisible={toast !== null}
                onClose={() => setToast(null)}
            />
        </ProtectedRoute>
    );
}
