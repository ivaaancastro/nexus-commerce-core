package com.nexus.commerce.service;

import com.nexus.commerce.entity.EmailOutbox;
import com.nexus.commerce.entity.EmailOutboxStatus;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.repository.EmailOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Punto único de encolado de los emails de pedido (V1, D4/RT4).
 *
 * <p>Los dos call sites —{@code OrderService.processCheckout} y
 * {@code AdminOrderService.cambiarEstado}— llaman a <strong>una línea</strong>:
 * {@code notificar(order, destino)}. El componente <strong>renderiza</strong>
 * (asunto + HTML + texto con la plantilla compartida) e <strong>inserta la
 * fila del outbox con la transacción activa</strong>: si el negocio hace
 * rollback, no queda fila; si committea, la intención está garantizada
 * (R5/D2).</p>
 *
 * <p><strong>Nunca lanza</strong> (R4): el pedido se crea o cambia aunque esta
 * capa falle — el error queda logueado. El envío real lo hace después
 * {@code EmailOutboxPoller}, fuera de la transacción.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEmailNotifier {

    /** Demora inicial de la fila: el primer turno del poller llega después (D10). */
    static final Duration PRIMER_TURNO = Duration.ofSeconds(30);

    private final EmailOutboxRepository outboxRepository;
    private final Clock clock;

    /** URL base del frontend para el enlace «Ver mi pedido». */
    @Value("${app.base-url:http://localhost:3000}")
    private String baseUrl;

    /**
     * Encola el email de pedido correspondiente a {@code destino} dentro de la
     * transacción en curso. Idempotente de serie: las guardas {@code 409} de la
     * 7.4 impiden repetir estados, así que cada transición = una fila.
     */
    public void notificar(Order order, OrderStatus destino) {
        try {
            String destinatario = order.getUser() != null ? order.getUser().getEmail() : null;
            if (destinatario == null || destinatario.isBlank()) {
                log.warn("Pedido {} sin email de contacto: no se encola el aviso de {}",
                        order.getOrderNumber(), destino.etiqueta());
                return;
            }

            EmailHtmlTemplates.Mensaje mensaje = contenidoPedido(order, destino);

            outboxRepository.save(EmailOutbox.builder()
                    .recipient(destinatario)
                    .subject(mensaje.asunto())
                    .bodyHtml(mensaje.html())
                    .bodyText(mensaje.texto())
                    .status(EmailOutboxStatus.PENDING)
                    .attempts(0)
                    .nextAttemptAt(OffsetDateTime.now(clock).plus(PRIMER_TURNO))
                    .build());

            log.info("Pedido {}: email «{}» encolado para {}",
                    order.getOrderNumber(), mensaje.asunto(), destinatario);
        } catch (Exception e) {
            // R4: la notificación jamás cambia el resultado de la operación.
            log.error("No se pudo encolar el email del pedido {} (el pedido no se ve afectado): {}",
                    order.getOrderNumber(), e.getMessage());
        }
    }

    /**
     * Copy del email de pedido, escrito <strong>una sola vez</strong> (RT6) —
     * el preview de E1 lo reutiliza. Package-visible para el preview y tests.
     */
    EmailHtmlTemplates.Mensaje contenidoPedido(Order order, OrderStatus destino) {
        String etiqueta = destino.etiqueta();
        String numero = order.getOrderNumber();
        String asunto = "Nexus · Pedido " + numero + " — " + etiqueta;
        String titulo = switch (destino) {
            case CONFIRMED -> "Hemos recibido tu pedido";
            case SHIPPED -> "Tu pedido está en camino";
            case DELIVERED -> "Tu pedido ha llegado";
            case CANCELLED -> "Tu pedido ha sido cancelado";
            case PENDING -> "Tu pedido está pendiente";
        };
        String enlace = baseUrl + "/orders/" + EmailHtmlTemplates.escapar(numero);

        String html = EmailHtmlTemplates.envoltorio(titulo,
                EmailHtmlTemplates.dato("Número de pedido", numero) + "\n"
                        + EmailHtmlTemplates.dato("Estado", etiqueta) + "\n"
                        + EmailHtmlTemplates.dato("Total", importeTotal(order))
                        + seguimientoHtml(order, destino) + "\n"
                        + EmailHtmlTemplates.boton(enlace, "Ver mi pedido") + "\n"
                        + EmailHtmlTemplates.parrafo(
                                "Este correo informa de la actividad de tu pedido en Nexus. No hace falta responderlo."));

        String texto = titulo + "\n\n"
                + "Número de pedido: " + numero + "\n"
                + "Estado: " + etiqueta + "\n"
                + "Total: " + importeTotal(order) + "\n"
                + seguimientoTexto(order, destino)
                + "\nVer tu pedido: " + enlace + "\n";

        return new EmailHtmlTemplates.Mensaje(asunto, html, texto);
    }

    /**
     * Total con divisa en <strong>formato español</strong> (coma decimal), como
     * la vitrina. Es <em>sólo presentación</em>: el importe sigue siendo el
     * {@code BigDecimal} intacto del pedido (regla 4.1) — se cambia el punto de
     * la coma, que en Java sólo es texto porque el scale es 2 (HALF_UP).
     */
    private static String importeTotal(Order order) {
        return order.getTotalAmount().toPlainString().replace('.', ',') + " " + order.getCurrency();
    }

    /** Transportista y seguimiento sólo cuando el pedido sale hacia el cliente (R3). */
    private String seguimientoHtml(Order order, OrderStatus destino) {
        if (destino != OrderStatus.SHIPPED || (!tieneSeguimiento(order) && !tieneTransportista(order))) {
            return "";
        }
        String detalle = detalleSeguimiento(order);
        return EmailHtmlTemplates.parrafo("Transportista y seguimiento: " + detalle);
    }

    private String seguimientoTexto(Order order, OrderStatus destino) {
        if (destino != OrderStatus.SHIPPED || (!tieneSeguimiento(order) && !tieneTransportista(order))) {
            return "";
        }
        return "Transportista y seguimiento: " + detalleSeguimiento(order) + "\n";
    }

    private String detalleSeguimiento(Order order) {
        StringBuilder detalle = new StringBuilder();
        if (tieneTransportista(order)) {
            detalle.append(order.getCarrier().trim());
        }
        if (tieneSeguimiento(order)) {
            if (detalle.length() > 0) {
                detalle.append(" · ");
            }
            detalle.append("nº ").append(order.getTrackingNumber().trim());
        }
        return detalle.toString();
    }

    private boolean tieneTransportista(Order order) {
        return order.getCarrier() != null && !order.getCarrier().isBlank();
    }

    private boolean tieneSeguimiento(Order order) {
        return order.getTrackingNumber() != null && !order.getTrackingNumber().isBlank();
    }
}
