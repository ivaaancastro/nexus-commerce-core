package com.nexus.commerce.exception;

/**
 * Cuenta suspendida intentando autenticarse (Tarea 7.5, R4): el chequeo entra
 * en {@code login} <strong>después</strong> de validar la contraseña y en
 * {@code refresh} tras recargar el usuario — un tercero sin la contraseña nunca
 * la recibe (anti enumeración, plan D3). Se traduce a HTTP 403 en el
 * {@code GlobalExceptionHandler} con mensaje amigable.
 *
 * <p><strong>Limitación documentada</strong>: el access token es stateless y
 * dura 24 h (ADR-0006) — un token ya emitido sigue siendo válido hasta expirar
 * o hasta que su portador intente refrescar; la revocación inmediata exigiría
 * blacklist stateful (fuera de alcance, plan D3).</p>
 */
public class UserSuspendedException extends RuntimeException {
    public UserSuspendedException(String message) {
        super(message);
    }
}
