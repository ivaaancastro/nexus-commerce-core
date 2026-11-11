package com.nexus.commerce.exception;

/**
 * Operación de pago incompatible con el estado del pedido (Fase 9): reembolsar
 * algo no cobrado, pagar un pedido que no lo necesita… → {@code 409 PAYMENT_CONFLICT}.
 */
public class PaymentConflictException extends RuntimeException {
    public PaymentConflictException(String message) {
        super(message);
    }
}
