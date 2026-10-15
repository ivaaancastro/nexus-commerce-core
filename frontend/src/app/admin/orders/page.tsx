"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { AdminOrderPage, OrderStatus } from "@/types/commerce";

/** Etiquetas del select de filtro (espejo de `OrderStatusBadge`). */
const ETIQUETAS: Record<OrderStatus, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
};

const ESTADOS: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

function fechaCorta(valor: string): string {
    return new Date(valor).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

/**
 * Listado de pedidos del panel (Tarea 7.4, spec specs/admin-orders/ R1).
 *
 * - **Todo el filtrado vive en el servidor** (R1.2/R1.3): el select de estado
 *   y la búsqueda por nº de pedido o cliente sólo cambian los query params y
 *   re-piden la página — nunca hay un `filter()` en cliente.
 * - Paginación anterior/siguiente con el `totalPages` del backend (R1.1); el
 *   catálogo de vitrina nunca se pagina, pero este listado sí (D2).
 * - Cualquier fila abre el detalle, único sitio donde se cambia el estado (R3).
 */
export default function AdminOrdersPage() {
    const [datos, setDatos] = useState<AdminOrderPage | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros: `busqueda` es lo que se teclea, `qAplicada` lo que ya mandó
    // el servidor (se confirma con el botón/Enter, no en cada tecla).
    const [busqueda, setBusqueda] = useState("");
    const [qAplicada, setQAplicada] = useState("");
    const [estadoFiltro, setEstadoFiltro] = useState<OrderStatus | "">("");
    const [pagina, setPagina] = useState(0);

    // Recarga bajo demanda (botón «Reintentar»); mismo patrón del resto del panel.
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let activo = true;
        api.getAdminOrders({
            page: pagina,
            status: estadoFiltro || undefined,
            q: qAplicada || undefined,
        })
            .then((obtenida) => {
                if (activo) {
                    setDatos(obtenida);
                    setError(null);
                }
            })
            .catch((err: unknown) => {
                if (activo) setError(getFriendlyErrorMessage(err));
            })
            .finally(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
    }, [pagina, estadoFiltro, qAplicada, version]);

    function aplicarBusqueda(evento: FormEvent) {
        evento.preventDefault();
        setCargando(true);
        setPagina(0);
        setQAplicada(busqueda.trim());
    }

    function cambiarFiltroEstado(valor: string) {
        setCargando(true);
        setPagina(0);
        setEstadoFiltro(valor as OrderStatus | "");
    }

    function irPagina(nueva: number) {
        setCargando(true);
        setPagina(nueva);
    }

    const filtrando = qAplicada !== "" || estadoFiltro !== "";

    return (
        <>
            <div className="flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                    Pedidos
                </p>
                <h1 className="text-2xl font-medium uppercase tracking-widest">
                    Gestión de pedidos
                </h1>
                <p className="text-sm font-light text-neutral-700">
                    Filtra por estado o busca por número de pedido y cliente. En el detalle
                    cambias el estado, registras el seguimiento y ves las devoluciones.
                </p>
            </div>

            {error && (
                <div
                    role="alert"
                    className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs flex flex-wrap items-center gap-4"
                >
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            setCargando(true);
                            setVersion((v) => v + 1);
                        }}
                        className="border border-red-300 text-red-700 hover:bg-red-100 text-[10px] uppercase tracking-widest px-3 py-1.5 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* ── Filtros: mandan query params, el servidor decide (R1.2/R1.3) ── */}
            <div className="flex flex-wrap items-end gap-4">
                <form onSubmit={aplicarBusqueda} className="flex flex-col gap-1.5">
                    <label
                        htmlFor="buscar-pedido"
                        className="text-[10px] uppercase tracking-widest text-neutral-600"
                    >
                        Buscar pedido
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="buscar-pedido"
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Nº de pedido o cliente"
                            className="w-64 border border-neutral-200 px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                        />
                        <button
                            type="submit"
                            className="border border-neutral-900 px-4 py-1.5 text-[10px] uppercase tracking-widest hover:bg-neutral-900 hover:text-white transition-colors"
                        >
                            Buscar
                        </button>
                    </div>
                </form>

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="filtro-estado"
                        className="text-[10px] uppercase tracking-widest text-neutral-600"
                    >
                        Estado
                    </label>
                    <select
                        id="filtro-estado"
                        value={estadoFiltro}
                        onChange={(e) => cambiarFiltroEstado(e.target.value)}
                        className="border border-neutral-200 px-3 py-1.5 text-sm text-neutral-900 bg-white focus:outline-none focus:border-neutral-400"
                    >
                        <option value="">Todos</option>
                        {ESTADOS.map((estado) => (
                            <option key={estado} value={estado}>
                                {ETIQUETAS[estado]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {cargando && !datos && (
                <p
                    role="status"
                    className="text-xs uppercase tracking-widest text-neutral-500 py-12 text-center"
                >
                    Cargando pedidos...
                </p>
            )}

            {!cargando && !error && datos && datos.orders.length === 0 && (
                <div className="border border-neutral-200 bg-white p-6">
                    <p className="text-sm font-light text-neutral-700">
                        {filtrando
                            ? "Ningún pedido coincide con los filtros. Prueba con otro término o limpia la búsqueda."
                            : "Todavía no hay pedidos. Cuando un cliente complete su compra aparecerá aquí."}
                    </p>
                </div>
            )}

            {!error && datos && datos.orders.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-neutral-900 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Nº de pedido
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Fecha
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Cliente
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Mercado
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Total
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Estado
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Piezas
                                </th>
                                <th scope="col" className="py-2 font-medium">
                                    Devolución
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {datos.orders.map((pedido) => (
                                <tr key={pedido.orderNumber} className="border-b border-neutral-200">
                                    <td className="py-3 pr-4">
                                        <Link
                                            href={`/admin/orders/${pedido.orderNumber}`}
                                            className="font-mono text-xs text-neutral-900 underline-offset-2 hover:underline"
                                        >
                                            {pedido.orderNumber}
                                        </Link>
                                    </td>
                                    <td className="py-3 pr-4 text-xs text-neutral-700">
                                        {fechaCorta(pedido.createdAt)}
                                    </td>
                                    <td className="py-3 pr-4 text-xs text-neutral-700">
                                        {pedido.userEmail ?? "—"}
                                    </td>
                                    <td className="py-3 pr-4 text-xs text-neutral-700">
                                        {pedido.marketCode}
                                    </td>
                                    <td className="py-3 pr-4 text-xs text-neutral-900">
                                        {pedido.totalAmount.toFixed(2)} {pedido.currency}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <OrderStatusBadge status={pedido.status} />
                                    </td>
                                    <td className="py-3 pr-4 text-xs text-neutral-700">
                                        {pedido.itemCount}
                                    </td>
                                    <td className="py-3 text-xs">
                                        {pedido.returnRequested && (
                                            <span className="inline-block border border-neutral-900 px-2 py-0.5 text-[10px] uppercase tracking-widest text-neutral-900">
                                                Solicitada
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!error && datos && datos.totalElements > 0 && (
                <nav
                    aria-label="Paginación de pedidos"
                    className="flex items-center justify-between text-[10px] uppercase tracking-widest"
                >
                    <button
                        type="button"
                        onClick={() => irPagina(pagina - 1)}
                        disabled={pagina === 0}
                        className="border border-neutral-900 px-4 py-2 transition-colors hover:bg-neutral-900 hover:text-white disabled:border-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                    >
                        Anterior
                    </button>
                    <span className="text-neutral-600" aria-live="polite">
                        Página {datos.page + 1} de {Math.max(datos.totalPages, 1)}
                    </span>
                    <button
                        type="button"
                        onClick={() => irPagina(pagina + 1)}
                        disabled={pagina >= datos.totalPages - 1}
                        className="border border-neutral-900 px-4 py-2 transition-colors hover:bg-neutral-900 hover:text-white disabled:border-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                    >
                        Siguiente
                    </button>
                </nav>
            )}
        </>
    );
}
