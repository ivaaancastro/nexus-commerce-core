package com.nexus.commerce.dto;

import java.math.BigDecimal;

/**
 * @param returnEligible          {@code true} solo si la línea cumple R1 (30 días),
 *                                R2 (pedido {@code DELIVERED}) y R3 (sin devolución previa).
 * @param returnIneligibleReason  {@code NOT_DELIVERED}, {@code EXPIRED} o
 *                                {@code ALREADY_RETURNED}; {@code null} si es devolvible.
 * @param productName             nombre del producto (Tarea 5.5, R3) — resuelto vía
 *                                {@code OrderItem → Sku → Product}, no un snapshot
 * @param productFamily           familia textil del producto
 * @param size                    talla de la variante
 * @param color                   color de la variante
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
        String returnIneligibleReason,
        String productName,
        String productFamily,
        String size,
        String color
) {}
