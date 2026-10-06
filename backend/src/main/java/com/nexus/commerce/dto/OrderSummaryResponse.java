package com.nexus.commerce.dto;

import com.nexus.commerce.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Resumen de un pedido para el historial.
 *
 * <p>Desde la Tarea 5.5 trae también las líneas ({@link OrderItemPreviewResponse}):
 * la tarjeta debe mostrar el nombre y la variante de cada producto (R9). Las
 * colecciones ya se cargaban en lote por {@code @BatchSize} para calcular
 * {@code itemCount}, así que el coste añadido es proyectarlas, no leerlas.</p>
 *
 * @param items          líneas para pintar la tarjeta; puede venir vacía
 * @param returnRequested {@code true} si alguna línea tiene devolución solicitada
 *                        (R10). Se resuelve con <strong>una única</strong> consulta
 *                        por página, no una por línea.
 */
public record OrderSummaryResponse(
        Long id,
        String orderNumber,
        OrderStatus status,
        String currency,
        BigDecimal totalAmount,
        Instant createdAt,
        int itemCount,
        List<OrderItemPreviewResponse> items,
        boolean returnRequested
) {}
