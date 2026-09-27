package com.nexus.commerce.dto;

import java.math.BigDecimal;

public record ProductSearchRequest(
        String query,
        String family,
        BigDecimal maxPrice,
        Integer limit
) {
    public ProductSearchRequest {
        if (limit == null || limit <= 0) {
            limit = 10;
        }
    }
}