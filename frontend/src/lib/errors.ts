/**
 * Detecta si el error indica que la cuenta todavía no ha verificado su email.
 * Permite ofrecer un acceso directo a /verify-email desde el propio login,
 * en lugar de dejar al usuario atrapado en el mensaje «revisa tu bandeja».
 */
export function isUnverifiedEmailError(error: unknown): boolean {
    return error instanceof Error && error.message.includes("Email no verificado");
}

/**
 * Detecta el código HTTP con el formato exacto que emite `handleResponse()`:
 * `API Error [401]: {…}`.
 *
 * Se ancla al prefijo y nunca al número suelto, porque `401` o `500` también
 * aparecen dentro de un importe (`401.00`) y producirían falsos positivos.
 */
function isHttpStatus(message: string, status: number): boolean {
    return message.includes(`API Error [${status}]`);
}

/**
 * Traduce errores técnicos del backend a mensajes amigables para el usuario.
 */
export function getFriendlyErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : "Error inesperado";

    // Errores de validación de email
    if (message.includes("did not match the expected pattern")) {
        return "El formato del email no es válido. Ejemplo: nombre@ejemplo.com";
    }

    // Errores de email ya registrado
    if (message.includes("email ya está registrado")) {
        return "Este email ya está registrado. ¿Quieres iniciar sesión?";
    }

    // Errores de credenciales
    if (message.includes("Credenciales inválidas")) {
        return "El email o la contraseña son incorrectos.";
    }

    // Errores de email no verificado
    if (message.includes("Email no verificado")) {
        return "Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.";
    }

    // Errores de código de verificación
    if (message.includes("Código de verificación inválido")) {
        return "El código de verificación no es correcto. Inténtalo de nuevo.";
    }

    // Errores de código de recuperación
    if (message.includes("Código de recuperación inválido")) {
        return "El código de recuperación no es correcto. Inténtalo de nuevo.";
    }

    // Errores de usuario no encontrado
    if (message.includes("Usuario no encontrado")) {
        return "No encontramos ninguna cuenta con ese email.";
    }

    // Errores de contraseña débil
    if (message.includes("contraseña debe tener al menos 8 caracteres")) {
        return "La contraseña debe tener al menos 8 caracteres.";
    }

    // Códigos HTTP del proyecto (AGENTS.md §4.5)
    if (isHttpStatus(message, 401)) {
        return "Tu sesión ha caducado. Inicia de nuevo para continuar.";
    }
    if (isHttpStatus(message, 403)) {
        return "No tienes permiso para realizar esta acción.";
    }
    if (isHttpStatus(message, 404)) {
        return "No encontramos lo que buscas.";
    }
    if (isHttpStatus(message, 409)) {
        return "No queda stock suficiente para completar el pedido.";
    }

    // Errores de servidor
    if (isHttpStatus(message, 500) || message.includes("Internal Server Error")) {
        return "Algo salió mal. Inténtalo de nuevo en unos minutos.";
    }

    // Error por defecto
    return "Algo salió mal. Inténtalo de nuevo.";
}
