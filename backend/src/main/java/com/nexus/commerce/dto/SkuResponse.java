package com.nexus.commerce.dto;

public record SkuResponse(
        Long id,
        String barcode,
        String color,
        String size
) {}