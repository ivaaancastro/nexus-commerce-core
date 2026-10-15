package com.nexus.commerce.dto;

import com.nexus.commerce.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Fila del listado de pedidos del panel (Tarea 7.4, R1). Equivalente admin de
 * {@link OrderSummaryResponse}: en vez de las líneas para pintar la tarjeta
 * trae lo que la tabla del panel necesita — cliente, mercado y tracking.
 *
 * @param userEmail        email del comprador; {@code null} si el pedido no tiene
 *                         usuario ({@code user_id} es nullable desde V7)
 * @param itemCount        nº de líneas del pedido (la tabla no pinta los productos)
 * @param carrier          transportista registrado; {@code null} si nadie lo hizo
 * @param trackingNumber   nº de seguimiento; mismo criterio que {@code carrier}
 * @param returnRequested  {@code true} si alguna línea tiene devolución solicitada
 *                         (una consulta por página, patrón 5.5 R10)
 */
public record AdminOrderSummaryResponse(
        Long id,
        String orderNumber,
        OrderStatus status,
        String marketCode,
        String currency,
        BigDecimal totalAmount,
        Instant createdAt,
        String userEmail,
        int itemCount,
        String carrier,
        String trackingNumber,
        boolean returnRequested
) {}
