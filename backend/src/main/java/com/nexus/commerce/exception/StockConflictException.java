package com.nexus.commerce.exception;

/**
 * Conflicto de stock en el panel (Tarea 7.3, R2.2): el admin intenta bajar
 * {@code quantity_available} por debajo de las unidades ya reservadas, o dos
 * escrituras simultáneas chocan en la restricción {@code uk_sku_warehouse}.
 * Se traduce a HTTP 409 con {@code code: STOCK_CONFLICT} en el
 * {@code GlobalExceptionHandler} — patrón de {@code CatalogConflictException}.
 */
public class StockConflictException extends RuntimeException {
    public StockConflictException(String message) {
        super(message);
    }
}
