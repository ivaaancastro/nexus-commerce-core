package com.nexus.commerce.dto;

import java.util.List;

public record AdminReviewPageResponse(
        List<AdminReviewResponse> reviews,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
