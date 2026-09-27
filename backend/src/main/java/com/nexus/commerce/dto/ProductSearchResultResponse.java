package com.nexus.commerce.dto;

import java.util.List;

public record ProductSearchResultResponse(
        Long productId,
        String referenceCode,
        String name,
        String family,
        String description,
        Double similarityScore,
        List<String> tags
) {}