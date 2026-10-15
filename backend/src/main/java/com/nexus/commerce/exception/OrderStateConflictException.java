package com.nexus.commerce.exception;

/**
 * Transición de estado inválida en la gestión de pedidos (Tarea 7.4, R3): el
 * admin intenta mover un pedido por fuera de la máquina (p. ej. un
 * {@code DELIVERED} hacia atrás), o repite el estado que ya tiene — el segundo
 * caso es la guarda que impide el doble clic de «enviar» con doble descuento
 * de stock (plan D3). Se traduce a HTTP 409 con {@code code: ORDER_CONFLICT}
 * en el {@code GlobalExceptionHandler} — patrón de {@code StockConflictException}.
 */
public class OrderStateConflictException extends RuntimeException {
    public OrderStateConflictException(String message) {
        super(message);
    }
}
