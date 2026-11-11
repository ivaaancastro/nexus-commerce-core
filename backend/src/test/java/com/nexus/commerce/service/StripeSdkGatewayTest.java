package com.nexus.commerce.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.config.PaymentsProperties;
import com.nexus.commerce.exception.InvalidWebhookSignatureException;
import com.nexus.commerce.exception.PaymentGatewayException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Fase 9 · R3.1 — la verificación de firma se prueba con una firma <strong>real</strong>
 * (HMAC-SHA256 como la calcula Stripe), sin red ni claves de Stripe. Las operaciones
 * que hablan con la API quedan para la verificación manual (D.3).
 */
@DisplayName("Fase 9 - StripeSdkGateway: verificación de firma del webhook y modo sin pasarela")
class StripeSdkGatewayTest {

    private static final String SECRET = "whsec_test_secret";
    private static final String SUCCEEDED = """
            {"id":"evt_100","object":"event","api_version":"2020-08-27","type":"payment_intent.succeeded",
             "data":{"object":{"id":"pi_100","object":"payment_intent","amount":9680,
                      "metadata":{"orderNumber":"ORD-AB12CD34"}}}}""";
    private static final String REFUNDED = """
            {"id":"evt_200","object":"event","api_version":"2020-08-27","type":"charge.refunded",
             "data":{"object":{"id":"ch_1","object":"charge","payment_intent":"pi_100","amount_refunded":2500,
                      "metadata":{}}}}""";

    private final StripeSdkGateway gateway = new StripeSdkGateway(
            new PaymentsProperties("sk_test_x", "pk_test_x", SECRET, 30), new ObjectMapper());

    private static String firma(String payload, String secret, long t) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String hex = HexFormat.of().formatHex(mac.doFinal((t + "." + payload).getBytes(StandardCharsets.UTF_8)));
        return "t=" + t + ",v1=" + hex;
    }

    private static long ahora() {
        return System.currentTimeMillis() / 1000;
    }

    @Test
    @DisplayName("firma válida: extrae id, tipo, PaymentIntent y metadata.orderNumber")
    void firmaValidaExtraeLoNecesario() throws Exception {
        StripeGateway.WebhookEvent e = gateway.verifyWebhook(SUCCEEDED, firma(SUCCEEDED, SECRET, ahora()));

        assertThat(e.id()).isEqualTo("evt_100");
        assertThat(e.type()).isEqualTo("payment_intent.succeeded");
        assertThat(e.paymentIntentId()).isEqualTo("pi_100");
        assertThat(e.orderNumber()).isEqualTo("ORD-AB12CD34");
        assertThat(e.amountRefundedMinor()).isZero();
    }

    @Test
    @DisplayName("charge.refunded: toma el PaymentIntent del cargo y el importe reembolsado ABSOLUTO")
    void chargeRefunded() throws Exception {
        StripeGateway.WebhookEvent e = gateway.verifyWebhook(REFUNDED, firma(REFUNDED, SECRET, ahora()));

        assertThat(e.type()).isEqualTo("charge.refunded");
        assertThat(e.paymentIntentId()).isEqualTo("pi_100");
        assertThat(e.amountRefundedMinor()).isEqualTo(2500L);
        assertThat(e.orderNumber()).isNull();
    }

    @Test
    @DisplayName("firma con otro secreto, cuerpo alterado, antigua o malformada → InvalidWebhookSignatureException")
    void firmasInvalidas() throws Exception {
        String otroSecreto = firma(SUCCEEDED, "whsec_otro", ahora());
        assertThatThrownBy(() -> gateway.verifyWebhook(SUCCEEDED, otroSecreto))
                .isInstanceOf(InvalidWebhookSignatureException.class);

        String valida = firma(SUCCEEDED, SECRET, ahora());
        assertThatThrownBy(() -> gateway.verifyWebhook(SUCCEEDED.replace("9680", "1"), valida))
                .isInstanceOf(InvalidWebhookSignatureException.class);

        String antigua = firma(SUCCEEDED, SECRET, ahora() - 3600);
        assertThatThrownBy(() -> gateway.verifyWebhook(SUCCEEDED, antigua))
                .isInstanceOf(InvalidWebhookSignatureException.class);

        assertThatThrownBy(() -> gateway.verifyWebhook(SUCCEEDED, "basura"))
                .isInstanceOf(InvalidWebhookSignatureException.class);
    }

    @Test
    @DisplayName("sin cabecera de firma, en blanco o sin secreto configurado → inválido")
    void sinFirmaOSinSecreto() throws Exception {
        assertThatThrownBy(() -> gateway.verifyWebhook(SUCCEEDED, null))
                .isInstanceOf(InvalidWebhookSignatureException.class);
        assertThatThrownBy(() -> gateway.verifyWebhook(SUCCEEDED, "  "))
                .isInstanceOf(InvalidWebhookSignatureException.class);
        assertThatThrownBy(() -> gateway.verifyWebhook(null, "t=1,v1=a"))
                .isInstanceOf(InvalidWebhookSignatureException.class);

        StripeSdkGateway sinSecreto = new StripeSdkGateway(
                new PaymentsProperties("sk_test_x", "pk_test_x", "", 30), new ObjectMapper());
        String f = firma(SUCCEEDED, SECRET, ahora());
        assertThatThrownBy(() -> sinSecreto.verifyWebhook(SUCCEEDED, f))
                .isInstanceOf(InvalidWebhookSignatureException.class);
    }

    @Test
    @DisplayName("modo sin pasarela: ninguna operación contra la API se intenta (502 PAYMENT_GATEWAY_ERROR)")
    void sinPasarelaNoLlamaALaRed() {
        StripeSdkGateway apagada = new StripeSdkGateway(new PaymentsProperties("", "", "", 30), new ObjectMapper());

        assertThatThrownBy(() -> apagada.createPaymentIntent("ORD-1", 100, "EUR", "k"))
                .isInstanceOf(PaymentGatewayException.class).hasMessageContaining("no están configurados");
        assertThatThrownBy(() -> apagada.retrievePaymentIntent("pi_1")).isInstanceOf(PaymentGatewayException.class);
        assertThatThrownBy(() -> apagada.cancelPaymentIntent("pi_1")).isInstanceOf(PaymentGatewayException.class);
        assertThatThrownBy(() -> apagada.createRefund("pi_1", 100, null, "k"))
                .isInstanceOf(PaymentGatewayException.class);
    }
}
