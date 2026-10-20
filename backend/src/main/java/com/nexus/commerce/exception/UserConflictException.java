package com.nexus.commerce.exception;

/**
 * Guarda de bloqueo sobre usuarios (Tarea 7.5, R2/R3): suspender o degradar al
 * <strong>último admin activo</strong> dejaría el panel fuera de su propia
 * puerta, y auto-suspenderse rompería la sesión del operador a mitad de acción
 * (plan D4). Se traduce a HTTP 409 con {@code code: USER_CONFLICT} en el
 * {@code GlobalExceptionHandler} — patrón de {@code OrderStateConflictException}.
 * Los intentos fallidos son previos a la escritura: en un 409 la BD no cambia.
 */
public class UserConflictException extends RuntimeException {
    public UserConflictException(String message) {
        super(message);
    }
}
