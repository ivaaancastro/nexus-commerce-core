"use client";

import { useMarket } from "@/context/MarketContext";

/**
 * Resumen del cupón aplicado en el carrito (V5, spec §2.4): código, importe
 * del descuento y botón quitar.
 *
 * `discountAmount` es **siempre un importe en dinero** — el backend lo
 * calcula con `calculateDiscount` aunque el cupón sea PERCENTAGE (el valor
 * porcentaje vive en `coupon.value`). El importe se formatea con
 * `Intl.NumberFormat` + `currencyDisplay: "narrowSymbol"` (decisión D13 de la
 * wishlist): un símbolo de divisa escrito a mano sobreviviría al cambio de
 * mercado (guardia `TaxCopy`).
 */
export const CouponSummary: React.FC<{
    couponCode?: string;
    discountAmount?: number;
    onRemove?: () => void;
}> = ({ couponCode, discountAmount, onRemove }) => {
    const { market } = useMarket();

    if (!couponCode) {
        return null;
    }

    const importe = (valor: number): string =>
        new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: market.currency,
            currencyDisplay: "narrowSymbol",
        }).format(valor);

    return (
        <div className="flex items-center justify-between border-l-2 border-neutral-900 p-3 bg-neutral-50">
            <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-neutral-900">{couponCode}</span>
                {discountAmount !== undefined && discountAmount > 0 && (
                    <span className="text-sm text-neutral-600">−{importe(discountAmount)}</span>
                )}
            </div>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-neutral-600 text-sm hover:text-neutral-900"
                    aria-label="Quitar cupón"
                >
                    ✕
                </button>
            )}
        </div>
    );
};
