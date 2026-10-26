package com.nexus.commerce.service;

import com.nexus.commerce.repository.EmailOutboxRepository;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Generador del <strong>preview HTML de los 3 emails</strong> (V1, D12/E1):
 * vuelca los cuerpos reales a {@code target/email-preview/*.html} para que se
 * <em>miren</em> en navegador — el estilo es lo que se ve, no lo que se supone.
 *
 * <p>Los compositores son los mismos que usan el servicio y el notifier en
 * producción: lo que ves en el preview es exactamente lo que sale.</p>
 */
@DisplayName("Preview de los 3 emails en HTML (D12/E1)")
class EmailPreviewTest {

    @Test
    void generaLosTresHtmlEnTarget() throws IOException {
        // GIVEN — compositor de cuenta (sin enviar: sólo render)
        EmailService emailService = new EmailService(null);
        ReflectionTestUtils.setField(emailService, "baseUrl", "http://localhost:3000");

        // GIVEN — compositor de pedido (el repositorio no se usa al componer)
        OrderEmailNotifier notifier = new OrderEmailNotifier(
                Mockito.mock(EmailOutboxRepository.class), Clock.systemUTC());
        ReflectionTestUtils.setField(notifier, "baseUrl", "http://localhost:3000");

        Order pedido = Order.builder()
                .orderNumber("NEX-2026-042")
                .status(OrderStatus.SHIPPED)
                .currency("EUR")
                .totalAmount(new BigDecimal("159.90"))
                .carrier("Correos Express")
                .trackingNumber("7712345")
                .user(User.builder().email("comprador@example.com").build())
                .build();

        // WHEN — los tres cuerpos reales
        String verificacion = emailService.contenidoVerificacion("comprador@example.com", "482913").html();
        String recuperacion = emailService.contenidoRecuperacion("comprador@example.com", "654321").html();
        String pedidoEnviado = notifier.contenidoPedido(pedido, OrderStatus.SHIPPED).html();

        // THEN — se vuelcan y se comprueba que los tres comparten envoltorio
        escribir("01-verificacion.html", verificacion);
        escribir("02-recuperacion.html", recuperacion);
        escribir("03-pedido-enviado.html", pedidoEnviado);

        for (String html : new String[] {verificacion, recuperacion, pedidoEnviado}) {
            assertThat(html)
                    .contains("NEXUS")
                    .contains("Geist, -apple-system")
                    .doesNotContain("<style")
                    .doesNotContain("<img");
        }
        assertThat(pedidoEnviado)
                .contains("NEX-2026-042")
                .contains("Correos Express")
                .contains("7712345")
                .contains("http://localhost:3000/orders/NEX-2026-042");
    }

    private static void escribir(String nombre, String html) throws IOException {
        Path directorio = Path.of("target", "email-preview");
        Files.createDirectories(directorio);
        Files.writeString(directorio.resolve(nombre), html, StandardCharsets.UTF_8);
    }
}
