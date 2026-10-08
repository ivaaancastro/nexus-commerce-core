"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import CatalogFilters from "@/components/CatalogFilters";
import ProductCard, { EAGER_CARDS } from "@/components/ProductCard";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { FamilyResponse, Product, ProductFilters, SortOption } from "@/types/commerce";

/**
 * Tarea 3.1, R4 y R5 — sección del catálogo con filtros.
 *
 * `useSearchParams` obliga a envolver el contenido en `<Suspense>`: sin él,
 * `next build` falla porque la ruta no podría prerenderizarse (D8). Por eso el
 * componente que se exporta no lee la URL — sólo monta el contenedor con su
 * fallback.
 */
export default function CatalogPage() {
    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />
            <Suspense fallback={<CatalogSkeleton />}>
                <CatalogContent />
            </Suspense>
        </div>
    );
}

function CatalogSkeleton() {
    return (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
            <div className="mb-8 pb-4 border-b border-neutral-200 h-14 bg-neutral-100 animate-pulse" />
            <div className="flex gap-10">
                <aside className="hidden lg:block w-56 shrink-0 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-20 bg-neutral-100 animate-pulse" />
                    ))}
                </aside>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </main>
    );
}

function CatalogContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // La URL ES el estado: se lee de ella en cada render y nunca se duplica en
    // useState. Así «compartir», «recargar» y «atrás» funcionan sin código extra (R5).
    const family = searchParams.get("family") ?? undefined;
    const size = searchParams.get("size") ?? undefined;
    const color = searchParams.get("color") ?? undefined;
    const sort = (searchParams.get("sort") as SortOption | null) ?? undefined;

    const filters: ProductFilters = useMemo(
        () => ({ family, size, color, sort }),
        [family, size, color, sort]
    );

    const [families, setFamilies] = useState<FamilyResponse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [panelAbierto, setPanelAbierto] = useState(false);

    // La taxonomía se pide una sola vez: no depende de los filtros activos.
    useEffect(() => {
        let cancelled = false;

        api.getFamilies()
            .then((data) => {
                if (!cancelled) setFamilies(data);
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? getFriendlyErrorMessage(err)
                            : "Error al cargar las familias del catálogo"
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // El catálogo se recarga en CADA cambio de filtro: el filtrado es del
    // backend (Q2), no un filter() en cliente sobre una lista ya cargada.
    useEffect(() => {
        let cancelled = false;

        const cargarProductos = async () => {
            try {
                setLoading(true);
                setError(null);

                const data = await api.getProducts({ family, size, color, sort });
                if (!cancelled) setProducts(data);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? getFriendlyErrorMessage(err)
                            : "Error al conectar con el backend"
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        cargarProductos();

        return () => {
            cancelled = true;
        };
    }, [family, size, color, sort]);

    /**
     * Escribe el estado en la URL. Se usa `push` y no `replace` porque R5 pide
     * que «atrás» y «adelante» del navegador recorran el historial de filtros.
     * Los parámetros por defecto no se emiten, para que la URL quede limpia.
     */
    const aplicarFiltros = useCallback(
        (next: ProductFilters) => {
            const params = new URLSearchParams();
            if (next.family) params.set("family", next.family);
            if (next.size) params.set("size", next.size);
            if (next.color) params.set("color", next.color);
            if (next.sort && next.sort !== "default") params.set("sort", next.sort);

            const query = params.toString();
            router.push(query ? `${pathname}?${query}` : pathname);
        },
        [router, pathname]
    );

    // Tallas y colores salen de la respuesta, no de una lista fija en cliente.
    // Si la selección activa no está entre ellos (porque dejó 0 resultados) se
    // reincorpora: sin eso, R10 no podría mostrar la opción para deseleccionarla.
    const sizes = useMemo(() => {
        const values = new Set(products.flatMap((product) => product.skus.map((sku) => sku.size)));
        if (size) values.add(size);
        return [...values].sort();
    }, [products, size]);

    const colors = useMemo(() => {
        const values = new Set(products.flatMap((product) => product.skus.map((sku) => sku.color)));
        if (color) values.add(color);
        return [...values].sort();
    }, [products, color]);

    const filtrosActivos = [family, size, color, sort && sort !== "default" ? sort : undefined]
        .filter(Boolean).length;

    const titulo = family ?? "Catálogo";

    return (
        <>
            <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
                <header className="mb-8 pb-4 border-b border-neutral-200 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2">
                            Colección
                        </p>
                        <h1 className="text-lg font-medium uppercase tracking-widest text-neutral-900">
                            {titulo}
                        </h1>
                        <p className="text-xs text-neutral-500 mt-2 uppercase tracking-wide">
                            {loading
                                ? "Cargando…"
                                : `${products.length} ${products.length === 1 ? "prenda" : "prendas"}`}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setPanelAbierto(true)}
                        className="lg:hidden text-xs uppercase tracking-widest border border-neutral-900 text-neutral-900 px-5 py-2.5 hover:bg-neutral-900 hover:text-white transition-all duration-300"
                    >
                        Filtrar{filtrosActivos > 0 ? ` (${filtrosActivos})` : ""}
                    </button>
                </header>

                {error && (
                    <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-800 text-xs">
                        <span className="font-semibold uppercase tracking-wider block mb-1">
                            Error de conexión
                        </span>
                        <span className="block">{error}</span>
                        <span className="block text-red-700 mt-1">
                            Asegúrate de que el backend de Spring Boot está corriendo en el
                            puerto 8080.
                        </span>
                    </div>
                )}

                <div className="flex gap-10">
                    {/* Escritorio: columna fija a la izquierda (R4) */}
                    <aside className="hidden lg:block w-56 shrink-0">
                        <div className="sticky top-24">
                            <CatalogFilters
                                families={families}
                                sizes={sizes}
                                colors={colors}
                                filters={filters}
                                onChange={aplicarFiltros}
                                disabled={loading}
                            />
                        </div>
                    </aside>

                    <div className="flex-1 min-w-0">
                        {loading && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <ProductCardSkeleton key={i} />
                                ))}
                            </div>
                        )}

                        {!loading && products.length > 0 && (
                            <ErrorBoundary>
                                {/* La respuesta llega entera: scroll continuo, sin controles de paginación (D10) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {products.map((product, index) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            eager={index < EAGER_CARDS}
                                        />
                                    ))}
                                </div>
                            </ErrorBoundary>
                        )}

                        {!loading && !error && products.length === 0 && (
                            <div className="py-24 text-center border border-dashed border-neutral-200 bg-white">
                                <p className="text-sm text-neutral-500 uppercase tracking-wider">
                                    Sin resultados
                                </p>
                                <p className="text-xs text-neutral-600 mt-2">
                                    Ninguna prenda coincide con los filtros seleccionados.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => aplicarFiltros({})}
                                    className="mt-6 text-xs uppercase tracking-widest text-neutral-900 underline underline-offset-4 hover:text-black transition-colors"
                                >
                                    Limpiar filtros
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Móvil: el mismo componente, en un panel desplegable desde «Filtrar» (R4) */}
            {panelAbierto && (
                <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Filtros">
                    <div
                        className="absolute inset-0 bg-black/30"
                        onClick={() => setPanelAbierto(false)}
                    />
                    <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-200">
                            <h2 className="text-xs uppercase tracking-widest text-neutral-900">
                                Filtrar
                            </h2>
                            <button
                                type="button"
                                onClick={() => setPanelAbierto(false)}
                                className="text-xs uppercase tracking-wide text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>

                        <CatalogFilters
                            families={families}
                            sizes={sizes}
                            colors={colors}
                            filters={filters}
                            onChange={aplicarFiltros}
                            disabled={loading}
                        />

                        <button
                            type="button"
                            onClick={() => setPanelAbierto(false)}
                            className="mt-8 w-full text-xs uppercase tracking-widest bg-neutral-900 text-white py-3 hover:bg-black transition-all duration-300"
                        >
                            Ver {products.length} {products.length === 1 ? "prenda" : "prendas"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
