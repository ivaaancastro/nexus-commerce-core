package com.nexus.commerce.dto;

import java.math.BigDecimal;

/**
 * Mercado disponible para el selector de divisa (Tarea 3.2, R1).
 *
 * <p>Es la única fuente de verdad de la lista que pinta el frontend: si mañana
 * se da de alta un mercado en la tabla {@code markets}, aparece en el selector
 * sin tocar una sola línea de TypeScript. La entidad JPA nunca sale al exterior
 * (regla 6 de AGENTS.md).</p>
 *
 * @param code    código ISO del mercado, p. ej. {@code "ES"}
 * @param name    nombre legible, p. ej. {@code "España"}
 * @param currency divisa, p. ej. {@code "EUR"}
 * @param taxRate tipo impositivo del mercado, p. ej. {@code 21.00}
 */
public record MarketResponse(
        String code,
        String name,
        String currency,
        BigDecimal taxRate
) {}
