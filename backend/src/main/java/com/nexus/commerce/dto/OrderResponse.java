package com.nexus.commerce.dto;

import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.PaymentMethod;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * @param returnDeadline   límite para solicitar la devolución: {@code createdAt + 30 días}
 *                         (Tarea 5.5, R4). La ventana no se reimplementa en el
 *                         frontend: sale de la misma constante que usa R1.
 * @param shippingAddress  snapshot inmutable del envío; {@code null} en las órdenes
 *                         previas a la migración {@code V10} —el frontend no pinta la sección—
 * @param paymentMethod    preferencia declarada, no procesada; {@code null} en las órdenes previas
 * @param carrier          transportista del envío (Tarea 7.4, R5); el admin lo registra al
 *                         enviar — el comprador lo ve en su pedido. {@code null} pre-V14
 *                         o si nadie lo registró.
 * @param trackingNumber   nº de seguimiento; mismo criterio que {@code carrier}.
 */
public record OrderResponse(
        Long id,
        String orderNumber,
        String idempotencyKey,
        String marketCode,
        String currency,
        OrderStatus status,
        BigDecimal subtotalAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        Instant createdAt,
        Instant returnDeadline,
        ShippingAddressResponse shippingAddress,
        PaymentMethod paymentMethod,
        String carrier,
        String trackingNumber,
        List<OrderItemResponse> items
) {}
