package com.nexus.commerce.dto;

import java.util.List;

public record ReviewSummaryResponse(
        Double averageRating,
        Long totalReviews,
        List<ReviewResponse> reviews
) {}
