package com.nexus.commerce.service;

import com.nexus.commerce.dto.CheckoutRequest;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.PaymentStatus;
import com.nexus.commerce.exception.PaymentGatewayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Orquesta el checkout con tarjeta (Fase 9, R1) <strong>sin ser transaccional</strong>:
 * <ol>
 *   <li>{@code OrderService.processCheckout} — T1: reserva de stock + pedido
 *       {@code PENDING}, con su propio commit;</li>
 *   <li>la llamada a Stripe, <strong>fuera de cualquier transacción</strong> (D5):
 *       una petición de red con {@code PESSIMISTIC_WRITE} abierto bloquearía el
 *       inventario durante la latencia de Stripe;</li>
 *   <li>si Stripe falla → compensación (pedido cancelado, stock y cupón liberados)
 *       y {@code 502}.</li>
 * </ol>
 * La idempotency key de Stripe es la del cliente: un reintento tras un corte
 * devuelve el mismo pedido y el mismo PaymentIntent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutService {

    private final OrderService orderService;
    private final PaymentService paymentService;
    private final AdminOrderService adminOrderService;
    private final StripeGateway stripeGateway;

    public OrderResponse checkout(String idempotencyKey, CheckoutRequest request, String userEmail) {
        OrderResponse order = orderService.processCheckout(idempotencyKey, request, userEmail);
        if (order.paymentStatus() != PaymentStatus.REQUIRES_PAYMENT) {
            return order; // modo sin pasarela, o pedido ya pagado/cancelado en una repetición idempotente
        }

        PaymentService.PaymentTarget target = paymentService.paymentTarget(order.orderNumber());
        // Repetición idempotente: el PaymentIntent ya existe, o el pedido ya no está
        // pendiente (p. ej. se canceló por un fallo anterior de Stripe). Nunca se
        // crea un PaymentIntent para un pedido cancelado: su stock ya se liberó.
        if (target.paymentIntentId() != null || target.status() != OrderStatus.PENDING) {
            return order;
        }

        String paymentIntentCreado = null;
        try {
            long minor = StripeAmounts.toMinor(target.total(), target.currency());
            StripeGateway.GatewayPaymentIntent pi = stripeGateway.createPaymentIntent(
                    target.orderNumber(), minor, target.currency(), target.idempotencyKey());
            paymentIntentCreado = pi.id();
            paymentService.attachPaymentIntent(target.orderNumber(), pi.id());
        } catch (RuntimeException e) {
            log.error("Checkout {}: el cobro no se pudo iniciar; se cancela el pedido ({})",
                    order.orderNumber(), e.getMessage());
            adminOrderService.cancelarPorImpago(order.orderNumber());
            anularPaymentIntentHuerfano(paymentIntentCreado, order.orderNumber());
            if (e instanceof PaymentGatewayException) {
                throw e;
            }
            throw new PaymentGatewayException("No se pudo iniciar el pago", e);
        }
        return orderService.getOrderByNumber(order.orderNumber()).orElse(order);
    }

    /**
     * Si Stripe llegó a crear el PaymentIntent y el fallo fue posterior (p. ej. al guardar su id),
     * se anula: de lo contrario quedaría abierto y huérfano, sin pedido que lo recoja.
     */
    private void anularPaymentIntentHuerfano(String paymentIntentId, String orderNumber) {
        if (paymentIntentId == null) {
            return;
        }
        try {
            stripeGateway.cancelPaymentIntent(paymentIntentId);
        } catch (RuntimeException e) {
            log.warn("Checkout {}: no se pudo anular el PaymentIntent huérfano: {}", orderNumber, e.getMessage());
        }
    }
}
