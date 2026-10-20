"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { AdminDashboard, OrderStatus } from "@/types/commerce";

/** Periodos que ofrece la UI (R6): el backend acepta 1–365; aquí 7/30/90. */
const PERIODOS = [7, 30, 90];

/** Orden de lectura de la tarjeta de estados — distinto del orden del enum. */
const ESTADOS: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

const ETIQUETAS_ESTADO: Record<OrderStatus, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
};

/** Importe según la moneda de su propia fila — jamás se mezclan divisas (R2). */
function importe(valor: number, currency: string): string {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(valor);
}

function entero(valor: number): string {
    return valor.toLocaleString("es-ES");
}

/**
 * Métricas de la portada del panel (Tarea 7.6, spec specs/admin-dashboard/ R6/R7).
 *
 * - **Una sola petición** `GET /api/v1/admin/dashboard?days=…` por periodo;
 *   el selector sólo cambia `days` y re-pide (nada de cálculo en cliente).
 * - Cuatro tarjetas: **Ventas** (ingresos y ticket medio **por moneda**,
 *   nunca agregados), **Estados** (las 5 claves con barras relativas),
 *   **Catálogo** y **Usuarios**.
 * - Estados honestos: cargando · error con `getFriendlyErrorMessage()` y
 *   «Reintentar» · periodo vacío con **ceros visibles** (nunca `NaN` ni «—»).
 * - Las barras son decorativas (`aria-hidden`): el número de al lado es la
 *   información; nada se comunica sólo por el ancho.
 */
export default function AdminMetrics() {
    const [days, setDays] = useState(30);
    const [datos, setDatos] = useState<AdminDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Recarga bajo demanda (botón «Reintentar»); mismo patrón del resto del panel.
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let activo = true;
        api.getAdminDashboard(days)
            .then((obtenida) => {
                if (activo) {
                    setDatos(obtenida);
                    setError(null);
                }
            })
            .catch((err: unknown) => {
                if (activo) setError(getFriendlyErrorMessage(err));
            });
        return () => {
            activo = false;
        };
    }, [days, version]);

    const reintentar = () => {
        setError(null);
        setVersion((v) => v + 1);
    };

    return (
        <section aria-labelledby="metricas-titulo" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="metricas-titulo" className="text-sm font-medium uppercase tracking-widest">
                    Métricas
                </h2>
                <div
                    role="group"
                    aria-label="Periodo de las métricas"
                    className="flex gap-2"
                >
                    {PERIODOS.map((periodo) => (
                        <button
                            key={periodo}
                            type="button"
                            aria-pressed={days === periodo}
                            onClick={() => setDays(periodo)}
                            className={`border px-3 py-1.5 text-[11px] uppercase tracking-widest transition-colors ${
                                days === periodo
                                    ? "border-neutral-900 text-neutral-900"
                                    : "border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900"
                            }`}
                        >
                            {periodo} días
                        </button>
                    ))}
                </div>
            </div>

            {error ? (
                <div role="alert" className="border border-neutral-200 bg-white p-6 flex flex-col gap-3">
                    <p className="text-xs uppercase tracking-widest text-neutral-600">
                        No se pudieron cargar las métricas
                    </p>
                    <p className="text-sm font-light text-neutral-700">{error}</p>
                    <button
                        type="button"
                        onClick={reintentar}
                        className="self-start border border-neutral-900 px-4 py-2 text-[11px] uppercase tracking-widest text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
                    >
                        Reintentar
                    </button>
                </div>
            ) : !datos ? (
                <div className="border border-neutral-200 bg-white p-6">
                    <p role="status" className="text-sm font-light text-neutral-700">
                        Cargando métricas…
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {/* ── Ventas ──────────────────────────────────────────── */}
                    <section
                        aria-labelledby="ventas-titulo"
                        className="border border-neutral-200 bg-white p-6 flex flex-col gap-3"
                    >
                        <h3
                            id="ventas-titulo"
                            className="text-xs uppercase tracking-widest text-neutral-600"
                        >
                            Ventas
                        </h3>
                        <p className="text-2xl font-medium text-neutral-900">
                            {entero(datos.sales.orderCount)}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                            Pedidos no cancelados · {datos.range.days} días
                        </p>
                        {datos.sales.revenue.length === 0 ? (
                            <p className="text-sm font-light text-neutral-700">
                                Sin ingresos en el periodo.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
                                {datos.sales.revenue.map((fila) => (
                                    <li
                                        key={fila.currency}
                                        className="flex items-baseline justify-between gap-3"
                                    >
                                        <span className="text-[10px] uppercase tracking-widest text-neutral-600">
                                            {fila.currency}
                                        </span>
                                        <span className="flex flex-col items-end">
                                            <span className="text-sm font-medium text-neutral-900">
                                                {importe(fila.total, fila.currency)}
                                            </span>
                                            <span className="text-[10px] font-light text-neutral-600">
                                                Ticket medio {importe(fila.avgTicket, fila.currency)}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* ── Estados ─────────────────────────────────────────── */}
                    <section
                        aria-labelledby="estados-titulo"
                        className="border border-neutral-200 bg-white p-6 flex flex-col gap-3"
                    >
                        <h3
                            id="estados-titulo"
                            className="text-xs uppercase tracking-widest text-neutral-600"
                        >
                            Estados de pedido
                        </h3>
                        <ul className="flex flex-col gap-2.5">
                            {ESTADOS.map((estado) => {
                                const n = datos.sales.byStatus[estado] ?? 0;
                                const max = Math.max(
                                    ...ESTADOS.map((e) => datos.sales.byStatus[e] ?? 0),
                                    1
                                );
                                const pct = Math.round((n / max) * 100);
                                return (
                                    <li key={estado} className="flex flex-col gap-1">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-[10px] uppercase tracking-widest text-neutral-600">
                                                {ETIQUETAS_ESTADO[estado]}
                                            </span>
                                            <span className="text-sm font-medium text-neutral-900">
                                                {entero(n)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-neutral-100" aria-hidden="true">
                                            <div
                                                className="h-full bg-neutral-900"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    {/* ── Catálogo ────────────────────────────────────────── */}
                    <section
                        aria-labelledby="catalogo-titulo"
                        className="border border-neutral-200 bg-white p-6 flex flex-col gap-3"
                    >
                        <h3
                            id="catalogo-titulo"
                            className="text-xs uppercase tracking-widest text-neutral-600"
                        >
                            Catálogo
                        </h3>
                        <dl className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    Productos
                                </dt>
                                <dd className="text-sm font-medium text-neutral-900">
                                    {entero(datos.products.total)}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    SKUs
                                </dt>
                                <dd className="text-sm font-medium text-neutral-900">
                                    {entero(datos.products.skus)}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    Familias
                                </dt>
                                <dd className="text-sm font-medium text-neutral-900">
                                    {entero(datos.products.families)}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    {/* ── Usuarios ────────────────────────────────────────── */}
                    <section
                        aria-labelledby="usuarios-titulo"
                        className="border border-neutral-200 bg-white p-6 flex flex-col gap-3"
                    >
                        <h3
                            id="usuarios-titulo"
                            className="text-xs uppercase tracking-widest text-neutral-600"
                        >
                            Usuarios
                        </h3>
                        <dl className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    Total
                                </dt>
                                <dd className="text-sm font-medium text-neutral-900">
                                    {entero(datos.users.total)}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    Administradores
                                </dt>
                                <dd className="text-sm font-medium text-neutral-900">
                                    {entero(datos.users.admins)}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    Nuevas en el periodo
                                </dt>
                                <dd className="text-sm font-medium text-neutral-900">
                                    {entero(datos.users.newInPeriod)}
                                </dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    Suspendidas
                                </dt>
                                <dd className="text-sm font-medium text-neutral-900">
                                    {entero(datos.users.suspended)}
                                </dd>
                            </div>
                        </dl>
                    </section>
                </div>
            )}
        </section>
    );
}
