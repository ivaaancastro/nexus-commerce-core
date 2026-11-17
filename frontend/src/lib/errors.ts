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
 * Detecta que un recurso no existe (404).
 *
 * En la ficha de producto distingue «ese mercado no tiene precio para este
 * SKU» de un fallo real de red o de servidor. No es un error: es la ausencia
 * de un dato de catálogo, y la UI debe responder con el estado «no disponible»
 * de la spec (R4) en lugar de un mensaje técnico.
 */
export function isNotFoundError(error: unknown): boolean {
    return error instanceof Error && isHttpStatus(error.message, 404);
}

/**
 * Extrae el campo `message` del cuerpo JSON que `handleResponse()` incrusta en
 * `API Error [n]: {…}`. Devuelve `null` si no hay cuerpo o no es JSON.
 */
function extractServerMessage(message: string): string | null {
    const jsonStart = message.indexOf("{");
    if (jsonStart === -1) return null;

    try {
        const parsed: unknown = JSON.parse(message.slice(jsonStart));
        const serverMessage = (parsed as { message?: unknown })?.message;
        return typeof serverMessage === "string" && serverMessage ? serverMessage : null;
    } catch {
        return null;
    }
}

/**
 * Traduce errores técnicos del backend a mensajes amigables para el usuario.
 *
 * `locale` es opcional: cuando se omite se asume `"es"` (comportamiento
 * histórico, todos los llamantes existentes siguen sin cambios — regla R8.3).
 * Cuando se pasa `"en"`, se devuelve la versión en inglés.
 */
export function getFriendlyErrorMessage(error: unknown, locale: "es" | "en" = "es"): string {
    const message = error instanceof Error ? error.message : "Error inesperado";
    const en = locale === "en";

    // Errores de validación de email
    if (message.includes("did not match the expected pattern")) {
        return en
            ? "The email format is not valid. Example: name@example.com"
            : "El formato del email no es válido. Ejemplo: nombre@ejemplo.com";
    }

    // Errores de email ya registrado
    if (message.includes("email ya está registrado")) {
        return en
            ? "This email is already registered. Do you want to sign in?"
            : "Este email ya está registrado. ¿Quieres iniciar sesión?";
    }

    // Errores de credenciales
    if (message.includes("Credenciales inválidas")) {
        return en
            ? "The email or password are incorrect."
            : "El email o la contraseña son incorrectos.";
    }

    // Errores de email no verificado
    if (message.includes("Email no verificado")) {
        return en
            ? "You must verify your email before signing in. Check your inbox."
            : "Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.";
    }

    // Cuenta suspendida (Tarea 7.5, R4): el chequeo llega como 403 con este
    // texto, y la regla va ANTES de la rama 403 genérica — si no, el login de
    // una cuenta bloqueada diría «No tienes permiso…», que es mentira: sí hay
    // permiso, la cuenta está congelada.
    if (message.includes("suspendida")) {
        const serverMessage = extractServerMessage(message);
        return serverMessage ?? (en ? "Your account is suspended. Contact support." : "Tu cuenta está suspendida. Contacta con soporte.");
    }

    // Errores de código de verificación
    if (message.includes("Código de verificación inválido")) {
        return en
            ? "The verification code is not correct. Try again."
            : "El código de verificación no es correcto. Inténtalo de nuevo.";
    }

    // Errores de código de recuperación
    if (message.includes("Código de recuperación inválido")) {
        return en
            ? "The recovery code is not correct. Try again."
            : "El código de recuperación no es correcto. Inténtalo de nuevo.";
    }

    // Errores de usuario no encontrado
    if (message.includes("Usuario no encontrado")) {
        return en
            ? "We couldn't find any account with that email."
            : "No encontramos ninguna cuenta con ese email.";
    }

    // Errores de contraseña débil
    if (message.includes("contraseña debe tener al menos 8 caracteres")) {
        return en
            ? "The password must be at least 8 characters."
            : "La contraseña debe tener al menos 8 caracteres.";
    }

    // Códigos HTTP del proyecto (AGENTS.md §4.5)
    if (isHttpStatus(message, 400)) {
        // Validación de DTO: el backend ya redacta el fallo de campo en
        // español («referenceCode: La referencia debe tener el formato…»),
        // así que se muestra tal cual en el formulario.
        const serverMessage = extractServerMessage(message);
        if (serverMessage) return serverMessage;
        return en ? "Please check the form data." : "Revisa los datos del formulario.";
    }
    if (isHttpStatus(message, 401)) {
        return en
            ? "Your session has expired. Sign in again to continue."
            : "Tu sesión ha caducado. Inicia de nuevo para continuar.";
    }
    if (isHttpStatus(message, 403)) {
        return en
            ? "You don't have permission to do this."
            : "No tienes permiso para realizar esta acción.";
    }
    // Fase 9: Stripe no responde o falló al iniciar/reembolsar. El detalle
    // técnico va al log del servidor; aquí sólo un mensaje claro y NEUTRO: el 502
    // sirve tanto al checkout como al reembolso del panel, así que no afirma qué
    // dinero se movió (el carrito añade «No se ha cobrado nada», que sí es cierto ahí).
    if (isHttpStatus(message, 502)) {
        return en
            ? "We could not contact the payment gateway. Try again in a moment."
            : "No hemos podido contactar con la pasarela de pago. Inténtalo de nuevo en un momento.";
    }
    if (isHttpStatus(message, 404)) {
        return en
            ? "We couldn't find what you're looking for."
            : "No encontramos lo que buscas.";
    }
    if (isHttpStatus(message, 409)) {
        // El backend devuelve 409 para stock, devoluciones (Tarea 5.4),
        // catálogo (Tarea 7.2), transiciones de pedido (Tarea 7.4, R3),
        // reservas de la 7.3 y guardas de usuarios (Tarea 7.5: último admin
        // activo o auto-suspensión). Todos traen `code` y su mensaje ya está
        // redactado para el usuario («Ha pasado el plazo de 30 días…»,
        // «No se puede borrar el producto 0432/021: tiene pedidos asociados»,
        // «No se puede fijar 2 unidades: hay 3 reservadas…»,
        // «Transición no permitida: un pedido Enviado no puede pasar a…»,
        // «No puedes suspenderte a ti mismo»).
        // Fase 9: conflictos de pago (reembolsar algo no cobrado, pagar un
        // pedido que no tiene pago pendiente). El mensaje ya viene redactado.
        if (message.includes('"PAYMENT_CONFLICT"')) {
            return (
                extractServerMessage(message) ??
                (en
                    ? "That payment operation is no longer available for this order."
                    : "Esa operación de pago ya no está disponible para este pedido.")
            );
        }
        // ORDER_CONFLICT va aparte: su fallback no es el de stock (R3.1).
        if (message.includes('"ORDER_CONFLICT"')) {
            return (
                extractServerMessage(message) ??
                (en
                    ? "That status change is no longer available. Reload the order and try again."
                    : "Ese cambio de estado ya no está disponible. Recarga el pedido e inténtalo de nuevo.")
            );
        }
        if (
            message.includes('"RETURN_NOT_ALLOWED"') ||
            message.includes('"CATALOG_CONFLICT"') ||
            message.includes('"STOCK_CONFLICT"') ||
            message.includes('"USER_CONFLICT"') ||
            // V5 cupones: código duplicado al crear y borrar un cupón ya usado
            // (el mensaje del servidor ya está redactado para el panel).
            message.includes('"COUPON_CONFLICT"') ||
            message.includes('"COUPON_HAS_USAGES"')
        ) {
            const serverMessage = extractServerMessage(message);
            if (serverMessage) return serverMessage;
        }
        return en
            ? "Not enough stock to complete the order."
            : "No queda stock suficiente para completar el pedido.";
    }

    // Errores de servidor
    if (isHttpStatus(message, 500) || message.includes("Internal Server Error")) {
        return en
            ? "Something went wrong. Try again in a few minutes."
            : "Algo salió mal. Inténtalo de nuevo en unos minutos.";
    }

    // Error por defecto
    return en ? "Something went wrong. Try again." : "Algo salió mal. Inténtalo de nuevo.";
}
