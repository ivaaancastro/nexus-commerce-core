package com.nexus.commerce.dto;

import java.util.List;

/**
 * Fila de la matriz de stock: un SKU con su producto de contexto y una celda
 * por cada almacén — también para los almacenes sin fila en {@code stock_items}
 * (devuelta {@code 0/0/0}, Tarea 7.3 R1.1).
 */
public record StockMatrixRowResponse(
        Long skuId,
        Long productId,
        String referenceCode,
        String productName,
        String color,
        String size,
        List<StockCellResponse> cells
) {}
