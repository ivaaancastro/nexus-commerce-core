"use client";

import { type FormEvent, useEffect, useState } from "react";
import Toast from "@/components/Toast";
import AdminCouponForm from "@/components/admin/AdminCouponForm";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { AdminCouponDetailResponse, AdminCouponPageResponse, CouponType } from "@/types/commerce";

/** Importe según la moneda de su propia fila — el catálogo es multimercado. */
function importe(valor: number): string {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        currencyDisplay: "narrowSymbol",
    }).format(valor);
}

function valorCupon(cupon: AdminCouponDetailResponse): string {
    return cupon.type === "PERCENTAGE" ? `${cupon.value} %` : importe(cupon.value);
}

function rangoVigencia(cupon: AdminCouponDetailResponse): string {
    const desde = cupon.validFrom ? new Date(cupon.validFrom).toLocaleDateString("es-ES") : "—";
    const hasta = cupon.validUntil ? new Date(cupon.validUntil).toLocaleDateString("es-ES") : "—";
    return `${desde} → ${hasta}`;
}

/**
 * Listado y gestión de cupones del panel (V5, spec §2.4).
 *
 * Patrones del panel (7.3–7.5): búsqueda y filtros **en servidor** (nunca un
 * `filter()` en cliente), `window.confirm` sólo en lo destructivo, éxito con
 * **toast + fila actualizada con la respuesta**, y `409 CUPÓN_CON_USOS` del
 * DELETE bajo la fila sin toast (el servidor manda).
 */
export default function AdminCouponsPage() {
    const [datos, setDatos] = useState<AdminCouponPageResponse | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros: lo que se teclea vs. lo que ya mandó al servidor (botón/Enter).
    const [codeBusqueda, setCodeBusqueda] = useState("");
    const [codeAplicado, setCodeAplicado] = useState("");
    const [typeFiltro, setTypeFiltro] = useState<"" | CouponType>("");
    const [activeFiltro, setActiveFiltro] = useState<"" | "true" | "false">("");
    const [pagina, setPagina] = useState(0);

    // Recarga bajo demanda («Reintentar», tras crear/borrar).
    const [version, setVersion] = useState(0);

    // Formularios: crear plegado; editar = cupón seleccionado.
    const [mostrarCrear, setMostrarCrear] = useState(false);
    const [editando, setEditando] = useState<AdminCouponDetailResponse | null>(null);

    // Borrado en curso y error 409 por fila.
    const [borrandoId, setBorrandoId] = useState<number | null>(null);
    const [filaError, setFilaError] = useState<{ id: number; mensaje: string } | null>(null);

    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);

    useEffect(() => {
        let activo = true;
        api.getAdminCoupons(
            pagina,
            20,
            codeAplicado || undefined,
            typeFiltro || undefined,
            activeFiltro === "" ? undefined : activeFiltro === "true"
        )
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
    }, [pagina, codeAplicado, typeFiltro, activeFiltro, version]);

    function aplicarBusqueda(evento: FormEvent) {
        evento.preventDefault();
        setCargando(true);
        setPagina(0);
        setCodeAplicado(codeBusqueda.trim().toUpperCase());
    }

    function cambiarFiltro(cambio: () => void) {
        setCargando(true);
        setPagina(0);
        cambio();
    }

    async function borrar(cupon: AdminCouponDetailResponse) {
        if (!window.confirm(`¿Borrar el cupón ${cupon.code}?`)) return;

        setBorrandoId(cupon.id);
        setFilaError(null);
        try {
            await api.deleteAdminCoupon(cupon.id);
            setToastMessage(`Cupón ${cupon.code} borrado`);
            setToastVisible(true);
            setVersion((v) => v + 1);
        } catch (err: unknown) {
            // 409 (ya usado): mensaje del servidor bajo la fila, sin toast.
            setFilaError({ id: cupon.id, mensaje: getFriendlyErrorMessage(err) });
        } finally {
            setBorrandoId(null);
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-medium uppercase tracking-widest text-neutral-900">
                    Cupones
                </h1>
                <button
                    type="button"
                    onClick={() => {
                        setMostrarCrear((v) => !v);
                        setEditando(null);
                    }}
                    className="bg-neutral-900 text-white px-4 py-2 text-[11px] uppercase tracking-widest hover:bg-black"
                    aria-expanded={mostrarCrear}
                >
                    {mostrarCrear ? "Cerrar" : "Nuevo cupón"}
                </button>
            </div>

            {mostrarCrear && (
                <section aria-label="Crear cupón" className="border border-neutral-200 p-6 max-w-2xl">
                    <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-900 mb-4">
                        Crear cupón
                    </h2>
                    <AdminCouponForm
                        onCuponGuardado={() => {
                            setMostrarCrear(false);
                            setVersion((v) => v + 1);
                        }}
                    />
                </section>
            )}

            {editando && (
                <section aria-label="Editar cupón" className="border border-neutral-200 p-6 max-w-2xl">
                    <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-900 mb-4">
                        Editar {editando.code}
                    </h2>
                    <AdminCouponForm
                        cupon={editando}
                        onCuponGuardado={(guardado) => {
                            setEditando(guardado);
                            setToastMessage("Cambios guardados");
                            setToastVisible(true);
                            setVersion((v) => v + 1);
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className="mt-4 text-[11px] uppercase tracking-widest text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
                    >
                        Cerrar edición
                    </button>
                </section>
            )}

            {/* Filtros en servidor (patrón /admin/users: nada de filter() en cliente) */}
            <form onSubmit={aplicarBusqueda} className="flex flex-wrap items-end gap-4">
                <div>
                    <label
                        htmlFor="cupones-busqueda"
                        className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                    >
                        Código
                    </label>
                    <input
                        id="cupones-busqueda"
                        type="search"
                        value={codeBusqueda}
                        onChange={(e) => setCodeBusqueda(e.target.value)}
                        placeholder="SAVE10"
                        className="border border-neutral-200 px-3 py-2 text-sm text-neutral-900 w-48"
                    />
                </div>
                <div>
                    <label
                        htmlFor="cupones-tipo"
                        className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                    >
                        Tipo
                    </label>
                    <select
                        id="cupones-tipo"
                        value={typeFiltro}
                        onChange={(e) => cambiarFiltro(() => setTypeFiltro(e.target.value as CouponType | ""))}
                        className="border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
                    >
                        <option value="">Todos</option>
                        <option value="PERCENTAGE">Porcentaje</option>
                        <option value="FIXED">Importe fijo</option>
                    </select>
                </div>
                <div>
                    <label
                        htmlFor="cupones-estado"
                        className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1"
                    >
                        Estado
                    </label>
                    <select
                        id="cupones-estado"
                        value={activeFiltro}
                        onChange={(e) =>
                            cambiarFiltro(() => setActiveFiltro(e.target.value as "" | "true" | "false"))
                        }
                        className="border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
                    >
                        <option value="">Todos</option>
                        <option value="true">Activos</option>
                        <option value="false">Inactivos</option>
                    </select>
                </div>
                <button
                    type="submit"
                    className="border border-neutral-900 px-4 py-2 text-[11px] uppercase tracking-widest text-neutral-900 hover:bg-neutral-900 hover:text-white"
                >
                    Filtrar
                </button>
            </form>

            {cargando && !datos && <p className="text-sm text-neutral-600">Cargando cupones...</p>}

            {error && (
                <div className="border border-neutral-300 p-4">
                    <p className="text-sm text-neutral-700 mb-3">{error}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setCargando(true);
                            setError(null);
                            setVersion((v) => v + 1);
                        }}
                        className="text-[11px] uppercase tracking-widest underline underline-offset-4"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {datos && datos.coupons.length === 0 && !error && (
                <p className="text-sm text-neutral-600">
                    {codeAplicado || typeFiltro || activeFiltro
                        ? "Ningún cupón coincide con los filtros."
                        : "Aún no hay cupones. Crea el primero con «Nuevo cupón»."}
                </p>
            )}

            {datos && datos.coupons.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-300 text-[11px] uppercase tracking-wider text-neutral-500">
                                <th scope="col" className="text-left py-2 pr-4">Código</th>
                                <th scope="col" className="text-left py-2 pr-4">Tipo</th>
                                <th scope="col" className="text-left py-2 pr-4">Valor</th>
                                <th scope="col" className="text-left py-2 pr-4">Vigencia</th>
                                <th scope="col" className="text-left py-2 pr-4">Usos</th>
                                <th scope="col" className="text-left py-2 pr-4">Estado</th>
                                <th scope="col" className="text-left py-2 pr-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datos.coupons.map((cupon) => (
                                <tr key={cupon.id} className="border-b border-neutral-100 align-top">
                                    <td className="py-3 pr-4 font-medium text-neutral-900">{cupon.code}</td>
                                    <td className="py-3 pr-4 text-neutral-700">
                                        {cupon.type === "PERCENTAGE" ? "Porcentaje" : "Fijo"}
                                    </td>
                                    <td className="py-3 pr-4 text-neutral-700">{valorCupon(cupon)}</td>
                                    <td className="py-3 pr-4 text-neutral-700 whitespace-nowrap">
                                        {rangoVigencia(cupon)}
                                    </td>
                                    <td className="py-3 pr-4 text-neutral-700">
                                        {cupon.usageCount}
                                        {(cupon.usageLimit ?? 0) > 0 ? ` / ${cupon.usageLimit}` : ""}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <span
                                            className={
                                                cupon.active
                                                    ? "text-neutral-900"
                                                    : "text-neutral-500 line-through"
                                            }
                                        >
                                            {cupon.active ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4">
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditando(cupon);
                                                    setMostrarCrear(false);
                                                }}
                                                className="text-[11px] uppercase tracking-widest underline underline-offset-4 text-neutral-700 hover:text-neutral-900"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => borrar(cupon)}
                                                disabled={borrandoId === cupon.id}
                                                className="text-[11px] uppercase tracking-widest underline underline-offset-4 text-neutral-700 hover:text-neutral-900 disabled:opacity-50"
                                            >
                                                {borrandoId === cupon.id ? "Borrando..." : "Borrar"}
                                            </button>
                                        </div>
                                        {filaError?.id === cupon.id && (
                                            <p role="alert" className="mt-2 text-xs text-red-700">
                                                {filaError.mensaje}
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {datos && datos.totalPages > 1 && (
                <nav className="flex items-center gap-4" aria-label="Paginación">
                    <button
                        type="button"
                        onClick={() => setPagina((p) => p - 1)}
                        disabled={pagina === 0}
                        className="text-[11px] uppercase tracking-widest underline underline-offset-4 disabled:no-underline disabled:text-neutral-400"
                    >
                        Anterior
                    </button>
                    <span className="text-xs text-neutral-600">
                        Página {datos.page + 1} de {datos.totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPagina((p) => p + 1)}
                        disabled={pagina >= datos.totalPages - 1}
                        className="text-[11px] uppercase tracking-widest underline underline-offset-4 disabled:no-underline disabled:text-neutral-400"
                    >
                        Siguiente
                    </button>
                </nav>
            )}

            <Toast message={toastMessage} isVisible={toastVisible} onClose={() => setToastVisible(false)} />
        </div>
    );
}
