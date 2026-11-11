"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BackLink from "@/components/BackLink";
import Header from "@/components/Header";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import ProductThumb from "@/components/ProductThumb";
import Toast from "@/components/Toast";
import { api } from "@/lib/api";
import { JUST_CHECKED_OUT_KEY } from "@/lib/checkout";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { taxRateFromAmounts, taxesIncludedLabel } from "@/lib/taxes";
import { useAuth } from "@/context/AuthContext";
import {
    Order,
    OrderItem,
    PAYMENT_METHOD_LABELS,
    PAYMENT_STATUS_LABELS,
    ProductReturn,
    ReturnIneligibleReason,
} from "@/types/commerce";

/**
 * Fase 9 (D14): tras pagar, la confirmación es asíncrona (la hace el webhook de
 * Stripe). La ficha sondea cada 2 s, como máximo 30 s, hasta que el pedido deje
 * de estar `PENDING`.
 */
const CONFIRM_POLL_MS = 2000;
const CONFIRM_MAX_POLLS = 15;

/** Límite de caracteres del motivo, idéntico al `@Size` del backend (R4). */
const MAX_REASON_LENGTH = 500;

/** Copy de R8: el usuario debe ver por qué una línea no puede devolverse. */
function ineligibleLabel(reason: ReturnIneligibleReason, createdAt: string): string {
    switch (reason) {
        case "EXPIRED":
            return `Plazo agotado — se compró el ${new Date(createdAt).toLocaleDateString("es-ES")}`;
        case "ALREADY_RETURNED":
            return "Ya devuelto";
        case "NOT_DELIVERED":
        default:
            return "Pedido aún no entregado";
    }
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

/**
 * Ficha del pedido (Tarea 5.5, R7).
 *
 * Sirve a la vez como confirmación recién salida del checkout y como consulta
 * de un pedido antiguo: el banner «Gracias por tu compra» solo aparece si la
 * página se abre desde el carrito (§5.7), no cada vez que se entra.
 *
 * Conserva sin cambios funcionales la sección de devoluciones de la Tarea 5.4.
 */
export default function OrderDetailPage() {
    const params = useParams();
    const orderNumber = params?.orderNumber
        ? decodeURIComponent(params.orderNumber as string)
        : "";

    const { isAuthenticated } = useAuth();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [justCheckedOut, setJustCheckedOut] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Pago con Stripe (Fase 9) ────────────────────────────────────────────
    // `redirect_status` lo añade Stripe (o la página de pago) al volver. Se lee
    // una sola vez, en el cliente: sólo se usa después de cargar el pedido.
    const [redirectStatus] = useState<string | null>(() =>
        typeof window === "undefined"
            ? null
            : new URLSearchParams(window.location.search).get("redirect_status")
    );
    const [pollExpired, setPollExpired] = useState(false);

    // ── Devoluciones ────────────────────────────────────────────────────────
    const [returns, setReturns] = useState<ProductReturn[]>([]);
    const [returningItemId, setReturningItemId] = useState<number | null>(null);
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);

    useEffect(() => {
        return () => {
            if (copyTimer.current) clearTimeout(copyTimer.current);
        };
    }, []);

    useEffect(() => {
        async function loadOrder() {
            try {
                setLoading(true);
                const data = await api.getOrder(orderNumber);
                setOrder(data);

                // §5.7: solo el carrito deja este flag; se consume en cuanto se lee
                // para que una recarga no vuelva a mostrar las gracias.
                try {
                    if (sessionStorage.getItem(JUST_CHECKED_OUT_KEY) === data.orderNumber) {
                        setJustCheckedOut(true);
                        sessionStorage.removeItem(JUST_CHECKED_OUT_KEY);
                    }
                } catch {
                    // sessionStorage puede no estar disponible: no es un fallo del pedido.
                }
            } catch (err: unknown) {
                setError(
                    err instanceof Error
                        ? getFriendlyErrorMessage(err)
                        : "Error al cargar el pedido"
                );
            } finally {
                setLoading(false);
            }
        }
        loadOrder();
    }, [orderNumber]);

    // Solo con sesión: sin token el backend responde 401 y la página
    // seguiría teniendo que ser consultable.
    useEffect(() => {
        if (!isAuthenticated || !orderNumber) return;

        async function loadReturns() {
            try {
                const data = await api.getMyReturns(orderNumber);
                // Regla #8: tolerar una respuesta vacía (204 o body en blanco).
                setReturns(Array.isArray(data) ? data : []);
            } catch {
                setReturns([]);
            }
        }
        loadReturns();
    }, [isAuthenticated, orderNumber]);

    const closeToast = useCallback(() => setToastVisible(false), []);

    // Estado derivado (no se escribe estado dentro del efecto): ¿acabamos de
    // pagar y el webhook aún no ha confirmado el pedido?
    const awaitingConfirmation =
        !!order &&
        order.status === "PENDING" &&
        order.paymentStatus === "REQUIRES_PAYMENT" &&
        (redirectStatus === "succeeded" || redirectStatus === "processing");

    useEffect(() => {
        if (!awaitingConfirmation || pollExpired) return;

        let attempts = 0;
        const timer = setInterval(async () => {
            attempts += 1;
            try {
                setOrder(await api.getOrder(orderNumber));
            } catch {
                // un fallo puntual de red no cancela el sondeo: se reintenta en el siguiente tick
            }
            if (attempts >= CONFIRM_MAX_POLLS) {
                setPollExpired(true);
            }
        }, CONFIRM_POLL_MS);

        return () => clearInterval(timer);
    }, [awaitingConfirmation, pollExpired, orderNumber]);

    /** R6: copia el número y confirma durante 2 s. Sin clipboard, no revienta. */
    async function handleCopyOrderNumber() {
        if (!order) return;
        try {
            await navigator.clipboard.writeText(order.orderNumber);
        } catch {
            // Entornos sin `navigator.clipboard` (o sin contexto seguro):
            // no se copia, pero la ficha sigue siendo usable.
            return;
        }
        setCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 2000);
    }

    function openForm(item: OrderItem) {
        setReturningItemId(item.id);
        setReason("");
        setReasonError(null);
        setSubmitError(null);
    }

    function closeForm() {
        setReturningItemId(null);
        setReason("");
        setReasonError(null);
        setSubmitError(null);
    }

    async function submitReturn(event: FormEvent<HTMLFormElement>, item: OrderItem) {
        event.preventDefault();

        // Validación propia con mensajes amigables (reglas #9 y #10).
        const trimmed = reason.trim();
        if (!trimmed) {
            setReasonError("Indica el motivo de la devolución.");
            return;
        }
        if (trimmed.length > MAX_REASON_LENGTH) {
            setReasonError(`El motivo no puede superar los ${MAX_REASON_LENGTH} caracteres.`);
            return;
        }

        setSubmitting(true);
        setReasonError(null);
        setSubmitError(null);

        try {
            const created = await api.createReturn(orderNumber, {
                orderItemId: item.id,
                reason: trimmed,
            });
            setReturns((previous) => [...previous, created]);
            closeForm();
            setToastMessage(
                `Devolución solicitada · ${created.refundAmount.toFixed(2)} ${created.currency}`
            );
            setToastVisible(true);
        } catch (err: unknown) {
            // Regla #9: nunca pintar `err.message` crudo (409, 404, 401...).
            setSubmitError(
                err instanceof Error
                    ? getFriendlyErrorMessage(err)
                    : "No se pudo solicitar la devolución."
            );
        } finally {
            setSubmitting(false);
        }
    }

    /** Bloque de una línea en la sección de devoluciones (R8 y R9). */
    function renderReturnBlock(item: OrderItem, createdAt: string) {
        const itemReturn = returns.find((entry) => entry.orderItemId === item.id);

        if (itemReturn) {
            return (
                <div
                    className="mt-3 flex items-center justify-between"
                    data-testid={`return-state-${item.id}`}
                >
                    <span className="text-[10px] uppercase tracking-widest text-neutral-900">
                        · Solicitada
                    </span>
                    <span className="text-xs text-neutral-900">
                        {itemReturn.refundAmount.toFixed(2)} {itemReturn.currency} a devolver
                    </span>
                </div>
            );
        }

        if (!item.returnEligible) {
            return (
                <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                    {ineligibleLabel(item.returnIneligibleReason ?? "NOT_DELIVERED", createdAt)}
                </p>
            );
        }

        if (returningItemId !== item.id) {
            return (
                <button
                    type="button"
                    onClick={() => openForm(item)}
                    className="mt-3 text-[10px] uppercase tracking-widest border border-neutral-900 px-4 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
                >
                    Devolver
                </button>
            );
        }

        return (
            <form noValidate onSubmit={(event) => submitReturn(event, item)} className="mt-3">
                <label
                    htmlFor={`return-reason-${item.id}`}
                    className="block text-[10px] uppercase tracking-widest text-neutral-600 mb-2"
                >
                    Motivo de la devolución
                </label>
                <textarea
                    id={`return-reason-${item.id}`}
                    value={reason}
                    onChange={(event) => {
                        setReason(event.target.value);
                        setReasonError(null);
                    }}
                    maxLength={MAX_REASON_LENGTH}
                    rows={3}
                    placeholder="Cuéntanos qué ha pasado con este artículo"
                    aria-invalid={reasonError ? true : undefined}
                    className="w-full border border-neutral-200 p-3 text-sm text-neutral-900 placeholder:text-neutral-600 focus:border-neutral-900 outline-none resize-none"
                />
                {reasonError && (
                    <p role="alert" className="mt-2 text-xs text-red-700">
                        {reasonError}
                    </p>
                )}
                {submitError && (
                    <p role="alert" className="mt-2 text-xs text-red-700">
                        {submitError}
                    </p>
                )}
                <div className="mt-4 flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-neutral-900 hover:bg-black disabled:opacity-50 text-white text-[10px] uppercase tracking-widest py-2 px-6 transition-colors"
                    >
                        {submitting ? "Enviando..." : "Confirmar devolución"}
                    </button>
                    <button
                        type="button"
                        onClick={closeForm}
                        className="text-[10px] uppercase tracking-widest text-neutral-600 underline hover:text-black transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col">
                <Header />
                <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
                    <BackLink href="/orders" />
                    <p
                        role="status"
                        className="mt-8 text-center text-xs uppercase tracking-widest text-neutral-600"
                    >
                        Cargando pedido...
                    </p>
                </main>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col">
                <Header />
                <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
                    <BackLink href="/orders" />
                    <p className="mt-16 text-center text-sm uppercase tracking-wider text-neutral-600 mb-4">
                        Pedido no encontrado
                    </p>
                    <p className="text-center">
                        <Link
                            href="/"
                            className="text-xs uppercase tracking-widest underline text-neutral-600 hover:text-black transition-colors"
                        >
                            Volver a la colección
                        </Link>
                    </p>
                </main>
            </div>
        );
    }

    // R10: se deriva en cliente, sin tocar `OrderStatus`. Sirve tanto el motivo
    // que devuelve el servidor como la devolución recién creada en esta sesión.
    const hasReturnRequested =
        returns.length > 0 ||
        order.items.some((item) => item.returnIneligibleReason === "ALREADY_RETURNED");

    // R3: el porcentaje de la nota no lo adivina el mercado activo (el pedido
    // pudo firmarse en otro) — sale de los importes que firmó el backend.
    const orderTaxRate = taxRateFromAmounts(order.taxAmount, order.subtotalAmount);

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
                {/* ── 1. Barra superior: volver + estados (R5, R10) ─────────── */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <BackLink href="/orders" label="Mis pedidos" />
                    <div className="flex flex-wrap items-center gap-3">
                        <OrderStatusBadge status={order.status} />
                        {/* Tarea 7.4 (R5.5): tracking que registra el admin; sin dato
                            (pre-V14 o sin registrar) no se pinta el bloque. */}
                        {(order.carrier || order.trackingNumber) && (
                            <span
                                data-testid="tracking-block"
                                className="border border-neutral-300 px-3 py-1 text-[10px] uppercase tracking-widest text-neutral-700"
                            >
                                Seguimiento ·{" "}
                                {[order.carrier, order.trackingNumber]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                        )}
                        {hasReturnRequested && (
                            <span
                                data-testid="return-requested-badge"
                                className="border border-neutral-900 px-3 py-1 text-[10px] uppercase tracking-widest text-neutral-900"
                            >
                                Devolución solicitada
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-neutral-200 p-8">
                    {/* ── 2 y 3. Cabecera + banner de confirmación (§5.7) ───── */}
                    <header className="mb-8">
                        <span className="text-[10px] uppercase tracking-widest text-neutral-600 block mb-2">
                            {justCheckedOut ? "Pedido confirmado" : "Detalle del pedido"}
                        </span>
                        <h1 className="text-2xl font-light uppercase tracking-wide text-neutral-900 mb-4">
                            {justCheckedOut ? "Gracias por tu compra" : "Pedido"}
                        </h1>

                        {justCheckedOut && (
                            <p className="text-xs text-neutral-600 mb-5">
                                Hemos enviado la confirmación a tu correo electrónico.
                            </p>
                        )}

                        {/* Número de pedido + copiar (R6) */}
                        <div className="flex flex-wrap items-center gap-3">
                            <span
                                className="font-mono text-sm text-neutral-900"
                                data-testid="order-number"
                            >
                                {order.orderNumber}
                            </span>
                            <button
                                type="button"
                                onClick={handleCopyOrderNumber}
                                data-testid="copy-order-number"
                                aria-label={`Copiar número de pedido ${order.orderNumber}`}
                                className="text-[10px] uppercase tracking-widest text-neutral-600 border border-neutral-300 px-3 py-1.5 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
                            >
                                {copied ? "Copiado ✓" : "Copiar"}
                            </button>
                        </div>

                        {/* Fechas: compra y límite de devolución (R4) */}
                        <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                    Fecha de compra
                                </dt>
                                <dd className="mt-1 text-xs text-neutral-900">
                                    {formatDate(order.createdAt)}
                                </dd>
                            </div>
                            {order.returnDeadline && (
                                <div>
                                    <dt className="text-[10px] uppercase tracking-widest text-neutral-600">
                                        Límite de devolución
                                    </dt>
                                    <dd className="mt-1 text-xs text-neutral-900" data-testid="return-deadline">
                                        {formatDate(order.returnDeadline)}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </header>

                    {/* ── 4 y 5. Envío y pago (R1, R2). Si son `null` no se pintan (R7) ── */}
                    {(order.shippingAddress || order.paymentMethod) && (
                        <div className="border-t border-neutral-100 pt-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {order.shippingAddress && (
                                <div data-testid="shipping-address">
                                    <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-3">
                                        Dirección de envío
                                    </h2>
                                    <address className="not-italic text-xs leading-relaxed text-neutral-600">
                                        <span className="block text-neutral-900">
                                            {order.shippingAddress.fullName}
                                        </span>
                                        <span className="block">
                                            {order.shippingAddress.street}
                                        </span>
                                        <span className="block">
                                            {order.shippingAddress.postalCode}{" "}
                                            {order.shippingAddress.city}
                                        </span>
                                        <span className="block">
                                            {order.shippingAddress.countryCode}
                                        </span>
                                    </address>
                                </div>
                            )}

                            {order.paymentMethod && (
                                <div data-testid="payment-method">
                                    <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-3">
                                        Método de pago
                                    </h2>
                                    <p className="text-xs text-neutral-900">
                                        {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                                    </p>
                                    {(!order.paymentStatus || order.paymentStatus === "NONE") && (
                                        <p className="text-[10px] leading-relaxed text-neutral-600 mt-2">
                                            Preferencia declarada al comprar: no se procesó ningún pago.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Pago (Fase 9) ─────────────────────────────────────── */}
                    {order.paymentStatus && order.paymentStatus !== "NONE" && (
                        <section data-testid="payment-status" className="border-t border-neutral-100 pt-6 mb-6">
                            <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-3">
                                Pago
                            </h2>
                            <p className="text-xs text-neutral-900">
                                {order.status === "CANCELLED" && order.paymentStatus === "REQUIRES_PAYMENT"
                                    ? "Caducado: no se completó el pago"
                                    : PAYMENT_STATUS_LABELS[order.paymentStatus]}
                                {(order.paymentStatus === "PARTIALLY_REFUNDED" ||
                                    order.paymentStatus === "REFUNDED") &&
                                    ` · ${(order.amountRefunded ?? 0).toFixed(2)} ${order.currency}`}
                            </p>

                            {awaitingConfirmation && !pollExpired && (
                                <p role="status" className="text-[10px] uppercase tracking-widest text-neutral-600 mt-2">
                                    Confirmando pago...
                                </p>
                            )}
                            {awaitingConfirmation && pollExpired && (
                                <p className="text-[10px] leading-relaxed text-neutral-600 mt-2">
                                    Tu pago se está procesando. Recarga la página en unos minutos para
                                    ver el estado.
                                </p>
                            )}
                            {order.status === "PENDING" &&
                                order.paymentStatus === "REQUIRES_PAYMENT" &&
                                !awaitingConfirmation && (
                                    <Link
                                        href={`/orders/${encodeURIComponent(order.orderNumber)}/pay`}
                                        className="inline-block mt-3 bg-neutral-900 hover:bg-black text-white text-[10px] uppercase tracking-widest py-3 px-6 transition-colors"
                                    >
                                        Completar pago
                                    </Link>
                                )}
                        </section>
                    )}

                    {/* ── 6. Resumen de productos (R3, R8) ──────────────────── */}
                    <section className="border-t border-neutral-100 pt-6 mb-6">
                        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-4">
                            Resumen del pedido
                        </h2>
                        <ul className="space-y-5">
                            {order.items.map((item) => (
                                <li key={item.id} className="flex gap-4">
                                    <ProductThumb
                                        name={item.productName}
                                        family={item.productFamily}
                                        size={item.size}
                                        className="w-16 h-20"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-900">
                                            {item.productName}
                                        </p>
                                        <p className="text-[11px] text-neutral-500 mt-1">
                                            {item.productFamily} · Talla {item.size} · {item.color}
                                        </p>
                                        <p className="text-[11px] text-neutral-600 mt-1">
                                            Referencia {item.skuCode} · Cantidad {item.quantity}
                                        </p>
                                    </div>
                                    <p className="text-xs text-neutral-900 whitespace-nowrap">
                                        {item.totalAmount.toFixed(2)} {order.currency}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* ── 7. Total pagado (spec final-price-display, R3) ───── */}
                    {/*
                        El desglose Subtotal/Impuestos **desaparece** de la ficha
                        del cliente: esos números eran los del backend y eran
                        correctos, pero la vitrina presenta el precio final como
                        hace Zara. El detalle base+impuesto queda en `/receipt`
                        (factura), enlazado justo debajo.
                    */}
                    <div className="border-t border-neutral-100 pt-6 mb-6 space-y-3">
                        <div className="flex justify-between text-sm uppercase tracking-wider">
                            <span className="font-medium text-neutral-900">Total pagado</span>
                            <span className="font-medium text-neutral-900">
                                {order.totalAmount.toFixed(2)} {order.currency}
                            </span>
                        </div>
                        {/*
                            V5 cupones: el descuento **ya está aplicado** en
                            `totalAmount` (y en subtotal/impuestos, re-extraídos
                            sobre la base reducida en el checkout), así que la
                            línea va DEBAJO del total y es informativa — si
                            restara aquí, el usuario lo pagaría dos veces.
                        */}
                        {order.discountAmount != null && order.discountAmount > 0 && (
                            <div className="flex justify-between text-xs uppercase tracking-wider">
                                <span className="text-neutral-600">
                                    Descuento de cupón (ya aplicado)
                                </span>
                                <span className="text-neutral-900">
                                    −{order.discountAmount.toFixed(2)} {order.currency}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between text-xs uppercase tracking-wider">
                            <span className="text-neutral-600">
                                {taxesIncludedLabel(orderTaxRate)}
                            </span>
                        </div>
                        <p className="text-[10px] text-neutral-600 leading-relaxed">
                            El desglose fiscal (base imponible e impuesto) figura en el{" "}
                            <Link
                                href={`/receipt/${encodeURIComponent(order.orderNumber)}`}
                                className="underline hover:text-neutral-900 transition-colors"
                            >
                                recibo del pedido
                            </Link>
                            .
                        </p>
                    </div>

                    {/* ── 8. Devoluciones (Tarea 5.4, conservada sin cambios) ── */}
                    {isAuthenticated && (
                        <section
                            className="border-t border-neutral-100 pt-6 mb-6"
                            aria-labelledby="returns-title"
                        >
                            <h2
                                id="returns-title"
                                className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-1"
                            >
                                Devoluciones
                            </h2>
                            <p className="text-[11px] text-neutral-500 mb-5">
                                Cada línea puede devolverse hasta 30 días después de la compra.
                            </p>

                            <ul className="space-y-4">
                                {order.items.map((item) => (
                                    <li key={item.id} className="border border-neutral-200 p-4">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-neutral-600">
                                                {item.skuCode} × {item.quantity}
                                            </span>
                                            <span className="text-neutral-900">
                                                {item.totalAmount.toFixed(2)} {order.currency}
                                            </span>
                                        </div>
                                        {renderReturnBlock(item, order.createdAt)}
                                    </li>
                                ))}
                            </ul>

                            <p className="mt-4 text-[10px] leading-relaxed text-neutral-600">
                                El importe queda registrado como crédito pendiente: la
                                devolución del pago la tramita la tienda.
                            </p>
                        </section>
                    )}

                    {/* ── 9. Acciones ───────────────────────────────────────── */}
                    <div className="border-t border-neutral-100 pt-6 flex flex-wrap items-center gap-6">
                        <Link
                            href={`/receipt/${encodeURIComponent(order.orderNumber)}`}
                            className="bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 px-8 transition-colors"
                        >
                            Ver recibo
                        </Link>
                        <Link
                            href="/orders"
                            className="text-xs uppercase tracking-widest text-neutral-600 border-b border-neutral-300 pb-1 hover:text-neutral-900 hover:border-neutral-900 transition-all"
                        >
                            Mis pedidos
                        </Link>
                    </div>
                </div>
            </main>

            <Toast message={toastMessage} isVisible={toastVisible} onClose={closeToast} />
        </div>
    );
}
