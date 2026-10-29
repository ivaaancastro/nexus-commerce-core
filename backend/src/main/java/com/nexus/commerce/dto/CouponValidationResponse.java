package com.nexus.commerce.dto;

import com.nexus.commerce.entity.Coupon;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CouponValidationResponse(
        boolean valid,
        String message,
        BigDecimal discountAmount,
        CouponSummaryResponse coupon
) {}