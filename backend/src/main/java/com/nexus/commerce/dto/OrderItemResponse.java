package com.nexus.commerce.dto;

import java.math.BigDecimal;

/**
 * @param returnEligible          {@code true} solo si la línea cumple R1 (30 días),
 *                                R2 (pedido {@code DELIVERED}) y R3 (sin devolución previa).
 * @param returnIneligibleReason  {@code NOT_DELIVERED}, {@code EXPIRED} o
 *                                {@code ALREADY_RETURNED}; {@code null} si es devolvible.
 */
public record OrderItemResponse(
        Long id,
        Long skuId,
        String skuCode,
        String warehouseCode,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal taxRate,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        Boolean returnEligible,
        String returnIneligibleReason
) {}
