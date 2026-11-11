package com.nexus.commerce.service;

import com.nexus.commerce.config.PaymentsProperties;
import com.nexus.commerce.dto.AdminOrderDetailResponse;
import com.nexus.commerce.dto.PaymentSessionResponse;
import com.nexus.commerce.dto.RefundRequest;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.PaymentStatus;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.PaymentConflictException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.StripeEventRepository;
import com.nexus.commerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Pagos con Stripe (Fase 9, spec R2–R6). El <strong>webhook es la fuente de
 * verdad</strong> del cobro (D2): el pedido sólo pasa a {@code CONFIRMED} con un
 * {@code payment_intent.succeeded} verificado por firma.
 *
 * <p>Los métodos que escriben son transaccionales <em>por bean</em>: el
 * checkout y el job los invocan desde fuera ({@link CheckoutService},
 * {@link PaymentExpiryJob}) para que ninguna llamada de red a Stripe ocurra con
 * bloqueos de inventario abiertos (D5). Ningún secreto ni {@code clientSecret}
 * se loguea.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final StripeEventRepository stripeEventRepository;
    private final StripeGateway stripeGateway;
    private final PaymentsProperties payments;
    private final AdminOrderService adminOrderService;
    private final OrderEmailNotifier orderEmailNotifier;
    private final Clock clock;

    /** Datos mínimos del pedido para crear el PaymentIntent (sin entidades fuera de la transacción). */
    public record PaymentTarget(String orderNumber, BigDecimal total, String currency, String idempotencyKey,
                                String paymentIntentId, PaymentStatus paymentStatus, OrderStatus status) {}

    // ── Checkout: pasos transaccionales sueltos (los orquesta CheckoutService) ──

    @Transactional(readOnly = true)
    public PaymentTarget paymentTarget(String orderNumber) {
        Order o = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido no encontrado: " + orderNumber));
        return new PaymentTarget(o.getOrderNumber(), o.getTotalAmount(), o.getCurrency(), o.getIdempotencyKey(),
                o.getPaymentIntentId(), o.getPaymentStatus(), o.getStatus());
    }

    /** Guarda el id del PaymentIntent salvo que otro hilo ya lo hubiera guardado. */
    @Transactional
    public void attachPaymentIntent(String orderNumber, String paymentIntentId) {
        Order o = orderRepository.findByOrderNumberForUpdate(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido no encontrado: " + orderNumber));
        if (o.getPaymentIntentId() == null) {
            o.setPaymentIntentId(paymentIntentId);
            orderRepository.save(o);
        }
    }

    // ── R2: datos para pagar ───────────────────────────────────────────────

    /**
     * Solo el dueño (otro usuario ⇒ 404, igual que {@code /orders/{n}}). El
     * {@code clientSecret} se recupera de Stripe; no se persiste ni se loguea.
     * Sin transacción: la llamada de red no retiene una conexión de BD.
     */
    public PaymentSessionResponse getPaymentSession(String email, String orderNumber) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido no encontrado: " + orderNumber));
        Order order = orderRepository.findByUserIdAndOrderNumber(user.getId(), orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido no encontrado: " + orderNumber));

        // Sólo se paga un pedido PENDING: uno cancelado/caducado conserva
        // REQUIRES_PAYMENT pero su PaymentIntent ya está anulado.
        if (!payments.isEnabled()
                || order.getStatus() != OrderStatus.PENDING
                || order.getPaymentStatus() != PaymentStatus.REQUIRES_PAYMENT
                || order.getPaymentIntentId() == null) {
            throw new PaymentConflictException("El pedido " + orderNumber + " no tiene un pago pendiente");
        }
        StripeGateway.GatewayPaymentIntent pi = stripeGateway.retrievePaymentIntent(order.getPaymentIntentId());
        return new PaymentSessionResponse(pi.clientSecret(), payments.getPublishableKey(), order.getPaymentStatus());
    }

    // ── R3: webhook ────────────────────────────────────────────────────────

    /**
     * Verifica la firma (sobre el cuerpo crudo) y procesa el evento <strong>una
     * sola vez</strong>: el id del evento se registra con {@code INSERT … ON
     * CONFLICT DO NOTHING} en la misma transacción que el efecto — si el efecto
     * falla, el registro hace rollback y Stripe reintenta.
     */
    @Transactional
    public void handleWebhook(String payload, String signatureHeader) {
        if (!payments.isEnabled()) {
            throw new ResourceNotFoundException("Webhook no disponible");
        }
        StripeGateway.WebhookEvent event = stripeGateway.verifyWebhook(payload, signatureHeader);

        if (stripeEventRepository.insertIfAbsent(event.id(), event.type()) == 0) {
            log.info("Stripe: evento {} ya procesado; se ignora", event.id());
            return;
        }

        switch (event.type()) {
            case "payment_intent.succeeded" -> onPaymentSucceeded(event);
            case "payment_intent.payment_failed" ->
                    log.warn("Stripe: pago fallido para el pedido {}; sigue pendiente", event.orderNumber());
            case "charge.refunded" -> onChargeRefunded(event);
            default -> log.debug("Stripe: evento {} ignorado", event.type());
        }
    }

    private void onPaymentSucceeded(StripeGateway.WebhookEvent event) {
        Optional<Order> encontrado = localizarPedido(event);
        if (encontrado.isEmpty()) {
            log.warn("Stripe: pago {} sin pedido asociado", event.paymentIntentId());
            return;
        }
        Order order = encontrado.get();

        if (order.getPaymentStatus() == PaymentStatus.PAID || order.getPaymentStatus().cobrado()) {
            return; // entrega fuera de orden o duplicada: ya está cobrado
        }
        if (order.getPaymentIntentId() == null) {
            order.setPaymentIntentId(event.paymentIntentId());
        }
        order.setPaymentStatus(PaymentStatus.PAID);

        if (order.getStatus() == OrderStatus.PENDING) {
            order.setStatus(OrderStatus.CONFIRMED);
            orderRepository.save(order);
            // El notifier ya envuelve su propio fallo: el email nunca cambia el resultado (V1/R4)
            orderEmailNotifier.notificar(order, OrderStatus.CONFIRMED);
            log.info("Pedido {} pagado y confirmado", order.getOrderNumber());
        } else {
            // Pago tardío sobre un pedido ya cancelado (expiró): NO se resucita.
            // El dinero está cobrado → queda PAID para que el admin pueda reembolsarlo.
            orderRepository.save(order);
            log.error("Pedido {} en estado {} recibió un pago: requiere REEMBOLSO MANUAL",
                    order.getOrderNumber(), order.getStatus());
        }
    }

    private void onChargeRefunded(StripeGateway.WebhookEvent event) {
        Optional<Order> encontrado = localizarPedido(event);
        if (encontrado.isEmpty()) {
            log.warn("Stripe: reembolso {} sin pedido asociado", event.paymentIntentId());
            return;
        }
        Order order = encontrado.get();
        PaymentStatus pago = order.getPaymentStatus();
        if (!pago.cobrado() && pago != PaymentStatus.REFUNDED) {
            // Stripe no garantiza el orden de los eventos: charge.refunded puede adelantarse a
            // payment_intent.succeeded. Se RECHAZA (500) en vez de descartarlo: el rollback
            // deshace también el registro en stripe_events y Stripe lo reintentará cuando el
            // pedido ya esté cobrado. Descartarlo lo dejaría marcado como procesado para siempre.
            throw new IllegalStateException("charge.refunded recibido antes del cobro del pedido "
                    + order.getOrderNumber() + "; Stripe lo reintentará");
        }
        // Valor ABSOLUTO del cargo (reentrante, sin doble suma si llegan webhook y respuesta) pero
        // NUNCA a la baja: un evento antiguo entregado tarde no puede deshacer un reembolso posterior.
        BigDecimal reembolsado = StripeAmounts.fromMinor(event.amountRefundedMinor())
                .max(order.getAmountRefunded());
        aplicarReembolso(order, reembolsado);
        orderRepository.save(order);
    }

    private Optional<Order> localizarPedido(StripeGateway.WebhookEvent event) {
        if (event.paymentIntentId() != null) {
            Optional<Order> porPi = orderRepository.findByPaymentIntentIdForUpdate(event.paymentIntentId());
            if (porPi.isPresent()) {
                return porPi;
            }
        }
        // El webhook puede llegar antes de que el checkout guardara el id del PaymentIntent
        if (event.orderNumber() != null) {
            return orderRepository.findByOrderNumberForUpdate(event.orderNumber());
        }
        return Optional.empty();
    }

    /** Fija el reembolso (absoluto) y deriva el estado del cobro. */
    private static void aplicarReembolso(Order order, BigDecimal reembolsado) {
        order.setAmountRefunded(reembolsado);
        if (reembolsado.compareTo(order.getTotalAmount()) >= 0) {
            order.setPaymentStatus(PaymentStatus.REFUNDED);
        } else if (reembolsado.signum() > 0) {
            order.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
        } else {
            order.setPaymentStatus(PaymentStatus.PAID);
        }
    }

    // ── R4: reembolso (admin) ──────────────────────────────────────────────

    /**
     * Reembolso total o parcial. La fila del pedido se bloquea durante la
     * llamada a Stripe (una sola fila): serializa dos reembolsos simultáneos
     * del mismo pedido. La idempotency key depende del estado previo y del
     * importe, así que un doble clic reenvía la misma petición y Stripe
     * devuelve el mismo reembolso. <strong>No cambia el estado del pedido ni
     * repone stock</strong> (D9).
     */
    @Transactional
    public AdminOrderDetailResponse refund(String orderNumber, RefundRequest request) {
        if (!payments.isEnabled()) {
            throw new PaymentConflictException("Los pagos online no están configurados");
        }
        Order order = orderRepository.findByOrderNumberForUpdate(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido no encontrado: " + orderNumber));

        if (!order.getPaymentStatus().cobrado() || order.getPaymentIntentId() == null) {
            throw new PaymentConflictException("El pedido " + orderNumber + " no tiene un pago reembolsable");
        }

        BigDecimal resto = order.getTotalAmount().subtract(order.getAmountRefunded());
        BigDecimal importe = (request == null || request.amount() == null)
                ? resto
                : request.amount().setScale(2, RoundingMode.HALF_UP);
        if (importe.signum() <= 0 || importe.compareTo(resto) > 0) {
            throw new IllegalArgumentException("El importe a reembolsar debe estar entre 0,01 y " + resto);
        }

        long previoMinor = StripeAmounts.toMinor(order.getAmountRefunded(), order.getCurrency());
        long importeMinor = StripeAmounts.toMinor(importe, order.getCurrency());
        String clave = "refund-" + orderNumber + "-" + previoMinor + "-" + importeMinor;

        stripeGateway.createRefund(order.getPaymentIntentId(), importeMinor,
                request == null ? null : request.reason(), clave);

        aplicarReembolso(order, order.getAmountRefunded().add(importe));
        orderRepository.save(order);
        log.info("Pedido {}: reembolsado {} {} (acumulado {})", orderNumber, importe, order.getCurrency(),
                order.getAmountRefunded());

        return adminOrderService.detalle(orderNumber);
    }

    // ── R6: expiración ─────────────────────────────────────────────────────

    /**
     * Caduca los pedidos con tarjeta sin pagar tras {@code expiry-minutes}. Cada
     * pedido va en su propia transacción y un fallo no impide los demás. Sin
     * {@code @Transactional}: la anulación del PaymentIntent es red.
     *
     * @return cuántos pedidos se cancelaron
     */
    public int expirarImpagados() {
        if (!payments.isEnabled()) {
            return 0;
        }
        Instant corte = Instant.now(clock).minus(Duration.ofMinutes(payments.getExpiryMinutes()));
        List<String> vencidos = orderRepository.findExpiredUnpaid(
                OrderStatus.PENDING, PaymentStatus.REQUIRES_PAYMENT, corte);
        int cancelados = 0;
        for (String numero : vencidos) {
            try {
                Optional<AdminOrderService.ImpagoCancelado> res = adminOrderService.cancelarPorImpago(numero);
                if (res.isPresent()) {
                    cancelados++;
                    anularPaymentIntent(res.get().paymentIntentId(), numero);
                }
            } catch (RuntimeException e) {
                log.error("No se pudo caducar el pedido {}: {}", numero, e.getMessage());
            }
        }
        return cancelados;
    }

    private void anularPaymentIntent(String paymentIntentId, String orderNumber) {
        if (paymentIntentId == null) {
            return;
        }
        try {
            stripeGateway.cancelPaymentIntent(paymentIntentId);
        } catch (RuntimeException e) {
            log.warn("PaymentIntent del pedido {} no se pudo anular: {}", orderNumber, e.getMessage());
        }
    }
}
