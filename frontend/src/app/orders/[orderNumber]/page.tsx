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
import { useAuth } from "@/context/AuthContext";
import {
    Order,
    OrderItem,
    PAYMENT_METHOD_LABELS,
    ProductReturn,
    ReturnIneligibleReason,
} from "@/types/commerce";

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
                    className="w-full border border-neutral-200 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 outline-none resize-none"
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
                        className="mt-8 text-center text-xs uppercase tracking-widest text-neutral-400"
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

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
                {/* ── 1. Barra superior: volver + estados (R5, R10) ─────────── */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <BackLink href="/orders" label="Mis pedidos" />
                    <div className="flex flex-wrap items-center gap-3">
                        <OrderStatusBadge status={order.status} />
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
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-2">
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
                                <dt className="text-[10px] uppercase tracking-widest text-neutral-400">
                                    Fecha de compra
                                </dt>
                                <dd className="mt-1 text-xs text-neutral-900">
                                    {formatDate(order.createdAt)}
                                </dd>
                            </div>
                            {order.returnDeadline && (
                                <div>
                                    <dt className="text-[10px] uppercase tracking-widest text-neutral-400">
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
                                    <p className="text-[10px] leading-relaxed text-neutral-400 mt-2">
                                        Preferencia declarada al comprar: no se procesó ningún pago.
                                    </p>
                                </div>
                            )}
                        </div>
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
                                        <p className="text-[11px] text-neutral-400 mt-1">
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

                    {/* ── 7. Desglose fiscal (ya existente) ──────────────────── */}
                    <div className="border-t border-neutral-100 pt-6 mb-6 space-y-2">
                        <div className="flex justify-between text-xs uppercase tracking-wider">
                            <span className="text-neutral-600">Subtotal</span>
                            <span className="text-neutral-900">
                                {order.subtotalAmount.toFixed(2)} {order.currency}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs uppercase tracking-wider">
                            <span className="text-neutral-600">Impuestos</span>
                            <span className="text-neutral-900">
                                {order.taxAmount.toFixed(2)} {order.currency}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm uppercase tracking-wider pt-2 border-t border-neutral-100">
                            <span className="font-medium text-neutral-900">Total</span>
                            <span className="font-medium text-neutral-900">
                                {order.totalAmount.toFixed(2)} {order.currency}
                            </span>
                        </div>
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

                            <p className="mt-4 text-[10px] leading-relaxed text-neutral-400">
                                El reembolso queda registrado como crédito pendiente: este
                                establecimiento no procesa devoluciones de pago.
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
