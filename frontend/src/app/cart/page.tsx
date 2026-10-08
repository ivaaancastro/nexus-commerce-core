"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackLink from "@/components/BackLink";
import Header from "@/components/Header";
import CartItemRow from "@/components/CartItemRow";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useMarket } from "@/context/MarketContext";
import { api } from "@/lib/api";
import { JUST_CHECKED_OUT_KEY } from "@/lib/checkout";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { Address } from "@/types/auth";
import {
    PAYMENT_METHODS,
    PAYMENT_METHOD_LABELS,
    PaymentMethod,
} from "@/types/commerce";

/**
 * Página completa del carrito con checkout multilínea.
 * Accesible desde el drawer lateral con botón "Ver carrito completo".
 *
 * Desde la Tarea 5.5 el checkout exige elegir **dirección de envío** (R1) y
 * **método de pago** (R2): la primera se copia a la orden como snapshot, el
 * segundo se guarda como dato declarado — no procesa ningún pago.
 */
export default function CartPage() {
    const {
        items,
        subtotal,
        taxEstimate,
        currency,
        totalItems,
        clearCart,
        isRepricing,
        hasUnavailableItems,
    } = useCart();
    const { isAuthenticated } = useAuth();
    const { market } = useMarket();
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsAuth, setNeedsAuth] = useState(false);

    const [addresses, setAddresses] = useState<Address[]>([]);
    const [addressId, setAddressId] = useState<number | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");

    const selectedAddress = addresses.find((a) => a.id === addressId) ?? null;

    // Las direcciones solo se pueden pedir con sesión; sin ella ya se corta en
    // handleCheckout, así que no tiene sentido emitir una petición que daría 401.
    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        api.getAddresses()
            .then((list) => {
                setAddresses(list);
                // Preseleccionada: la que marca defaultAddress, o en su defecto la primera.
                const preferred = list.find((a) => a.defaultAddress) ?? list[0];
                setAddressId(preferred ? preferred.id : null);
            })
            .catch((err: unknown) => setError(getFriendlyErrorMessage(err)));
    }, [isAuthenticated]);

    const handleCheckout = async () => {
        setError(null);
        setNeedsAuth(false);

        // /api/v1/orders/** exige sesión en el backend: si no la hay, ni se
        // emite la petición (R2 de specs/checkout-auth).
        if (!isAuthenticated) {
            setNeedsAuth(true);
            return;
        }

        // R1: sin dirección no hay snapshot que guardar, y R2 exige método de pago.
        // El botón ya viene deshabilitado, pero se comprueba igualmente por si se
        // llega aquí por teclado.
        if (!selectedAddress) {
            setError("Selecciona una dirección de envío para continuar");
            return;
        }

        // R5/R6: sin precio en este mercado el servidor respondería 400
        // «Precio no configurado para el SKU …». El botón ya viene
        // deshabilitado, pero se vuelve a comprobar por si se llega por teclado.
        if (hasUnavailableItems) {
            setError("Hay artículos sin precio en este mercado. Retíralos o vuelve al mercado anterior.");
            return;
        }
        if (isRepricing) {
            setError("Actualizando los precios al mercado elegido. Inténtalo en un momento.");
            return;
        }

        setIsProcessing(true);

        try {
            const idempotencyKey = crypto.randomUUID();

            const order = await api.checkout(
                {
                    marketCode: market.code,
                    items: items.map((item) => ({
                        skuId: item.skuId,
                        warehouseCode: "AUTO",
                        quantity: item.quantity,
                    })),
                    // País derivado de la dirección elegida en vez del "ES" fijo.
                    destinationCountryCode: selectedAddress.countryCode,
                    // Sin geocodificación en el proyecto no hay coordenadas reales
                    // por dirección; se mantienen las de siempre para no cambiar
                    // cómo se elige almacén (limitación anotada en tasks.md).
                    destinationLatitude: 40.4168,
                    destinationLongitude: -3.7038,
                    addressId: selectedAddress.id,
                    paymentMethod,
                },
                idempotencyKey
            );

            // §5.7: la ficha muestra «Gracias por tu compra» solo si viene de aquí,
            // para que un pedido de hace 20 días no dé las gracias.
            sessionStorage.setItem(JUST_CHECKED_OUT_KEY, order.orderNumber);

            clearCart();
            router.push(`/orders/${encodeURIComponent(order.orderNumber)}`);
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? getFriendlyErrorMessage(err)
                    : "Error al procesar el checkout"
            );
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
            <Header />

            <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
                <div className="mb-8">
                    <BackLink href="/" />
                    <h1 className="mt-4 text-lg font-medium uppercase tracking-wider text-neutral-900">
                        Tu Bolsa ({totalItems} {totalItems === 1 ? "artículo" : "artículos"})
                    </h1>
                </div>

                {items.length === 0 ? (
                    <div className="bg-white border border-neutral-200 p-12 text-center">
                        <p className="text-sm uppercase tracking-wider text-neutral-500 mb-6">
                            Tu bolsa está vacía
                        </p>
                        <Link
                            href="/"
                            className="inline-block bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-3 px-8 transition-colors"
                        >
                            Volver a la colección
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Lista de items */}
                        <div className="lg:col-span-2">
                            <div className="bg-white border border-neutral-200 p-6">
                                {items.map((item) => (
                                    <CartItemRow
                                        key={`${item.skuId}-${item.size}`}
                                        item={item}
                                    />
                                ))}

                                <div className="mt-6 pt-4 border-t border-neutral-100">
                                    <button
                                        onClick={clearCart}
                                        className="text-xs uppercase tracking-wider text-neutral-500 hover:text-black underline transition-colors"
                                    >
                                        Vaciar bolsa
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Resumen */}
                        <div className="lg:col-span-1">
                            <div className="bg-white border border-neutral-200 p-6 sticky top-24">
                                <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-900 mb-4">
                                    Resumen
                                </h2>

                                <div className="space-y-3 text-xs uppercase tracking-wider">
                                    <div className="flex justify-between">
                                        <span className="text-neutral-600">Subtotal</span>
                                        <span className="font-medium text-neutral-900">
                                            {subtotal.toFixed(2)} {currency}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-600">Impuestos estimados</span>
                                        <span className="text-neutral-900">
                                            {taxEstimate.toFixed(2)} {currency}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-3 border-t border-neutral-100">
                                        <span className="font-medium text-neutral-900">Total estimado</span>
                                        <span className="font-medium text-neutral-900">
                                            {(subtotal + taxEstimate).toFixed(2)} {currency}
                                        </span>
                                    </div>
                                </div>

                                {/* ── Dirección de envío (Tarea 5.5, R1) ─────────────── */}
                                <div className="mt-6 pt-4 border-t border-neutral-100">
                                    <label
                                        htmlFor="checkout-address"
                                        className="block text-xs uppercase tracking-widest text-neutral-900 mb-2"
                                    >
                                        Dirección de envío
                                    </label>

                                    {isAuthenticated && addresses.length === 0 ? (
                                        <div className="p-3 bg-neutral-100 border border-neutral-300">
                                            <p className="text-xs text-neutral-700 mb-2">
                                                Añade una dirección para poder tramitar el pedido.
                                            </p>
                                            <Link
                                                href="/addresses"
                                                className="text-xs uppercase tracking-widest text-neutral-900 underline"
                                            >
                                                Añadir dirección
                                            </Link>
                                        </div>
                                    ) : (
                                        <select
                                            id="checkout-address"
                                            value={addressId ?? ""}
                                            onChange={(e) => setAddressId(Number(e.target.value))}
                                            disabled={!isAuthenticated}
                                            className="w-full border border-neutral-300 bg-white px-3 py-3 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100"
                                        >
                                            {addresses.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.street} · {a.postalCode} {a.city} ({a.countryCode})
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    <p className="text-[10px] text-neutral-600 mt-2 leading-relaxed">
                                        Se guardará en el pedido tal y como está ahora.
                                    </p>
                                </div>

                                {/* ── Método de pago (Tarea 5.5, R2) ─────────────────── */}
                                <fieldset className="mt-6 pt-4 border-t border-neutral-100">
                                    <legend className="text-xs uppercase tracking-widest text-neutral-900 mb-2">
                                        Método de pago
                                    </legend>

                                    <div className="grid grid-cols-2 gap-2">
                                        {PAYMENT_METHODS.map((method) => (
                                            <label
                                                key={method}
                                                className={`border px-3 py-2 text-xs uppercase tracking-wider cursor-pointer transition-colors ${
                                                    paymentMethod === method
                                                        ? "border-neutral-900 text-neutral-900"
                                                        : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value={method}
                                                    checked={paymentMethod === method}
                                                    onChange={() => setPaymentMethod(method)}
                                                    className="sr-only"
                                                />
                                                {PAYMENT_METHOD_LABELS[method]}
                                            </label>
                                        ))}
                                    </div>

                                    <p className="text-[10px] text-neutral-600 mt-2 leading-relaxed">
                                        Solo se guarda tu preferencia: no se pide ningún número
                                        de tarjeta ni se cobra nada.
                                    </p>
                                </fieldset>

                                {needsAuth && (
                                    <div className="mt-4 p-3 bg-neutral-100 border border-neutral-300 text-neutral-700 text-xs">
                                        <span className="uppercase tracking-wider">
                                            Inicia sesión para completar tu compra
                                        </span>
                                        <Link
                                            href="/login"
                                            className="block mt-2 font-medium uppercase tracking-widest text-neutral-900 underline"
                                        >
                                            Iniciar sesión
                                        </Link>
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                                        {error}
                                    </div>
                                )}

                                {hasUnavailableItems && (
                                    <div className="mt-4 p-3 bg-neutral-100 border border-neutral-300 text-xs text-neutral-700 leading-relaxed">
                                        Hay artículos sin precio en {market.name}. Retíralos o vuelve al
                                        mercado anterior para tramitar el pedido.
                                    </div>
                                )}

                                <button
                                    onClick={handleCheckout}
                                    disabled={
                                        isProcessing ||
                                        isRepricing ||
                                        hasUnavailableItems ||
                                        (isAuthenticated && !selectedAddress)
                                    }
                                    className="w-full bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest py-4 transition-colors disabled:opacity-40 disabled:hover:bg-neutral-900 mt-6"
                                >
                                    {isProcessing ? "Procesando..." : "Tramitar pedido"}
                                </button>

                                <p className="text-[10px] text-neutral-600 mt-4 leading-relaxed">
                                    Impuestos calculados al {market.taxRate}% (mercado {market.code}).
                                    El cálculo final se realizará en el checkout.
                                </p>

                                <Link
                                    href="/"
                                    className="block text-center mt-6 text-xs uppercase tracking-wider text-neutral-600 hover:text-black underline transition-colors"
                                >
                                    Seguir comprando
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
