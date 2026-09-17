package com.nexus.commerce.dto;

import java.math.BigDecimal;

public record PriceCalculationResponse(
        Long skuId,
        String marketCode,
        String currency,
        BigDecimal finalPrice,
        BigDecimal originalPrice,
        boolean hasDiscount,
        BigDecimal netAmount,
        BigDecimal taxAmount,
        BigDecimal taxRate
) {}