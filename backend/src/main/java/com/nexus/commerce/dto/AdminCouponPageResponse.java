package com.nexus.commerce.dto;

import com.nexus.commerce.entity.Coupon;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record AdminCouponPageResponse(
        List<CouponSummaryResponse> coupons,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}