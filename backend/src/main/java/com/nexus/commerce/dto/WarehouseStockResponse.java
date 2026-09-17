package com.nexus.commerce.dto;

public record WarehouseStockResponse(
        String warehouseCode,
        String warehouseName,
        String countryCode,
        Integer available,
        Integer reserved,
        Integer netAvailable
) {}