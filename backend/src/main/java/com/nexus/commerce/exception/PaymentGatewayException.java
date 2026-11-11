package com.nexus.commerce.exception;

/** Stripe falló o no está disponible (Fase 9). → {@code 502 PAYMENT_GATEWAY_ERROR}. */
public class PaymentGatewayException extends RuntimeException {
    public PaymentGatewayException(String message) {
        super(message);
    }

    public PaymentGatewayException(String message, Throwable cause) {
        super(message, cause);
    }
}
