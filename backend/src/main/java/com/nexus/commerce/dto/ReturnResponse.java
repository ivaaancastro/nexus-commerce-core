package com.nexus.commerce.dto;

import com.nexus.commerce.entity.ReturnStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Devolución de una línea. {@code refundAmount} es un <b>registro contable</b>:
 * el proyecto no tiene pasarela de pago, así que no se mueve dinero real.
 */
public record ReturnResponse(
        Long id,
        Long orderItemId,
        String skuCode,
        ReturnStatus status,
        String reason,
        String currency,
        BigDecimal refundAmount,
        Instant requestedAt
) {}
