"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useMarket } from "@/context/MarketContext";

const DEBOUNCE_MS = 500;
const MIN_CODE_LENGTH = 3;

/**
 * Input del cupón promocional en el carrito (V5, spec §2.4).
 *
 * El componente **no valida por su cuenta**: debounced (500 ms) llama a
 * `applyCoupon` del `CartContext`, que es quien habla con
 * `POST /api/v1/coupons/validate` (con auth y el subtotal real). Así el
 * importe del carrito y el código comparten una única fuente de verdad, y
 * «Validar al actualizar importe» de la spec queda cubierto por el propio
 * efecto del contexto.
 */
export const CouponInput: React.FC = () => {
    const { couponStatus, couponMessage, couponDiscount, applyCoupon, removeCoupon } = useCart();
    const { market } = useMarket();
    const [code, setCode] = useState("");

    // `applyCoupon` cambia de identidad cuando cambia `couponCode` del
    // contexto; depender de él re-dispararía el debounce en cada respuesta
    // del servidor (y un intento inválido que retira el código entraría en
    // bucle). La ref mantiene el último sin re-registrar el efecto.
    const applyCouponRef = useRef(applyCoupon);
    useEffect(() => {
        applyCouponRef.current = applyCoupon;
    }, [applyCoupon]);

    // Debounce 500 ms: al escribir, se aplica el código al contexto. Con <3
    // caracteres no se dispara (criterio de aceptación de la spec).
    useEffect(() => {
        const trimmed = code.trim();
        if (trimmed.length < MIN_CODE_LENGTH) {
            return;
        }

        const timer = setTimeout(() => {
            applyCouponRef.current(trimmed);
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [code]);

    return (
        <div className="space-y-2">
            <label htmlFor="coupon-code" className="text-xs uppercase tracking-widest text-neutral-600">
                Cupón promocional
            </label>
            <input
                id="coupon-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código de cupón..."
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                aria-label="Código de cupón"
                inputMode="text"
                autoComplete="off"
            />

            {couponStatus === "validating" && (
                <p className="text-xs text-neutral-600" role="status">
                    Validando...
                </p>
            )}

            {couponStatus === "valid" && couponMessage && (
                <p className="text-xs text-neutral-900" role="status">
                    {couponMessage}
                    {couponDiscount > 0 &&
                        ` · −${new Intl.NumberFormat("es-ES", {
                            style: "currency",
                            currency: market.currency,
                            currencyDisplay: "narrowSymbol",
                        }).format(couponDiscount)}`}
                </p>
            )}

            {couponStatus === "invalid" && couponMessage && (
                <p className="text-xs text-neutral-600" role="status">
                    {couponMessage}
                </p>
            )}

            {couponStatus === "valid" && (
                <button
                    type="button"
                    onClick={() => {
                        removeCoupon();
                        setCode("");
                    }}
                    className="text-xs uppercase tracking-widest text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
                >
                    Quitar cupón
                </button>
            )}
        </div>
    );
};
