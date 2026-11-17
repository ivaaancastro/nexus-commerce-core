/**
 * Diccionario de textos en inglés (Fase 12 — i18n ES/EN).
 *
 * Traducción de los strings en `es.ts`. Mismo shape de claves.
 */

export default {
    // Navegación (Header)
    "nav.collection": "Collection",
    "nav.search": "Vector Search",
    "nav.admin": "Admin",
    "nav.orders": "Orders",
    "nav.wishlist": "Favorites",
    "nav.account": "Account",
    "nav.login": "Sign in",
    "nav.logout": "Sign out",

    // Carrito
    "cart.title": "Shopping bag",
    "cart.empty": "Your bag is empty",
    "cart.checkout": "Checkout",

    // Botones genéricos
    "button.addToCart": "Add to bag",
    "button.save": "Save",
    "button.cancel": "Cancel",

    // Copy fiscal (final-price-display)
    "taxes.included": "Taxes included (X %)",

    // Mensajes de error amigables (errors.ts)
    "errors.sessionExpired": "Your session has expired. Sign in again to continue.",
    "errors.noPermission": "You don't have permission to do this.",
    "errors.notFound": "We couldn't find what you're looking for.",
    "errors.default": "Something went wrong. Try again.",
    "errors.emailInvalid": "The email format is not valid. Example: name@example.com",
    "errors.emailTaken": "This email is already registered. Do you want to sign in?",
    "errors.invalidCredentials": "The email or password are incorrect.",
    "errors.emailNotVerified": "You must verify your email before signing in. Check your inbox.",
    "errors.accountSuspended": "Your account is suspended. Contact support.",
    "errors.invalidVerificationCode": "The verification code is not correct. Try again.",
    "errors.invalidRecoveryCode": "The recovery code is not correct. Try again.",
    "errors.userNotFound": "We couldn't find any account with that email.",
    "errors.weakPassword": "The password must be at least 8 characters.",
    "errors.paymentGateway": "We could not contact the payment gateway. Try again in a moment.",
    "errors.stockInsufficient": "Not enough stock to complete the order.",
} satisfies Record<string, string>;
