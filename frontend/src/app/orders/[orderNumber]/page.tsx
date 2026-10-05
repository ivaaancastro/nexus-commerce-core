"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { useAuth } from "@/context/AuthContext";
import { Order, OrderItem, ProductReturn, ReturnIneligibleReason } from "@/types/commerce";
import { useParams } from "next/navigation";

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

/**
 * Página de confirmación de pedido.
 * Muestra el resumen del pedido, su desglose fiscal y —si hay sesión— la
 * posibilidad de solicitar la devolución de cada línea (Tarea 5.4).
 */
export default function OrderConfirmationPage() {
    const params = useParams();
    const orderNumber = params?.orderNumber
        ? decodeURIComponent(params.orderNumber as string)
        : "";

    const { isAuthenticated } = useAuth();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        async function loadOrder() {
            try {
                setLoading(true);
                const data = await api.getOrder(orderNumber);
                setOrder(data);
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

    // Solo con sesión: sin token el backend responde 401 y la página de
    // confirmación sigue teniendo que ser consultable.
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
                <div className="flex-1 flex items-center justify-center text-xs uppercase tracking-widest text-neutral-400">
                    Cargando confirmación...
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <p className="text-sm uppercase tracking-wider text-neutral-600 mb-4">
                        Pedido no encontrado
                    </p>
                    <Link
                        href="/"
                        className="text-xs uppercase tracking-widest underline"
                    >
                        Volver a la colección
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
                <div className="bg-white border border-neutral-200 p-8">
                    <div className="text-center mb-8">
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400 block mb-2">
                            Pedido Confirmado
                        </span>
                        <h1 className="text-2xl font-light uppercase tracking-wide text-neutral-900 mb-2">
                            Gracias por tu compra
                        </h1>
                        <p className="text-xs text-neutral-600">
                            Número de pedido: <span className="font-mono">{order.orderNumber}</span>
                        </p>
                    </div>

                    <div className="border-t border-neutral-100 pt-6 mb-6">
                        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-900 mb-4">
                            Resumen del pedido
                        </h2>
                        <div className="space-y-3">
                            {order.items.map((item) => (
                                <div key={item.id} className="flex justify-between text-xs">
                                    <span className="text-neutral-600">
                                        {item.skuCode} × {item.quantity}
                                    </span>
                                    <span className="text-neutral-900">
                                        {item.totalAmount.toFixed(2)} {order.currency}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-neutral-100 pt-6 space-y-2">
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

                    {isAuthenticated && (
                        <section
                            className="border-t border-neutral-100 pt-6 mt-6"
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

                    <div className="mt-8 text-center">
                        <p className="text-xs text-neutral-600 mb-4">
                            Hemos enviado la confirmación a tu correo electrónico.
                        </p>
                        <Link
                            href={`/receipt/${encodeURIComponent(order.orderNumber)}`}
                            className="inline-block bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 px-8 transition-colors"
                        >
                            Ver recibo
                        </Link>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Link
                        href="/"
                        className="text-xs uppercase tracking-wider text-neutral-600 hover:text-black underline transition-colors"
                    >
                        Volver a la colección
                    </Link>
                </div>
            </main>

            <Toast message={toastMessage} isVisible={toastVisible} onClose={closeToast} />
        </div>
    );
}
