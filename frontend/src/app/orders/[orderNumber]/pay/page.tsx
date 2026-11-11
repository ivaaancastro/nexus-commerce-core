"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import BackLink from "@/components/BackLink";
import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";
import { api } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import type { Order, PaymentSession } from "@/types/commerce";

/**
 * `loadStripe` se llama **una vez por clave publicable**: volver a llamarlo en
 * cada render crearía una instancia nueva y `Elements` avisaría del cambio.
 */
const stripeCache = new Map<string, Promise<Stripe | null>>();

function getStripe(publishableKey: string): Promise<Stripe | null> {
    let stripe = stripeCache.get(publishableKey);
    if (!stripe) {
        stripe = loadStripe(publishableKey);
        stripeCache.set(publishableKey, stripe);
    }
    return stripe;
}

/** Sin símbolos de moneda escritos a mano (`TaxCopy.test`): `Intl` con símbolo corto. */
function formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
    }).format(value);
}

interface CheckoutFormProps {
    orderNumber: string;
    totalLabel: string;
}

/**
 * Formulario del Payment Element. Tarjeta y Apple Pay (cuando el navegador, el
 * dominio verificado y la cuenta de Stripe lo permiten) salen del propio
 * elemento: la app no sabe ni guarda nada del medio de pago.
 *
 * Confirmar **no confirma el pedido**: sólo Stripe, por webhook, lo hace
 * (spec D2). Por eso al terminar se navega a la ficha, que sondea hasta
 * `CONFIRMED`.
 */
function CheckoutForm({ orderNumber, totalLabel }: CheckoutFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!stripe || !elements) {
            return;
        }
        setError(null);
        setProcessing(true);

        const result = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/orders/${encodeURIComponent(orderNumber)}`,
            },
            // Tarjeta sin 3DS no necesita salir de la página; con 3DS Stripe redirige solo.
            redirect: "if_required",
        });

        if (result.error) {
            // Sólo los errores de tarjeta y de validación traen un mensaje pensado para el
            // comprador («Tu tarjeta ha sido rechazada…»). Los demás (conexión, API, límites)
            // son técnicos: no se enseñan crudos.
            const paraElComprador =
                result.error.type === "card_error" || result.error.type === "validation_error";
            setError(
                paraElComprador && result.error.message
                    ? result.error.message
                    : "No se ha podido completar el pago. Inténtalo de nuevo."
            );
            setProcessing(false);
            return;
        }

        const status = result.paymentIntent?.status === "succeeded" ? "succeeded" : "processing";
        router.push(`/orders/${encodeURIComponent(orderNumber)}?redirect_status=${status}`);
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <PaymentElement />

            {error && (
                <div role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || !elements || processing}
                className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-4 transition-colors disabled:opacity-40 disabled:hover:bg-neutral-900 mt-6"
            >
                {processing ? "Procesando pago..." : `Pagar ${totalLabel}`}
            </button>

            <p className="text-[10px] text-neutral-600 mt-4 leading-relaxed">
                Pago seguro con Stripe en modo de pruebas: usa una tarjeta de test, no una real.
            </p>
        </form>
    );
}

function PayContent() {
    const params = useParams();
    const router = useRouter();
    const orderNumber = params?.orderNumber ? decodeURIComponent(params.orderNumber as string) : "";

    const [order, setOrder] = useState<Order | null>(null);
    const [session, setSession] = useState<PaymentSession | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderNumber) return;
        let cancelled = false;

        Promise.all([api.getOrder(orderNumber), api.getOrderPayment(orderNumber)])
            .then(([orderData, sessionData]) => {
                if (cancelled) return;
                setOrder(orderData);
                setSession(sessionData);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : "";
                // 409 = no hay pago pendiente (ya pagado, caducado o sin pasarela): la ficha lo explica.
                if (message.includes("API Error [409]")) {
                    router.replace(`/orders/${encodeURIComponent(orderNumber)}`);
                    return;
                }
                setError(getFriendlyErrorMessage(err));
            });

        return () => {
            cancelled = true;
        };
    }, [orderNumber, router]);

    const loading = !error && (!order || !session);

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-xl w-full mx-auto px-6 py-12">
                <BackLink href={`/orders/${encodeURIComponent(orderNumber)}`} />
                <h1 className="mt-4 text-lg font-medium uppercase tracking-wider text-neutral-900">
                    Pago del pedido
                </h1>

                {error && (
                    <div role="alert" className="mt-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                        {error}
                    </div>
                )}

                {loading && (
                    <p role="status" className="mt-6 text-xs uppercase tracking-widest text-neutral-600">
                        Preparando el pago...
                    </p>
                )}

                {order && session && (
                    <section className="mt-6 bg-white border border-neutral-200 p-6">
                        <div className="flex items-baseline justify-between border-b border-neutral-100 pb-4 mb-6">
                            <span className="text-xs uppercase tracking-widest text-neutral-600">
                                Pedido {order.orderNumber}
                            </span>
                            <span className="text-sm font-medium text-neutral-900">
                                {formatMoney(order.totalAmount, order.currency)}
                            </span>
                        </div>

                        <Elements
                            stripe={getStripe(session.publishableKey)}
                            options={{
                                clientSecret: session.clientSecret,
                                appearance: {
                                    theme: "flat",
                                    variables: {
                                        colorPrimary: "#171717",
                                        colorText: "#171717",
                                        borderRadius: "0px",
                                    },
                                },
                            }}
                        >
                            <CheckoutForm
                                orderNumber={order.orderNumber}
                                totalLabel={formatMoney(order.totalAmount, order.currency)}
                            />
                        </Elements>

                        <p className="text-[10px] text-neutral-600 mt-4 leading-relaxed">
                            Tu pedido se reserva durante 30 minutos. Si no se completa el pago, se
                            cancela y el stock vuelve a estar disponible.
                        </p>
                    </section>
                )}
            </main>
        </div>
    );
}

export default function PayPage() {
    return (
        <ProtectedRoute>
            <PayContent />
        </ProtectedRoute>
    );
}
