package com.nexus.commerce.service;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Conversión de importes a unidades menores de Stripe (Fase 9, D7). Nunca
 * {@code double}; sólo monedas de <strong>2 decimales</strong> — las de los 4 mercados (ES/EUR, UK/GBP, US/USD, CH/CHF) — con otra el
 * cálculo fallaría en voz alta en lugar de cobrar un importe equivocado.
 */
public final class StripeAmounts {

    static final Set<String> MONEDAS_SOPORTADAS = Set.of("EUR", "GBP", "USD", "CHF");

    private StripeAmounts() {
    }

    public static long toMinor(BigDecimal amount, String currency) {
        if (currency == null || !MONEDAS_SOPORTADAS.contains(currency.toUpperCase())) {
            throw new IllegalArgumentException("Moneda no soportada para el pago online: " + currency);
        }
        return amount.movePointRight(2).longValueExact();
    }

    public static BigDecimal fromMinor(long minor) {
        return BigDecimal.valueOf(minor, 2);
    }
}
