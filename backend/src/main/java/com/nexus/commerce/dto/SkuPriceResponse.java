package com.nexus.commerce.dto;

import java.math.BigDecimal;

/**
 * Precio de un SKU en un mercado para el panel (Tarea 7.3, R3).
 * {@code basePrice}, {@code discountPrice} e {@code isActive} van a
 * {@code null} cuando el SKU todavía no tiene fila para ese mercado —
 * la UI pinta los inputs vacíos y el primer guardado la crea (R3.1).
 */
public record SkuPriceResponse(
        String marketCode,
        String marketName,
        String currency,
        BigDecimal taxRate,
        BigDecimal basePrice,
        BigDecimal discountPrice,
        Boolean isActive
) {}
