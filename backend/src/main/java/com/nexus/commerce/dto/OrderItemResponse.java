package com.nexus.commerce.dto;

import java.math.BigDecimal;

public record OrderItemResponse(
        Long id,
        Long skuId,
        String skuCode,
        String warehouseCode,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal taxRate,
        BigDecimal taxAmount,
        BigDecimal totalAmount
) {}