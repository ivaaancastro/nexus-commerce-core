package com.nexus.commerce.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Configuración de pagos (Fase 9, R7/R10).
 *
 * <p><strong>Sin {@code STRIPE_SECRET_KEY} → «modo sin pasarela»</strong>
 * ({@link #isEnabled()} = {@code false}): el pedido con tarjeta nace
 * {@code CONFIRMED} sin cobro, como antes de la fase. Mismo patrón que
 * {@code searchMode} y el «MODO DESARROLLO» del email: el proyecto arranca y
 * sus tests corren sin secretos.</p>
 *
 * <p>Sólo se admiten claves de <strong>test</strong>: una {@code sk_live_…}
 * hace fallar el arranque (el proyecto es un portfolio, nunca cobra de
 * verdad). Los secretos jamás se loguean.</p>
 */
@Slf4j
@Component
public class PaymentsProperties {

    private final String secretKey;
    private final String publishableKey;
    private final String webhookSecret;
    private final long expiryMinutes;

    public PaymentsProperties(
            @Value("${stripe.secret-key:}") String secretKey,
            @Value("${stripe.publishable-key:}") String publishableKey,
            @Value("${stripe.webhook-secret:}") String webhookSecret,
            @Value("${app.payments.expiry-minutes:30}") long expiryMinutes) {
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        this.publishableKey = publishableKey == null ? "" : publishableKey.trim();
        this.webhookSecret = webhookSecret == null ? "" : webhookSecret.trim();
        this.expiryMinutes = expiryMinutes;
    }

    @PostConstruct
    void validar() {
        if (secretKey.startsWith("sk_live_") || publishableKey.startsWith("pk_live_")) {
            throw new IllegalStateException(
                    "Esta aplicación sólo admite claves de Stripe en TEST MODE (sk_test_/pk_test_).");
        }
        if (!isEnabled()) {
            log.warn("PAGOS: MODO SIN PASARELA — STRIPE_SECRET_KEY vacía; el pedido con tarjeta se confirma sin cobro.");
        } else if (publishableKey.isEmpty() || webhookSecret.isEmpty()) {
            log.warn("PAGOS: Stripe activo pero falta STRIPE_PUBLISHABLE_KEY o STRIPE_WEBHOOK_SECRET.");
        } else {
            log.info("PAGOS: Stripe en test mode activo.");
        }
    }

    /** ¿Hay pasarela? Regla única de «modo sin pasarela». */
    public boolean isEnabled() {
        return !secretKey.isEmpty();
    }

    public String getSecretKey() { return secretKey; }
    public String getPublishableKey() { return publishableKey; }
    public String getWebhookSecret() { return webhookSecret; }
    public long getExpiryMinutes() { return expiryMinutes; }
}
