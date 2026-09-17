package com.nexus.commerce.dto;

import java.util.List;

public record ProductResponse(
        Long id,
        String referenceCode,
        String name,
        String description,
        String family,
        List<SkuResponse> skus
) {}