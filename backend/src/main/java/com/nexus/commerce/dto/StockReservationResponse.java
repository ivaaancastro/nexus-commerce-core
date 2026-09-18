package com.nexus.commerce.dto;

public record StockReservationResponse(
        Long skuId,
        String warehouseCode,
        Integer reservedQuantity,
        Integer remainingAvailable,
        String status
) {}