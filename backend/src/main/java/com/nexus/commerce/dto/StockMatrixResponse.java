package com.nexus.commerce.dto;

import java.util.List;

/**
 * Matriz completa de stock para el panel (Tarea 7.3, R1): almacenes
 * (columnas) + todos los SKUs (filas). Se arma con consultas con joins,
 * sin N+1 (R1.2).
 */
public record StockMatrixResponse(
        List<StockWarehouseResponse> warehouses,
        List<StockMatrixRowResponse> rows
) {}
