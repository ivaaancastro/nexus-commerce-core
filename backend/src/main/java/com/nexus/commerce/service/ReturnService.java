package com.nexus.commerce.service;

import com.nexus.commerce.dto.ReturnRequest;
import com.nexus.commerce.dto.ReturnResponse;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.ProductReturn;
import com.nexus.commerce.entity.ReturnStatus;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.exception.ReturnNotAllowedException;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductReturnRepository;
import com.nexus.commerce.repository.UserRepository;
import com.nexus.commerce.service.ReturnEligibilityService.Eligibility;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Solicitudes de devolución (spec Tarea 5.4).
 *
 * <p><b>No mueve dinero.</b> El proyecto no tiene pasarela de pago: {@code refundAmount}
 * es un registro contable y el reembolso real queda fuera de alcance hasta existir un PSP.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReturnService {

    private static final int REFUND_SCALE = 2;

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final ProductReturnRepository productReturnRepository;
    private final ReturnEligibilityService eligibilityService;

    /**
     * Registra la solicitud de devolución de una línea.
     * Valida R1, R2 y R3 <b>antes</b> de persistir; si alguna falla → {@code 409}.
     */
    @Transactional
    public ReturnResponse createReturn(String email, String orderNumber, ReturnRequest request) {
        User user = requireUser(email);
        Order order = requireOwnedOrder(user, orderNumber);
        OrderItem item = requireOrderItem(order, request.orderItemId());

        Eligibility eligibility = eligibilityService.evaluate(order, item);
        if (!eligibility.eligible()) {
            log.warn("Devolución rechazada para la línea {} del pedido {}: {}",
                    item.getId(), orderNumber, eligibility.ineligibleReason());
            throw new ReturnNotAllowedException(userMessageFor(eligibility.ineligibleReason()));
        }

        ProductReturn saved;
        try {
            saved = productReturnRepository.saveAndFlush(ProductReturn.builder()
                    .orderItem(item)
                    .user(user)
                    .status(ReturnStatus.REQUESTED)
                    .reason(request.reason().trim())
                    .currency(order.getCurrency())
                    .refundAmount(refundAmount(item))
                    .build());
        } catch (DataIntegrityViolationException ex) {
            // Última línea de defensa de R3: dos peticiones simultáneas para la misma línea.
            throw new ReturnNotAllowedException("Esta línea ya tiene una devolución solicitada.");
        }

        log.info("Devolución {} solicitada para la línea {} (registro contable, sin movimiento de dinero)",
                saved.getId(), item.getId());
        return toResponse(saved);
    }

    /** Devoluciones de un pedido propiedad del usuario. Pedido ajeno o inexistente → 404. */
    @Transactional(readOnly = true)
    public List<ReturnResponse> listReturns(String email, String orderNumber) {
        User user = requireUser(email);
        Order order = requireOwnedOrder(user, orderNumber);

        return productReturnRepository.findByOrderItemOrderId(order.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * R5: {@code refundAmount = unitPrice × quantity}, en {@code BigDecimal} con
     * {@code HALF_UP} y escala 2 (regla #4 — nunca {@code double}/{@code float}).
     *
     * <p><b>El impuesto NO se suma aparte.</b> {@code unit_price} guarda el PVP
     * <b>con IVA incluido</b>: en el checkout {@code unitPrice = finalPrice()} y
     * {@code subtotal += unitPrice×qty − taxAmount}, de modo que
     * {@code unitPrice × quantity} es ya el bruto que el cliente pagó por la
     * línea (su {@code totalAmount}). Sumar además {@code taxAmount} habría
     * contabilizado el IVA dos veces y declarado devolver más de lo cobrado.</p>
     */
    private BigDecimal refundAmount(OrderItem item) {
        return item.getUnitPrice()
                .multiply(new BigDecimal(item.getQuantity()))
                .setScale(REFUND_SCALE, RoundingMode.HALF_UP);
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    }

    /** R10: un pedido de otro usuario debe devolver 404, nunca 403. */
    private Order requireOwnedOrder(User user, String orderNumber) {
        return orderRepository.findByUserIdAndOrderNumber(user.getId(), orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Pedido no encontrado"));
    }

    /** Un {@code orderItemId} ajeno al pedido → 404. */
    private OrderItem requireOrderItem(Order order, Long orderItemId) {
        return order.getItems().stream()
                .filter(item -> item.getId().equals(orderItemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Línea de pedido no encontrada"));
    }

    private String userMessageFor(String reason) {
        if (ReturnEligibilityService.REASON_NOT_DELIVERED.equals(reason)) {
            return "Solo se pueden devolver los pedidos que ya han sido entregados.";
        }
        if (ReturnEligibilityService.REASON_EXPIRED.equals(reason)) {
            return "Ha pasado el plazo de 30 días desde la compra.";
        }
        return "Esta línea ya tiene una devolución solicitada.";
    }

    private ReturnResponse toResponse(ProductReturn productReturn) {
        OrderItem item = productReturn.getOrderItem();
        return new ReturnResponse(
                productReturn.getId(),
                item.getId(),
                item.getSku().getBarcode(),
                productReturn.getStatus(),
                productReturn.getReason(),
                productReturn.getCurrency(),
                productReturn.getRefundAmount(),
                productReturn.getRequestedAt()
        );
    }
}
