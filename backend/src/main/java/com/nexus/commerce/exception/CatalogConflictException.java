package com.nexus.commerce.exception;

/**
 * Conflicto de catálogo: borrado bloqueado por pedidos existentes o
 * violación de unicidad (referencia de producto / código de barras de SKU).
 * Se traduce a HTTP 409 en el {@code GlobalExceptionHandler}.
 */
public class CatalogConflictException extends RuntimeException {
    public CatalogConflictException(String message) {
        super(message);
    }
}
