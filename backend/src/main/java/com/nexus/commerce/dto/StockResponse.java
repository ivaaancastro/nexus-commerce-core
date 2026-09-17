package com.nexus.commerce.dto;

import java.util.List;

public record StockResponse(
        Long skuId,
        Integer totalAvailable,
        boolean inStock,
        List<WarehouseStockResponse> breakdown
) {}