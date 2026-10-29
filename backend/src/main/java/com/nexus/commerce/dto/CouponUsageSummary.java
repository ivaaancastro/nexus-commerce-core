package com.nexus.commerce.dto;

import com.nexus.commerce.entity.User;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CouponUsageSummary(
        Long id,
        String userEmail,
        String orderNumber,
        BigDecimal discountAmount,
        OffsetDateTime usedAt
) {}