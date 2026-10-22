/**
 * Copy e importes fiscales de la vitrina — spec `final-price-display` (D2/D3/R4).
 *
 * Los precios de `market_prices` **ya son finales con el impuesto incluido**
 * (contrato medido en `PricingService`: `netAmount = finalPrice / (1 + rate/100)`),
 * así que la vitrina **no desglosa**: pinta el precio grande y una nota. El
 * desglose base+impuesto vive en `/receipt` (factura) y en el panel admin.
 *
 * R4/D2: el texto es **«Impuestos incluidos (X %)» en todos los mercados** —
 * cada país lo llama distinto (impuesto indirecto del país, VAT en UK,
 * *sales tax* en US) y decir el nombre español en Londres sería mentira.
 * `TaxCopy.test.ts` (3.2/R8) además prohíbe esa cadena y el símbolo de divisa
 * fijo en `src/`; este módulo es la única fuente del copy y lo respeta.
 *
 * Todo lo de aquí es **presentación**: jamás viaja al backend ni entra en
 * cálculos de cobro (D3).
 */

/**
 * Parte del subtotal que ya lleva el impuesto **dentro** (D3).
 *
 * Es la inversa de `PricingService.netAmount()`: si el precio final es
 * `net × (1 + rate/100)`, entonces `net = final × 100/(100 + rate)` y la
 * parte de impuesto = `final − net = final × rate/(100 + rate)`.
 *
 * 79,95 al 21 % → **13,88** (la parte real; el viejo `taxEstimate` enseñaba
 * 16,79 porque sumaba el 21 % *encima* de un precio final que ya lo
 * incluía — doble imposición en pantalla).
 */
export function taxesIncludedAmount(subtotal: number, taxRate: number): number {
    if (!Number.isFinite(subtotal) || !Number.isFinite(taxRate) || taxRate <= 0) {
        return 0;
    }
    return (subtotal * taxRate) / (100 + taxRate);
}

/**
 * Porcentaje para el copy: **21**, no `21.000000000000004`.
 *
 * Redondea a 1 decimal y recorta los ceros sobrantes. Las tasas reales son
 * enteras (21, 20, 0), pero el dato llega de BD como `BigDecimal` y no se
 * fía de la coma flotante del cliente.
 */
export function formatTaxRate(taxRate: number): string {
    const rounded = Math.round(taxRate * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Nota única y repetida en PDP, carrito, drawer y pedido del cliente. */
export function taxesIncludedLabel(taxRate: number): string {
    return `Impuestos incluidos (${formatTaxRate(taxRate)} %)`;
}

/**
 * Tasa efectiva de un pedido **ya cobrado** (R3).
 *
 * El backend sólo devuelve importes (`subtotalAmount` **neto** + `taxAmount` +
 * `totalAmount`), sin el porcentaje, y la ficha del cliente no debe adivinarlo
 * con la tasa del mercado activo (el pedido pudo firmarse en otro). Sale de los
 * propios números: `net × (1 + r/100) − net = tax` → **`r = tax/net × 100`**.
 *
 * 13,88 sobre 66,07 → 21,007… → se pinta **21** (`formatTaxRate` recorta).
 */
export function taxRateFromAmounts(taxAmount: number, netSubtotal: number): number {
    if (
        !Number.isFinite(taxAmount) ||
        !Number.isFinite(netSubtotal) ||
        netSubtotal <= 0
    ) {
        return 0;
    }
    return (taxAmount / netSubtotal) * 100;
}
