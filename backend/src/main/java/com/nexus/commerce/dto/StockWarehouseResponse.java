package com.nexus.commerce.dto;

/**
 * Almacén como columna de la matriz de stock (Tarea 7.3, R1).
 * Viene embebido en {@link StockMatrixResponse}: no hace falta un
 * {@code GET /admin/warehouses} aparte (plan D2).
 */
public record StockWarehouseResponse(
        String code,
        String name,
        String countryCode
) {}
