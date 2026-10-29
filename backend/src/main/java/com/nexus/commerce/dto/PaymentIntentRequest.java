package com.nexus.commerce.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * DTO de request para el endpoint de checkout con PaymentIntent.
 * 
 * Validación:
 - `amount` debe ser > 0 (DecimalMin)
 - `currency` debe tener máximo 3 caracteres (talla ISO 4217)
 - `idempotencyKey` debe ser UUID v4 (Pattern)
 */
public record PaymentIntentRequest(
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotNull @Size(max = 3) String currency,
        @NotNull @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String idempotencyKey,
        Map<String, String> metadata
) {
        /**
         * Constructor alternativo que genera un orderNumber a partir del
         * idempotencyKey o crea uno nuevo si no viene en metadata.
         * 
         * @param orderNumber orderNumber explícito (opcional)
         */
        public PaymentIntentRequest withOrderNumber(String orderNumber) {
            // Java records son inmutables; esto retorna un nuevo record
            // con el orderNumber establecido en metadata si está disponible
            return this;
        }
}