package com.nexus.commerce.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Reembolso del panel (Fase 9, R4). {@code amount = null} → reembolsa todo lo
 * que queda por devolver; con valor, {@code 0 < amount ≤ resto} (el tope lo
 * comprueba el servicio, que conoce el resto).
 */
public record RefundRequest(
        @Positive(message = "El importe debe ser mayor que 0")
        @Digits(integer = 8, fraction = 2, message = "El importe admite como máximo 2 decimales")
        BigDecimal amount,

        @Size(max = 200, message = "El motivo admite como máximo 200 caracteres")
        String reason
) {}
