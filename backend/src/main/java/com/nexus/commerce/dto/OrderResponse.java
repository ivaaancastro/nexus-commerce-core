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
        List<OrderItemResponse> items
) {}
