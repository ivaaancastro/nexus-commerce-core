package com.nexus.commerce.exception;

/**
 * Excepción lanzada cuando no se puede crear un PaymentIntent en Stripe.
 * 
 * Esta excepción se traduce centralmente en `GlobalExceptionHandler` a una
 * respuesta HTTP 400 con estructura estructurada.
 */
public class PaymentIntentCreationException extends RuntimeException {

    public PaymentIntentCreationException(String message) {
        super(message);
    }
}