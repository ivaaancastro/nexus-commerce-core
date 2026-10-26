package com.nexus.commerce.service;

import com.nexus.commerce.entity.EmailOutbox;
import com.nexus.commerce.entity.EmailOutboxStatus;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.EmailOutboxRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * {@code OrderEmailNotifier} (V1, D4/RT4): renderiza e inserta la fila del
 * outbox <strong>con la transacción activa</strong>; jamás lanza (R4).
 */
@ExtendWith(MockitoExtension.class)
class OrderEmailNotifierTest {

    /** Reloj fijo: las afirmaciones sobre {@code next_attempt_at} no bailan. */
    private static final Instant AHORA = Instant.parse("2026-10-22T10:00:00Z");
    private static final Clock RELOJ = Clock.fixed(AHORA, ZoneOffset.UTC);

    @Mock
    private EmailOutboxRepository repository;

    private OrderEmailNotifier notifier;

    @BeforeEach
    void setUp() {
        notifier = new OrderEmailNotifier(repository, RELOJ);
        ReflectionTestUtils.setField(notifier, "baseUrl", "http://localhost:3000");
    }

    private Order pedidoCon(String carrier, String tracking) {
        return Order.builder()
                .orderNumber("NEX-2026-001")
                .status(OrderStatus.CONFIRMED)
                .currency("EUR")
                .totalAmount(new BigDecimal("79.95"))
                .carrier(carrier)
                .trackingNumber(tracking)
                .user(User.builder().email("comprador@example.com").build())
                .build();
    }

    private EmailOutbox filaEncolada() {
        ArgumentCaptor<EmailOutbox> captor = ArgumentCaptor.forClass(EmailOutbox.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("Encola UNA fila PENDING con asunto, destinatario y primer turno a 30 s (D2/D10)")
    void debeEncolarUnaFilaPendiente() {
        // WHEN
        notifier.notificar(pedidoCon("Correos Express", "7712345"), OrderStatus.SHIPPED);

        // THEN
        EmailOutbox fila = filaEncolada();
        assertThat(fila.getRecipient()).isEqualTo("comprador@example.com");
        assertThat(fila.getSubject()).isEqualTo("Nexus · Pedido NEX-2026-001 — Enviado");
        assertThat(fila.getStatus()).isEqualTo(EmailOutboxStatus.PENDING);
        assertThat(fila.getAttempts()).isZero();
        assertThat(fila.getNextAttemptAt())
                .isEqualTo(OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC).plusSeconds(30));
        assertThat(fila.getBodyHtml()).contains("NEXUS").contains("Geist").contains("79,95 EUR");
        assertThat(fila.getBodyText()).contains("NEX-2026-001").contains("Total: 79,95 EUR");
    }

    @Test
    @DisplayName("El email de compra dice «recibido», jamás «pagado» (R1: no hay cobro)")
    void laCompraNuncaDicePagado() {
        // WHEN — el pedido nace CONFIRMED sin PSP (fuera de alcance)
        notifier.notificar(pedidoCon(null, null), OrderStatus.CONFIRMED);

        // THEN
        EmailHtmlTemplates.Mensaje mensaje = notifier.contenidoPedido(pedidoCon(null, null), OrderStatus.CONFIRMED);
        assertThat(mensaje.asunto()).contains("— Confirmado");
        assertThat(mensaje.html()).contains("Hemos recibido tu pedido");
        assertThat(mensaje.texto().toLowerCase()).doesNotContain("pagado").doesNotContain("cobrado");
        assertThat(mensaje.html().toLowerCase()).doesNotContain("pagado");
    }

    @Test
    @DisplayName("Transportista y seguimiento sólo aparecen cuando el pedido sale (R3)")
    void elSeguimientoSóloApareceEnEnviado() {
        // GIVEN
        Order pedido = pedidoCon("Correos Express", "7712345");

        // WHEN
        EmailHtmlTemplates.Mensaje enviado = notifier.contenidoPedido(pedido, OrderStatus.SHIPPED);
        EmailHtmlTemplates.Mensaje entregado = notifier.contenidoPedido(pedido, OrderStatus.DELIVERED);

        // THEN
        assertThat(enviado.html())
                .contains("Correos Express")
                .contains("7712345");
        assertThat(enviado.texto()).contains("Transportista y seguimiento: Correos Express · nº 7712345");
        assertThat(entregado.html()).doesNotContain("7712345");
    }

    @Test
    @DisplayName("El seguimiento (texto de una persona) se escapa en el HTML (R7)")
    void debeEscaparElSeguimientoEscritoANota() {
        // WHEN — el admin teclea HTML en el campo de seguimiento
        EmailHtmlTemplates.Mensaje mensaje = notifier.contenidoPedido(
                pedidoCon("<b>Correos</b>", "<script>x</script>"), OrderStatus.SHIPPED);

        // THEN
        assertThat(mensaje.html())
                .contains("&lt;b&gt;Correos&lt;/b&gt;")
                .doesNotContain("<script>")
                .doesNotContain("<b>Correos</b>");
    }

    @Test
    @DisplayName("Sin usuario o sin email no se encola nada y nada revienta (D8)")
    void sinDestinatarioNoSeEncola() {
        // GIVEN
        Order sinUsuario = Order.builder().orderNumber("NEX-2").status(OrderStatus.CONFIRMED)
                .currency("EUR").totalAmount(BigDecimal.TEN).build();
        Order sinEmail = Order.builder().orderNumber("NEX-3").status(OrderStatus.CONFIRMED)
                .currency("EUR").totalAmount(BigDecimal.TEN)
                .user(User.builder().build()).build();

        // WHEN - THEN
        assertThatCode(() -> notifier.notificar(sinUsuario, OrderStatus.CONFIRMED))
                .doesNotThrowAnyException();
        assertThatCode(() -> notifier.notificar(sinEmail, OrderStatus.CONFIRMED))
                .doesNotThrowAnyException();
        verify(repository, never()).save(any(EmailOutbox.class));
    }

    @Test
    @DisplayName("Si la inserción falla, el pedido no se ve afectado (R4)")
    void siLaInsercionFallaNoLanza() {
        // GIVEN
        org.mockito.Mockito.doThrow(new RuntimeException("BD caída"))
                .when(repository).save(any(EmailOutbox.class));

        // WHEN - THEN
        assertThatCode(() -> notifier.notificar(pedidoCon(null, null), OrderStatus.SHIPPED))
                .doesNotThrowAnyException();
    }
}
