package com.nexus.commerce.service;

import com.nexus.commerce.dto.RefundRequest;
import com.nexus.commerce.dto.RefundResponse;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.exception.RefundNotAllowedException;
import com.nexus.commerce.exception.PaymentIntentCreationException;
import com.nexus.commerce.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Servicio para iniciar reembolsos en modo test de Stripe.
 * 
 * Decisión de diseño (Fase 9, R8.3):
 - Requiere @Transactional para atomicidad con la BD
 - Valida que el pedido está en estado CONFIRMED antes de reembolsar
 - Lanza RefundNotAllowedException si el estado no permite reembolso
 - Lanza PaymentIntentCreationException si Stripe falla
 - Usa el PaymentIntentId existente de la orden para crear el refund
 */
@Service
@RequiredArgsConstructor
public class RefundService {

    private static final Logger log = LoggerFactory.getLogger(RefundService.class);

    private final OrderRepository orderRepository;

    @Value("${stripe.secret-key:sk_test_placeholder}")
    private String stripeSecretKey;

    /**
     * Inicia un reembolso para un pedido.
     * 
     * Flujo:
     * 1. Validar que el pedido está en estado CONFIRMED (solo este estado permite reembolso)
     * 2. Calcular el amount a reembolsar (si es null, es reembolso total)
     * 3. Crear refund en Stripe test mode via SDK
     * 4. Actualizar la orden con los datos del refund
     * 5. Retornar response con los datos del refund
     * 
     * @param orderNumber Número de orden a reembolsar
     * @param request DTO con amount (opcional, null = total) y reason
     * @return RefundResponse con los datos del refund creado
     * @throws RefundNotAllowedException si el pedido no está en estado CONFIRMED
     * @throws PaymentIntentCreationException si Stripe falla creando el refund
     */
    @Transactional
    public RefundResponse initiateRefund(String orderNumber, RefundRequest request) {
        // 1. Buscar la orden por número
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        // 2. Validar que el pedido está en estado que permite reembolso
        // Según la máquina de transiciones: solo CONFIRMED → refund es directo
        if (order.getStatus() != OrderStatus.CONFIRMED) {
            log.warn("Attempted refund on order {} in state {}", orderNumber, order.getStatus());
            throw new RefundNotAllowedException(order.getStatus().name());
        }

        // 3. Calcular el amount a reembolsar
        BigDecimal refundAmount;
        if (request.getAmount() == null) {
            // Reembolso total: usar el total de la orden
            refundAmount = order.getTotalAmount();
        } else {
            // Reembolso parcial: validar que no sea mayor que el total
            refundAmount = request.getAmount();
            if (refundAmount.compareTo(order.getTotalAmount()) > 0) {
                throw new PaymentIntentCreationException(
                        "El amount del reembolso no puede ser mayor que el total de la orden: " + order.getTotalAmount());
            }
        }

        // 4. Crear refund en Stripe test mode
        // TODO: Cuando el Stripe Java SDK esté disponible, descomentar y usar:
        // Stripe.apiKey = stripeSecretKey;
        // RefundCreateParams params = RefundCreateParams.builder()
        //         .setAmount(refundAmount.multiply(BigDecimal.valueOf(100)).intValueExact())
        //         .setReason(request.getReason())
        //         .build();
        // Refund refund = Refund.create(params);

        // Por mientras, simular el refund exitoso
        String simulatedRefundId = "re_test_" + UUID.randomUUID();
        String simulatedChargeId = "ch_test_" + UUID.randomUUID();

        log.info("Simulated refund created in Stripe: refund={}, charge={}, order={}",
                simulatedRefundId, simulatedChargeId, orderNumber);

        // 5. Actualizar la orden con los datos del refund
        order.setRefundStatus("REFUNDED");
        order.setAmountRefunded(refundAmount);
        orderRepository.save(order);

        log.info("Orden {} actualizada con refund: amount={}, status=REFUNDED", orderNumber, refundAmount);

        // 6. Retornar response
        return new RefundResponse(
                simulatedRefundId,
                refundAmount,
                order.getCurrency(),
                "succeeded",
                simulatedChargeId
        );
    }
}