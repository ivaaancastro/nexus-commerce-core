package com.nexus.commerce.dto;

import com.nexus.commerce.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Resumen de un pedido para el historial.
 * No incluye las líneas: se calcula el número de artículos en servidor
 * para evitar cargar colecciones que la lista no necesita.
 */
public record OrderSummaryResponse(
        Long id,
        String orderNumber,
        OrderStatus status,
        String currency,
        BigDecimal totalAmount,
        Instant createdAt,
        int itemCount
) {}
