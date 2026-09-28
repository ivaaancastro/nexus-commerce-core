package com.nexus.commerce.dto;

import com.nexus.commerce.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

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
        List<OrderItemResponse> items
) {}