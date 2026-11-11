package com.nexus.commerce.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Fase 9 - StripeAmounts: céntimos exactos, sin double, monedas de 2 decimales")
class StripeAmountsTest {

    @Test
    @DisplayName("convierte a unidades menores sin pérdida: 96.80 → 9680, 0.07 → 7, 1234.5 → 123450")
    void conversionExacta() {
        assertThat(StripeAmounts.toMinor(new BigDecimal("96.80"), "EUR")).isEqualTo(9680L);
        assertThat(StripeAmounts.toMinor(new BigDecimal("0.07"), "GBP")).isEqualTo(7L);
        assertThat(StripeAmounts.toMinor(new BigDecimal("1234.5"), "usd")).isEqualTo(123450L);
    }

    @Test
    @DisplayName("soporta la moneda de CADA mercado (ES/EUR, UK/GBP, US/USD y CH/CHF): comprar en Suiza no puede dar 502")
    void soportaLasMonedasDeLosCuatroMercados() {
        for (String moneda : new String[]{"EUR", "GBP", "USD", "CHF"}) {
            assertThat(StripeAmounts.toMinor(new BigDecimal("79.95"), moneda)).as(moneda).isEqualTo(7995L);
        }
        assertThat(StripeAmounts.toMinor(new BigDecimal("79.95"), "chf")).isEqualTo(7995L);
    }

    @Test
    @DisplayName("un importe con más de 2 decimales falla en voz alta en vez de redondear")
    void masDeDosDecimalesFalla() {
        assertThatThrownBy(() -> StripeAmounts.toMinor(new BigDecimal("1.005"), "EUR"))
                .isInstanceOf(ArithmeticException.class);
    }

    @Test
    @DisplayName("moneda no soportada o nula → IllegalArgumentException (→ 400)")
    void monedaNoSoportada() {
        assertThatThrownBy(() -> StripeAmounts.toMinor(BigDecimal.TEN, "JPY"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPY");
        assertThatThrownBy(() -> StripeAmounts.toMinor(BigDecimal.TEN, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("fromMinor es la inversa: 2500 → 25.00")
    void inversa() {
        assertThat(StripeAmounts.fromMinor(2500)).isEqualByComparingTo("25.00");
        assertThat(StripeAmounts.fromMinor(7)).isEqualByComparingTo("0.07");
    }
}
