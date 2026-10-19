"use client";

import { type FormEvent, useEffect, useState } from "react";
import Toast from "@/components/Toast";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { AdminUser, AdminUserPage } from "@/types/auth";

type Accion = "suspender" | "restaurar" | "promover" | "degradar";

const TOASTS: Record<Accion, string> = {
    suspender: "Cuenta suspendida",
    restaurar: "Cuenta restaurada",
    promover: "Rol actualizado",
    degradar: "Rol actualizado",
};

const ETIQUETAS_ROL: Record<AdminUser["role"], string> = {
    ADMIN: "Administrador",
    USER: "Usuario",
};

function fechaCorta(valor: string): string {
    return new Date(valor).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

/**
 * Listado de usuarios del panel (Tarea 7.5, spec specs/admin-users/ R6).
 *
 * - **La búsqueda vive en el servidor** (R6): el campo sólo cambia `q` y
 *   re-pide la página — nunca hay un `filter()` en cliente (misma regla que
 *   `/admin/orders`).
 * - Acciones por fila **sin selects ni modales**: confirm (`window.confirm`)
 *   sólo en lo destructivo — suspender y quitar administrador.
 * - Éxito → **toast + fila actualizada con la propia respuesta del `PUT`**,
 *   sin re-fetch (patrón 7.4). `409 USER_CONFLICT` → mensaje del servidor
 *   **bajo la fila y sin toast de éxito**, con la fila intacta (patrón 7.3/7.4).
 * - El servidor es la única autoridad: aquí sólo se pinta; las guardas de
 *   «último admin activo» y auto-suspensión las resuelve el backend (plan D4).
 */
export default function AdminUsersPage() {
    const [datos, setDatos] = useState<AdminUserPage | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // `busqueda` es lo que se teclea, `qAplicada` lo que ya mandó el servidor
    // (se confirma con el botón/Enter, no en cada tecla).
    const [busqueda, setBusqueda] = useState("");
    const [qAplicada, setQAplicada] = useState("");
    const [pagina, setPagina] = useState(0);

    // Recarga bajo demanda (botón «Reintentar»); mismo patrón del resto del panel.
    const [version, setVersion] = useState(0);

    // Acción en curso y error `409` por fila (uno a la vez, como la tabla).
    const [accionandoId, setAccionandoId] = useState<number | null>(null);
    const [filaError, setFilaError] = useState<{ id: number; mensaje: string } | null>(null);

    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);

    useEffect(() => {
        let activo = true;
        api.getAdminUsers({ page: pagina, q: qAplicada || undefined })
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
    }, [pagina, qAplicada, version]);

    function aplicarBusqueda(evento: FormEvent) {
        evento.preventDefault();
        setCargando(true);
        setPagina(0);
        setQAplicada(busqueda.trim());
    }

    function irPagina(nueva: number) {
        setCargando(true);
        setPagina(nueva);
    }

    /**
     * Aplica la acción de la fila. El `200` devuelve el usuario ya
     * actualizado: la fila se refresca con esa respuesta y sin re-fetch (E.2).
     * Cualquier fallo (409 USER_CONFLICT, 404, red) queda bajo la propia fila
     * sin toast y sin tocar el estado (E.3).
     */
    async function aplicarAccion(usuario: AdminUser, accion: Accion) {
        if (accion === "suspender" &&
            !window.confirm(`¿Suspender la cuenta de ${usuario.email}? No podrá iniciar sesión hasta que la restores.`)) {
            return;
        }
        if (accion === "degradar" &&
            !window.confirm(`¿Quitar el rol de administrador a ${usuario.email}?`)) {
            return;
        }

        setAccionandoId(usuario.id);
        setFilaError(null);
        try {
            const actualizado =
                accion === "suspender"
                    ? await api.setAdminUserSuspension(usuario.id, { suspended: true })
                    : accion === "restaurar"
                      ? await api.setAdminUserSuspension(usuario.id, { suspended: false })
                      : accion === "promover"
                        ? await api.updateAdminUserRole(usuario.id, { role: "ADMIN" })
                        : await api.updateAdminUserRole(usuario.id, { role: "USER" });

            setDatos((prev) =>
                prev
                    ? {
                          ...prev,
                          users: prev.users.map((u) => (u.id === actualizado.id ? actualizado : u)),
                      }
                    : prev
            );
            setToastMessage(TOASTS[accion]);
            setToastVisible(true);
        } catch (err: unknown) {
            setFilaError({ id: usuario.id, mensaje: getFriendlyErrorMessage(err) });
        } finally {
            setAccionandoId(null);
        }
    }

    const filtrando = qAplicada !== "";

    return (
        <>
            <div className="flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                    Usuarios
                </p>
                <h1 className="text-2xl font-medium uppercase tracking-widest">
                    Gestión de usuarios
                </h1>
                <p className="text-sm font-light text-neutral-700">
                    Busca cuentas, suspende o restaura accesos y cambia roles. Una cuenta
                    suspendida no puede iniciar sesión ni refrescar su sesión.
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

            {/* ── Búsqueda: manda q al servidor, nunca filter() en cliente (R6) ── */}
            <form onSubmit={aplicarBusqueda} className="flex flex-col gap-1.5 items-start">
                <label
                    htmlFor="buscar-usuario"
                    className="text-[10px] uppercase tracking-widest text-neutral-600"
                >
                    Buscar usuario
                </label>
                <div className="flex gap-2">
                    <input
                        id="buscar-usuario"
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Email o nombre"
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

            {cargando && !datos && (
                <p
                    role="status"
                    className="text-xs uppercase tracking-widest text-neutral-500 py-12 text-center"
                >
                    Cargando usuarios...
                </p>
            )}

            {!cargando && !error && datos && datos.users.length === 0 && (
                <div className="border border-neutral-200 bg-white p-6">
                    <p className="text-sm font-light text-neutral-700">
                        {filtrando
                            ? "Sin resultados. Prueba con otro término o limpia la búsqueda."
                            : "Todavía no hay usuarios registrados."}
                    </p>
                </div>
            )}

            {!error && datos && datos.users.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-neutral-900 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Email
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Nombre
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Rol
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Estado
                                </th>
                                <th scope="col" className="py-2 pr-4 font-medium">
                                    Alta
                                </th>
                                <th scope="col" className="py-2 font-medium">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {datos.users.map((usuario) => {
                                const enCurso = accionandoId === usuario.id;
                                const errorFila = filaError?.id === usuario.id
                                    ? filaError.mensaje
                                    : null;
                                return (
                                    <FilaUsuario
                                        key={usuario.id}
                                        usuario={usuario}
                                        enCurso={enCurso}
                                        errorFila={errorFila}
                                        onAccion={(accion) => aplicarAccion(usuario, accion)}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {!error && datos && datos.totalElements > 0 && (
                <nav
                    aria-label="Paginación de usuarios"
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

            <Toast
                message={toastMessage}
                isVisible={toastVisible}
                onClose={() => setToastVisible(false)}
            />
        </>
    );
}

/**
 * Una fila de la tabla con sus acciones condicionales y el hueco de error
 * `409` **bajo** la fila (patrón de la celda de 7.3 / el panel de 7.4: el
 * intento fallido no toca la fila ni dispara toast).
 */
function FilaUsuario({
    usuario,
    enCurso,
    errorFila,
    onAccion,
}: {
    usuario: AdminUser;
    enCurso: boolean;
    errorFila: string | null;
    onAccion: (accion: Accion) => void;
}) {
    const estado = usuario.suspended
        ? usuario.suspendedAt
            ? `Suspendido desde ${fechaCorta(usuario.suspendedAt)}`
            : "Suspendido"
        : "Activo";

    return (
        <>
            <tr className="border-b border-neutral-200">
                <td className="py-3 pr-4 text-xs text-neutral-900">{usuario.email}</td>
                <td className="py-3 pr-4 text-xs text-neutral-700">
                    {usuario.firstName} {usuario.lastName}
                </td>
                <td className="py-3 pr-4 text-xs text-neutral-700">
                    {ETIQUETAS_ROL[usuario.role]}
                </td>
                <td className="py-3 pr-4 text-xs">
                    {usuario.suspended ? (
                        <span className="text-red-700">{estado}</span>
                    ) : (
                        <span className="text-neutral-700">{estado}</span>
                    )}
                </td>
                <td className="py-3 pr-4 text-xs text-neutral-700">
                    {fechaCorta(usuario.createdAt)}
                </td>
                <td className="py-3 text-xs">
                    <div className="flex flex-wrap gap-2">
                        {usuario.suspended ? (
                            <button
                                type="button"
                                disabled={enCurso}
                                onClick={() => onAccion("restaurar")}
                                className="border border-neutral-900 px-3 py-1 text-[10px] uppercase tracking-widest hover:bg-neutral-900 hover:text-white transition-colors disabled:opacity-50"
                            >
                                Restaurar
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={enCurso}
                                onClick={() => onAccion("suspender")}
                                className="border border-red-700 text-red-700 px-3 py-1 text-[10px] uppercase tracking-widest hover:bg-red-700 hover:text-white transition-colors disabled:opacity-50"
                            >
                                Suspender
                            </button>
                        )}
                        {usuario.role === "USER" ? (
                            <button
                                type="button"
                                disabled={enCurso}
                                onClick={() => onAccion("promover")}
                                className="border border-neutral-900 px-3 py-1 text-[10px] uppercase tracking-widest hover:bg-neutral-900 hover:text-white transition-colors disabled:opacity-50"
                            >
                                Hacer administrador
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={enCurso}
                                onClick={() => onAccion("degradar")}
                                className="border border-neutral-400 text-neutral-600 px-3 py-1 text-[10px] uppercase tracking-widest hover:border-neutral-900 hover:text-neutral-900 transition-colors disabled:opacity-50"
                            >
                                Quitar administrador
                            </button>
                        )}
                    </div>
                </td>
            </tr>
            {errorFila && (
                <tr>
                    <td colSpan={6} className="pb-3 -mt-1">
                        <p role="alert" className="text-xs text-red-700">
                            {errorFila}
                        </p>
                    </td>
                </tr>
            )}
        </>
    );
}
