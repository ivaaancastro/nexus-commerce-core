"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BackLink from "@/components/BackLink";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import Toast from "@/components/Toast";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage, isNotFoundError } from "@/lib/errors";
import { AdminOrderDetail, OrderStatus, PAYMENT_METHOD_LABELS } from "@/types/commerce";

const ETIQUETAS: Record<OrderStatus, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
};

/**
 * Espejo TS de la máquina de transiciones (spec R3.1, plan D3). Sólo decide
 * qué botones se pintan: la autoridad es el servidor, que devuelve
 * `409 ORDER_CONFLICT` si el espejo y la BD divergen.
 */
const TRANSICIONES: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
};

/** Copy de cada acción; `confirmar` protege la destrucción (E.4). */
const ACCIONES: Record<OrderStatus, { texto: string; confirmar?: string }> = {
    PENDING: { texto: "Marcar pendiente" },
    CONFIRMED: { texto: "Marcar confirmado" },
    SHIPPED: { texto: "Marcar enviado" },
    DELIVERED: { texto: "Marcar entregado" },
    CANCELLED: {
        texto: "Cancelar pedido",
        confirmar:
            "¿Cancelar este pedido? Se liberará la reserva de stock y no se puede deshacer.",
    },
};

/** Espejo del `@Size(max = 64)` del backend (R5.4). */
const MAX_TRACKING = 64;

function fechaLarga(valor: string): string {
    return new Date(valor).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

/**
 * Detalle de un pedido en el panel (Tarea 7.4, spec specs/admin-orders/ R2–R5).
 *
 * - El servidor devuelve el **mismo `OrderResponse` que ve el cliente**
 *   compuesto con `userEmail` y `returnRequested` (R2.1): una sola forma.
 * - El panel de estado sólo pinta las transiciones permitidas (R3.2) y el
 *   éxito se aplica con **la propia respuesta del `PUT`** — sin re-fetch (E.4).
 * - Tracking full-replace en cualquier estado (R5.2); el flag de devolución es
 *   informativo: el backoffice de devoluciones queda fuera de alcance.
 */
export default function AdminOrderDetailPage() {
    const params = useParams();
    const orderNumber = params?.orderNumber
        ? decodeURIComponent(params.orderNumber as string)
        : "";

    const [detalle, setDetalle] = useState<AdminOrderDetail | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [noExiste, setNoExiste] = useState(false);
    // Recarga bajo demanda (botón «Reintentar»); mismo patrón del resto del panel.
    const [version, setVersion] = useState(0);

    // Estado del panel
    const [cambiando, setCambiando] = useState(false);
    const [estadoError, setEstadoError] = useState<string | null>(null);

    // ── Tracking ────────────────────────────────────────────────────────────
    // Estado derivado **durante el render** (react.dev, «Adjusting state when a
    // prop changes»), igual que hace `Toast`: los inputs toman los valores
    // guardados cuando el servidor cambia el seguimiento (carga inicial o un
    // `PUT /tracking` con respuesta). Escrito en el cuerpo del efecto caería en
    // react-hooks/set-state-in-effect.
    const [detalleSincronizado, setDetalleSincronizado] =
        useState<AdminOrderDetail | null>(null);
    const [carrier, setCarrier] = useState("");
    const [trackingNumber, setTrackingNumber] = useState("");
    const [guardandoTracking, setGuardandoTracking] = useState(false);
    const [trackingError, setTrackingError] = useState<string | null>(null);

    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);

    if (detalle !== detalleSincronizado) {
        // Sólo se reinician los inputs si cambió el **seguimiento guardado**:
        // una respuesta de cambio de estado (o cualquier otra) no toca lo que
        // el admin está escribiendo. Así, si el `PUT /tracking` encadenado al
        // enviar falla (R5.7), los inputs siguen sucios y el botón permite
        // reintentar **sólo** el tracking.
        const trackingCambio =
            (detalle?.order.carrier ?? "") !== (detalleSincronizado?.order.carrier ?? "") ||
            (detalle?.order.trackingNumber ?? "") !==
                (detalleSincronizado?.order.trackingNumber ?? "");
        setDetalleSincronizado(detalle);
        if (trackingCambio) {
            setCarrier(detalle?.order.carrier ?? "");
            setTrackingNumber(detalle?.order.trackingNumber ?? "");
        }
    }

    useEffect(() => {
        let activo = true;
        api.getAdminOrder(orderNumber)
            .then((obtenido) => {
                if (activo) {
                    setDetalle(obtenido);
                    setError(null);
                    setNoExiste(false);
                }
            })
            .catch((err: unknown) => {
                if (!activo) return;
                if (isNotFoundError(err)) {
                    setNoExiste(true);
                } else {
                    setError(getFriendlyErrorMessage(err));
                }
            })
            .finally(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
    }, [orderNumber, version]);

    async function cambiarEstado(destino: OrderStatus) {
        const accion = ACCIONES[destino];
        if (accion.confirmar && !window.confirm(accion.confirmar)) return;

        setCambiando(true);
        setEstadoError(null);
        try {
            // El 200 devuelve el detalle ya actualizado: el panel se refresca
            // con esa respuesta y sin re-fetch (E.4).
            const actualizada = await api.updateAdminOrderStatus(orderNumber, {
                status: destino,
            });
            setDetalle(actualizada);
            setToastMessage("Estado actualizado");
            setToastVisible(true);

            // R5.7 / D8: el envío encadena `PUT /status` → `PUT /tracking`
            // si hay campos de seguimiento pendientes (informados y distintos
            // de lo guardado). El estado YA quedó aplicado: si el segundo PUT
            // falla, el error se pinta bajo el bloque de tracking y sólo se
            // reintenta éste — el botón sigue habilitado porque los inputs
            // siguen sucios frente a la respuesta del primer `PUT`.
            const pendiente =
                (carrier.trim() !== "" || trackingNumber.trim() !== "") &&
                (carrier.trim() !== (actualizada.order.carrier ?? "") ||
                    trackingNumber.trim() !== (actualizada.order.trackingNumber ?? ""));
            if (destino === "SHIPPED" && pendiente) {
                setTrackingError(null);
                try {
                    const conTracking = await api.updateAdminOrderTracking(orderNumber, {
                        carrier,
                        trackingNumber,
                    });
                    setDetalle(conTracking);
                } catch (err: unknown) {
                    setTrackingError(getFriendlyErrorMessage(err));
                }
            }
        } catch (err: unknown) {
            // 409 ORDER_CONFLICT (máquina), 409 STOCK_CONFLICT (envío sin
            // existencias), 400 o 404: todo traducido a mensaje amigable.
            setEstadoError(getFriendlyErrorMessage(err));
        } finally {
            setCambiando(false);
        }
    }

    async function guardarTracking() {
        if (!detalle) return;
        setGuardandoTracking(true);
        setTrackingError(null);
        try {
            // Full-replace: vacío = limpiar (R5.2). El backend recorta.
            const actualizada = await api.updateAdminOrderTracking(orderNumber, {
                carrier,
                trackingNumber,
            });
            setDetalle(actualizada);
            setToastMessage("Seguimiento guardado");
            setToastVisible(true);
        } catch (err: unknown) {
            setTrackingError(getFriendlyErrorMessage(err));
        } finally {
            setGuardandoTracking(false);
        }
    }

    // ── Estados de carga y error (E.6) ──────────────────────────────────────

    if (cargando && !detalle && !noExiste) {
        return (
            <p
                role="status"
                className="text-xs uppercase tracking-widest text-neutral-500 py-12 text-center"
            >
                Cargando pedido...
            </p>
        );
    }

    if (noExiste) {
        return (
            <div className="border border-neutral-200 bg-white p-8 flex flex-col gap-4 items-start">
                <p className="text-sm font-light text-neutral-700">
                    No existe el pedido <span className="font-mono">{orderNumber}</span>.
                </p>
                <Link
                    href="/admin/orders"
                    className="text-[10px] uppercase tracking-widest border border-neutral-900 px-4 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
                >
                    Volver a pedidos
                </Link>
            </div>
        );
    }

    if (error && !detalle) {
        return (
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
        );
    }

    if (!detalle) return null;

    const { order, userEmail, returnRequested } = detalle;
    const permitidas = TRANSICIONES[order.status];
    const sinTrackingActual = (order.carrier ?? "") === "" && (order.trackingNumber ?? "") === "";
    const trackingSucio =
        carrier.trim() !== (order.carrier ?? "") ||
        trackingNumber.trim() !== (order.trackingNumber ?? "");

    return (
        <>
            <BackLink href="/admin/orders" label="Todos los pedidos" />

            {/* ── Cabecera: identidad, cliente, envío y pago (E.3) ─────────── */}
            <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-2">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                            Detalle del pedido
                        </p>
                        <h1 className="font-mono text-xl text-neutral-900">{order.orderNumber}</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <OrderStatusBadge status={order.status} />
                        {returnRequested && (
                            <span
                                data-testid="return-requested-badge"
                                className="border border-neutral-900 px-3 py-1 text-[10px] uppercase tracking-widest text-neutral-900"
                            >
                                Devolución solicitada
                            </span>
                        )}
                    </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                            Cliente
                        </dt>
                        <dd className="mt-1 text-xs text-neutral-900">{userEmail ?? "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                            Fecha
                        </dt>
                        <dd className="mt-1 text-xs text-neutral-900">
                            {fechaLarga(order.createdAt)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                            Mercado
                        </dt>
                        <dd className="mt-1 text-xs text-neutral-900">
                            {order.marketCode} · {order.currency}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                            Pago
                        </dt>
                        <dd className="mt-1 text-xs text-neutral-900">
                            {order.paymentMethod
                                ? PAYMENT_METHOD_LABELS[order.paymentMethod]
                                : "—"}
                        </dd>
                    </div>
                    <div className="sm:col-span-2">
                        <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                            Dirección de envío
                        </dt>
                        {/* Tolerante a nulls pre-V10: sin dato no se pinta la sección. */}
                        <dd className="mt-1 text-xs text-neutral-900">
                            {order.shippingAddress
                                ? `${order.shippingAddress.fullName} · ${order.shippingAddress.street}, ${order.shippingAddress.postalCode} ${order.shippingAddress.city} (${order.shippingAddress.countryCode})`
                                : "—"}
                        </dd>
                    </div>
                </dl>
            </div>

            {/* ── Estado (E.4): sólo transiciones permitidas ───────────────── */}
            <section
                aria-labelledby="titulo-estado"
                className="border border-neutral-200 bg-white p-6 flex flex-col gap-4"
            >
                <h2
                    id="titulo-estado"
                    className="text-[11px] uppercase tracking-widest text-neutral-600"
                >
                    Estado del pedido · {ETIQUETAS[order.status]}
                </h2>

                {permitidas.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                        {permitidas.map((destino) => (
                            <button
                                key={destino}
                                type="button"
                                onClick={() => cambiarEstado(destino)}
                                disabled={cambiando}
                                className={
                                    destino === "CANCELLED"
                                        ? "border border-neutral-400 text-neutral-700 hover:border-neutral-900 text-[10px] uppercase tracking-widest px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        : "border border-neutral-900 bg-neutral-900 text-white text-[10px] uppercase tracking-widest px-4 py-2 transition-colors hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                                }
                            >
                                {ACCIONES[destino].texto}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs font-light text-neutral-600">
                        Estado final: este pedido no admite más cambios.
                    </p>
                )}

                {estadoError && (
                    <p role="alert" className="text-xs text-red-700">
                        {estadoError}
                    </p>
                )}
            </section>

            {/* ── Seguimiento (E.5): full-replace en cualquier estado ──────── */}
            <section
                aria-labelledby="titulo-seguimiento"
                className="border border-neutral-200 bg-white p-6 flex flex-col gap-4"
            >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2
                        id="titulo-seguimiento"
                        className="text-[11px] uppercase tracking-widest text-neutral-600"
                    >
                        Transportista · Nº de seguimiento
                    </h2>
                    {sinTrackingActual && (
                        <p className="text-[11px] font-light text-neutral-500">
                            Sin seguimiento registrado.
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="carrier"
                            className="text-[10px] uppercase tracking-widest text-neutral-600"
                        >
                            Transportista
                        </label>
                        <input
                            id="carrier"
                            type="text"
                            maxLength={MAX_TRACKING}
                            value={carrier}
                            onChange={(e) => setCarrier(e.target.value)}
                            placeholder="SEUR, Correos..."
                            className="w-56 border border-neutral-200 px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="tracking-number"
                            className="text-[10px] uppercase tracking-widest text-neutral-600"
                        >
                            Nº de seguimiento
                        </label>
                        <input
                            id="tracking-number"
                            type="text"
                            maxLength={MAX_TRACKING}
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="Referencia del transportista"
                            className="w-64 border border-neutral-200 px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={guardarTracking}
                        disabled={!trackingSucio || guardandoTracking}
                        className="border border-neutral-900 bg-neutral-900 text-white text-[10px] uppercase tracking-widest px-4 py-2 transition-colors hover:bg-black disabled:border-neutral-200 disabled:bg-white disabled:text-neutral-400 disabled:cursor-not-allowed"
                    >
                        {guardandoTracking ? "Guardando..." : "Guardar seguimiento"}
                    </button>
                </div>

                <p className="text-[11px] font-light text-neutral-500">
                    Dejar los campos vacíos borra el seguimiento. El comprador lo ve en su
                    ficha de pedido.
                </p>

                {trackingError && (
                    <p role="alert" className="text-xs text-red-700">
                        {trackingError}
                    </p>
                )}
            </section>

            {/* ── Líneas con desglose fiscal y totales (E.3) ───────────────── */}
            <section
                aria-labelledby="titulo-resumen"
                className="border border-neutral-200 bg-white p-6 flex flex-col gap-4"
            >
                <h2
                    id="titulo-resumen"
                    className="text-[11px] uppercase tracking-widest text-neutral-600"
                >
                    Resumen del pedido
                </h2>

                <ul className="flex flex-col divide-y divide-neutral-200">
                    {order.items.map((item) => (
                        <li key={item.id} className="py-3 flex flex-col gap-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-xs font-medium text-neutral-900">
                                    {item.productName} · {item.size} · {item.color}
                                </span>
                                <span className="text-xs text-neutral-900">
                                    {item.totalAmount.toFixed(2)} {order.currency}
                                </span>
                            </div>
                            <p className="text-[11px] text-neutral-500">
                                {item.quantity} × {item.unitPrice.toFixed(2)} · Impuestos{" "}
                                {item.taxRate.toFixed(0)}% ({item.taxAmount.toFixed(2)}) · almacén{" "}
                                {item.warehouseCode}
                            </p>
                        </li>
                    ))}
                </ul>

                <dl className="border-t border-neutral-900 pt-3 flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between text-neutral-700">
                        <dt>Subtotal</dt>
                        <dd>{order.subtotalAmount.toFixed(2)} {order.currency}</dd>
                    </div>
                    <div className="flex justify-between text-neutral-700">
                        <dt>Impuestos</dt>
                        <dd>{order.taxAmount.toFixed(2)} {order.currency}</dd>
                    </div>
                    <div className="flex justify-between font-medium text-neutral-900">
                        <dt>Total</dt>
                        <dd>{order.totalAmount.toFixed(2)} {order.currency}</dd>
                    </div>
                </dl>
            </section>

            <Toast
                message={toastMessage}
                isVisible={toastVisible}
                onClose={() => setToastVisible(false)}
            />
        </>
    );
}
