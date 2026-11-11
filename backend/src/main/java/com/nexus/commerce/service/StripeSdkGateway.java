package com.nexus.commerce.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.config.PaymentsProperties;
import com.nexus.commerce.exception.InvalidWebhookSignatureException;
import com.nexus.commerce.exception.PaymentGatewayException;
import com.stripe.StripeClient;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Implementación real sobre {@code stripe-java}. El cliente se construye de
 * forma perezosa y sólo si hay clave (modo sin pasarela → nunca se usa).
 *
 * <p>Del webhook se extrae lo necesario del JSON <strong>ya verificado por
 * firma</strong> en lugar de deserializar con el SDK: no depende de que la
 * versión de API del evento coincida con la fijada en la librería.</p>
 *
 * <p>Los mensajes de error de Stripe se loguean sin la clave y sin el
 * {@code clientSecret}; al cliente sólo llega un mensaje genérico.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StripeSdkGateway implements StripeGateway {

    private final PaymentsProperties properties;
    private final ObjectMapper objectMapper;

    private volatile StripeClient client;

    private StripeClient client() {
        if (!properties.isEnabled()) {
            throw new PaymentGatewayException("Los pagos online no están configurados");
        }
        StripeClient local = client;
        if (local == null) {
            synchronized (this) {
                if (client == null) {
                    client = new StripeClient(properties.getSecretKey());
                }
                local = client;
            }
        }
        return local;
    }

    @Override
    public GatewayPaymentIntent createPaymentIntent(String orderNumber, long amountMinor, String currency,
                                                    String idempotencyKey) {
        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(amountMinor)
                .setCurrency(currency.toLowerCase())
                // «card» incluye las wallets (Apple Pay) del Payment Element
                .addAllowedPaymentMethodType(PaymentIntentCreateParams.AllowedPaymentMethodType.CARD)
                .setDescription("Pedido " + orderNumber)
                .putMetadata("orderNumber", orderNumber)
                .build();
        RequestOptions options = RequestOptions.builder().setIdempotencyKey(idempotencyKey).build();
        try {
            PaymentIntent pi = client().v1().paymentIntents().create(params, options);
            return new GatewayPaymentIntent(pi.getId(), pi.getClientSecret(), pi.getStatus());
        } catch (StripeException e) {
            throw fallo("crear el PaymentIntent", e);
        }
    }

    @Override
    public GatewayPaymentIntent retrievePaymentIntent(String paymentIntentId) {
        try {
            PaymentIntent pi = client().v1().paymentIntents().retrieve(paymentIntentId);
            return new GatewayPaymentIntent(pi.getId(), pi.getClientSecret(), pi.getStatus());
        } catch (StripeException e) {
            throw fallo("recuperar el PaymentIntent", e);
        }
    }

    @Override
    public void cancelPaymentIntent(String paymentIntentId) {
        try {
            client().v1().paymentIntents().cancel(paymentIntentId);
        } catch (StripeException e) {
            throw fallo("cancelar el PaymentIntent", e);
        }
    }

    @Override
    public GatewayRefund createRefund(String paymentIntentId, long amountMinor, String reason,
                                      String idempotencyKey) {
        RefundCreateParams.Builder builder = RefundCreateParams.builder()
                .setPaymentIntent(paymentIntentId)
                .setAmount(amountMinor);
        if (reason != null && !reason.isBlank()) {
            builder.putMetadata("reason", reason.trim());
        }
        RequestOptions options = RequestOptions.builder().setIdempotencyKey(idempotencyKey).build();
        try {
            Refund refund = client().v1().refunds().create(builder.build(), options);
            return new GatewayRefund(refund.getId(), refund.getAmount(), refund.getStatus());
        } catch (StripeException e) {
            throw fallo("crear el reembolso", e);
        }
    }

    @Override
    public WebhookEvent verifyWebhook(String payload, String signatureHeader) {
        String secret = properties.getWebhookSecret();
        if (payload == null || signatureHeader == null || signatureHeader.isBlank() || secret.isEmpty()) {
            throw new InvalidWebhookSignatureException();
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signatureHeader, secret);
        } catch (SignatureVerificationException e) {
            throw new InvalidWebhookSignatureException();
        }
        try {
            JsonNode object = objectMapper.readTree(payload).path("data").path("object");
            String type = event.getType();
            if (type != null && type.startsWith("charge.")) {
                return new WebhookEvent(event.getId(), type,
                        textoONull(object.path("payment_intent")),
                        textoONull(object.path("metadata").path("orderNumber")),
                        object.path("amount_refunded").asLong(0));
            }
            return new WebhookEvent(event.getId(), type,
                    textoONull(object.path("id")),
                    textoONull(object.path("metadata").path("orderNumber")),
                    0);
        } catch (Exception e) {
            // Firma válida pero cuerpo ilegible: no es un fallo de firma
            throw new PaymentGatewayException("Evento de Stripe ilegible", e);
        }
    }

    private static String textoONull(JsonNode node) {
        return node.isTextual() && !node.asText().isBlank() ? node.asText() : null;
    }

    private PaymentGatewayException fallo(String operacion, StripeException e) {
        // El mensaje de StripeException no incluye claves; aun así sólo va al log.
        log.error("Stripe: error al {} — {}", operacion, e.getMessage());
        return new PaymentGatewayException("No se pudo " + operacion + " en la pasarela de pago", e);
    }
}
