package com.nexus.commerce.exception;

/** Firma del webhook ausente o inválida (Fase 9, R3.1). → {@code 400} sin detalle. */
public class InvalidWebhookSignatureException extends RuntimeException {
    public InvalidWebhookSignatureException() {
        super("Firma de webhook no válida");
    }
}
