package com.nexus.commerce.dto;

import com.nexus.commerce.entity.Coupon;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CouponSummaryResponse(
        Long id,
        String code,
        Coupon.DiscountType type,
        BigDecimal value,
        BigDecimal minOrderAmount,
        BigDecimal maxDiscountAmount,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        int usageLimit,
        int usageCount,
        int perUserLimit,
        boolean active,
        OffsetDateTime createdAt
) {}