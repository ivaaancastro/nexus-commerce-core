package com.nexus.commerce.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Fase 9 - PaymentsProperties: modo sin pasarela y sólo claves de test")
class PaymentsPropertiesTest {

    @Test
    @DisplayName("sin STRIPE_SECRET_KEY (vacía, en blanco o nula) → modo sin pasarela")
    void sinClaveEsModoSinPasarela() {
        assertThat(new PaymentsProperties("", "", "", 30).isEnabled()).isFalse();
        assertThat(new PaymentsProperties("   ", "", "", 30).isEnabled()).isFalse();
        assertThat(new PaymentsProperties(null, null, null, 30).isEnabled()).isFalse();
        assertThatCode(() -> new PaymentsProperties("", "", "", 30).validar()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("con sk_test_ → pasarela activa y la configuración se expone recortada")
    void conClaveDeTestEstaActiva() {
        PaymentsProperties p = new PaymentsProperties(" sk_test_x ", "pk_test_y", "whsec_z", 45);

        assertThat(p.isEnabled()).isTrue();
        assertThat(p.getSecretKey()).isEqualTo("sk_test_x");
        assertThat(p.getPublishableKey()).isEqualTo("pk_test_y");
        assertThat(p.getWebhookSecret()).isEqualTo("whsec_z");
        assertThat(p.getExpiryMinutes()).isEqualTo(45);
        assertThatCode(p::validar).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("una clave LIVE hace fallar el arranque: el proyecto nunca cobra de verdad")
    void claveLiveNoArranca() {
        assertThatThrownBy(() -> new PaymentsProperties("sk_live_abc", "pk_test_y", "w", 30).validar())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TEST MODE")
                .hasMessageNotContaining("sk_live_abc");
        assertThatThrownBy(() -> new PaymentsProperties("sk_test_ok", "pk_live_abc", "w", 30).validar())
                .isInstanceOf(IllegalStateException.class);
    }
}
