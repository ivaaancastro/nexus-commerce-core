package com.nexus.commerce.exception;

/**
 * Excepción lanzada cuando no se puede reembolsar un pedido en su estado actual.
 * 
 * Se usa para validar que el pedido está en un estado que permite reembolso
 * (solo CONFIRMED → refund, DELIVERED requiere análisis adicional).
 */
public class RefundNotAllowedException extends RuntimeException {

    public RefundNotAllowedException(String currentState) {
        super("No se pueden reembolsar pedidos en el estado actual: " + currentState);
    }
}