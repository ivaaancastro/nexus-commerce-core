package com.nexus.commerce.dto;

/**
 * Una celda de la matriz de stock: el estado de un SKU en un almacén.
 * {@code netAvailable} replica la fórmula de la vitrina
 * ({@code max(0, available − reserved)}, Tarea 7.3 R1).
 */
public record StockCellResponse(
        String warehouseCode,
        Integer quantityAvailable,
        Integer quantityReserved,
        Integer netAvailable
) {}
