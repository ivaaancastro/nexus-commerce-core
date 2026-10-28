package com.nexus.commerce.dto;

import java.time.ZonedDateTime;

public record AdminReviewResponse(
        Long id,
        Long productId,
        String productName,
        String userEmail,
        Integer rating,
        String title,
        String comment,
        ZonedDateTime createdAt
) {}
