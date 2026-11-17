/**
 * Diccionario de textos en español (Fase 12 — i18n ES/EN).
 *
 * Fuente única de los strings traducibles de la vitrina. Los valores son
 * los textos actuales (hardcoded hasta ahora) para no cambiar el comportamiento
 * por defecto de la app.
 */

export default {
    // Navegación (Header)
    "nav.collection": "Colección",
    "nav.search": "Búsqueda Vectorial",
    "nav.admin": "Admin",
    "nav.orders": "Pedidos",
    "nav.wishlist": "Favoritos",
    "nav.account": "Cuenta",
    "nav.login": "Iniciar sesión",
    "nav.logout": "Cerrar sesión",

    // Carrito
    "cart.title": "Bolsa de compra",
    "cart.empty": "Tu bolsa está vacía",
    "cart.checkout": "Finalizar compra",

    // Botones genéricos
    "button.addToCart": "Añadir a la bolsa",
    "button.save": "Guardar",
    "button.cancel": "Cancelar",

    // Copy fiscal (final-price-display)
    "taxes.included": "Impuestos incluidos (X %)",

    // Mensajes de error amigables (errors.ts)
    "errors.sessionExpired": "Tu sesión ha caducado. Inicia de nuevo para continuar.",
    "errors.noPermission": "No tienes permiso para realizar esta acción.",
    "errors.notFound": "No encontramos lo que buscas.",
    "errors.default": "Algo salió mal. Inténtalo de nuevo.",
    "errors.emailInvalid": "El formato del email no es válido. Ejemplo: nombre@ejemplo.com",
    "errors.emailTaken": "Este email ya está registrado. ¿Quieres iniciar sesión?",
    "errors.invalidCredentials": "El email o la contraseña son incorrectos.",
    "errors.emailNotVerified": "Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.",
    "errors.accountSuspended": "Tu cuenta está suspendida. Contacta con soporte.",
    "errors.invalidVerificationCode": "El código de verificación no es correcto. Inténtalo de nuevo.",
    "errors.invalidRecoveryCode": "El código de recuperación no es correcto. Inténtalo de nuevo.",
    "errors.userNotFound": "No encontramos ninguna cuenta con ese email.",
    "errors.weakPassword": "La contraseña debe tener al menos 8 caracteres.",
    "errors.paymentGateway": "No hemos podido contactar con la pasarela de pago. Inténtalo de nuevo en un momento.",
    "errors.stockInsufficient": "No queda stock suficiente para completar el pedido.",
} satisfies Record<string, string>;
