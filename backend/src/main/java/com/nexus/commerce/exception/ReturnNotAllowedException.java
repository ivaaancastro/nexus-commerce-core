package com.nexus.commerce.exception;

/**
 * La línea no admite la devolución solicitada (R1, R2 o R3 de la Tarea 5.4).
 * Se traduce a {@code 409 Conflict} en {@link GlobalExceptionHandler}.
 */
public class ReturnNotAllowedException extends RuntimeException {

    public ReturnNotAllowedException(String message) {
        super(message);
    }
}
