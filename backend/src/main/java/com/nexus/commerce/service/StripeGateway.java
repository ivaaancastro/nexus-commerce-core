package com.nexus.commerce.service;

/**
 * Frontera con Stripe (Fase 9, D1). Todo el acceso a la red pasa por aquí: el
 * resto del dominio habla con esta interfaz, así los tests son deterministas
 * (sin red ni mocks de métodos estáticos del SDK).
 *
 * <p>Los importes viajan en <strong>unidades menores</strong> (céntimos). Los
 * errores de Stripe llegan como {@code PaymentGatewayException}; una firma de
 * webhook inválida, como {@code InvalidWebhookSignatureException}.</p>
 */
public interface StripeGateway {

    /** PaymentIntent solo con tarjeta/wallets (Apple Pay), con la idempotency key de Stripe. */
    GatewayPaymentIntent createPaymentIntent(String orderNumber, long amountMinor, String currency, String idempotencyKey);

    GatewayPaymentIntent retrievePaymentIntent(String paymentIntentId);

    void cancelPaymentIntent(String paymentIntentId);

    GatewayRefund createRefund(String paymentIntentId, long amountMinor, String reason, String idempotencyKey);

    /** Verifica la firma sobre el cuerpo CRUDO y extrae lo que el dominio necesita. */
    WebhookEvent verifyWebhook(String payload, String signatureHeader);

    record GatewayPaymentIntent(String id, String clientSecret, String status) {}

    record GatewayRefund(String id, long amountMinor, String status) {}

    /**
     * @param paymentIntentId     id del PaymentIntent (en {@code charge.refunded}, el del cargo)
     * @param orderNumber         {@code metadata.orderNumber} del PaymentIntent, o {@code null}
     * @param amountRefundedMinor valor ABSOLUTO reembolsado del cargo (sólo {@code charge.refunded})
     */
    record WebhookEvent(String id, String type, String paymentIntentId, String orderNumber, long amountRefundedMinor) {}
}
