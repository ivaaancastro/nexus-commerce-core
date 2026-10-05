package com.nexus.commerce.service;

import com.nexus.commerce.dto.ReturnRequest;
import com.nexus.commerce.dto.ReturnResponse;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.ProductReturn;
import com.nexus.commerce.entity.ReturnStatus;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.exception.ReturnNotAllowedException;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductReturnRepository;
import com.nexus.commerce.repository.UserRepository;
import com.nexus.commerce.service.ReturnEligibilityService.Eligibility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link ReturnService} — spec Tarea 5.4: R4 (solicitud), R5 (importes),
 * R7 (listado) y R10 (propiedad).
 */
@ExtendWith(MockitoExtension.class)
class ReturnServiceTest {

    private static final String EMAIL = "ana@example.com";
    private static final String ORDER_NUMBER = "ORD-001";
    private static final Long ITEM_ID = 55L;

    @Mock
    private UserRepository userRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ProductReturnRepository productReturnRepository;

    @Mock
    private ReturnEligibilityService eligibilityService;

    @InjectMocks
    private ReturnService returnService;

    // ------------------------------------------------------------ R4 + R5

    @Test
    @DisplayName("R5 - refundAmount = unitPrice × qty, HALF_UP y escala 2")
    void shouldCalculateRefundAmountWithHalfUp() {
        OrderItem item = item(ITEM_ID, new BigDecimal("33.335"), 1, new BigDecimal("0.00"));
        stubOrderOwnedWith(item);
        stubEligible(item);
        stubPersist();

        ReturnResponse response = returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(ITEM_ID, "Talla incorrecta"));

        // 33,335 con HALF_UP a 2 decimales → 33,34 (nunca con double/float — regla #4)
        assertThat(response.refundAmount()).isEqualByComparingTo("33.34");
        assertThat(response.refundAmount().scale()).isEqualTo(2);
        assertThat(response.currency()).isEqualTo("EUR");
    }

    @Test
    @DisplayName("R5 - No vuelve a sumar el IVA: unit_price ya lo incluye (bug corregido el 2026-10-05)")
    void shouldNotAddTaxAgain() {
        // Réplica del pedido ORD-AF7D70AD: PVP 79,95 con 13,88 de IVA ya incluido
        // (subtotal 66,07 + IVA 13,88 = 79,95). Con la fórmula antigua declaraba 93,83.
        OrderItem item = item(ITEM_ID, new BigDecimal("79.95"), 1, new BigDecimal("13.88"));
        stubOrderOwnedWith(item);
        stubEligible(item);
        stubPersist();

        ReturnResponse response = returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(ITEM_ID, "Talla incorrecta"));

        assertThat(response.refundAmount()).isEqualByComparingTo("79.95");
        assertThat(response.refundAmount()).isNotEqualByComparingTo("93.83");
    }

    @Test
    @DisplayName("R4 - Persiste con estado REQUESTED y recorta el motivo")
    void shouldPersistAsRequestedAndTrimReason() {
        OrderItem item = item(ITEM_ID, new BigDecimal("25.00"), 1, new BigDecimal("5.25"));
        stubOrderOwnedWith(item);
        stubEligible(item);
        stubPersist();

        ReturnResponse response = returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(ITEM_ID, "  Se quedó grande  "));

        assertThat(response.status()).isEqualTo(ReturnStatus.REQUESTED);
        assertThat(response.reason()).isEqualTo("Se quedó grande");
        assertThat(response.skuCode()).isEqualTo("SKU-55");
    }

    // ------------------------------------------------------------- errores

    @Test
    @DisplayName("R1 - Línea fuera del plazo → 409 con mensaje de plazo agotado")
    void shouldRejectWhenExpired() {
        OrderItem item = item(ITEM_ID, new BigDecimal("25.00"), 1, new BigDecimal("0.00"));
        stubOrderOwnedWith(item);
        when(eligibilityService.evaluate(any(Order.class), any(OrderItem.class)))
                .thenReturn(new Eligibility(false, ReturnEligibilityService.REASON_EXPIRED));

        assertThatThrownBy(() -> returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(ITEM_ID, "Talla incorrecta")))
                .isInstanceOf(ReturnNotAllowedException.class)
                .hasMessage("Ha pasado el plazo de 30 días desde la compra.");

        verify(productReturnRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("R2 - Pedido no entregado → 409")
    void shouldRejectWhenOrderIsNotDelivered() {
        OrderItem item = item(ITEM_ID, new BigDecimal("25.00"), 1, new BigDecimal("0.00"));
        stubOrderOwnedWith(item);
        when(eligibilityService.evaluate(any(Order.class), any(OrderItem.class)))
                .thenReturn(new Eligibility(false, ReturnEligibilityService.REASON_NOT_DELIVERED));

        assertThatThrownBy(() -> returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(ITEM_ID, "Talla incorrecta")))
                .isInstanceOf(ReturnNotAllowedException.class)
                .hasMessageContaining("entregados");
    }

    @Test
    @DisplayName("R3 - Última línea de defensa: el UNIQUE de BD también se traduce a 409")
    void shouldTranslateUniqueViolationToConflict() {
        OrderItem item = item(ITEM_ID, new BigDecimal("25.00"), 1, new BigDecimal("0.00"));
        stubOrderOwnedWith(item);
        stubEligible(item);
        when(productReturnRepository.saveAndFlush(any(ProductReturn.class)))
                .thenThrow(new DataIntegrityViolationException("uq_return_per_item"));

        assertThatThrownBy(() -> returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(ITEM_ID, "Talla incorrecta")))
                .isInstanceOf(ReturnNotAllowedException.class)
                .hasMessage("Esta línea ya tiene una devolución solicitada.");
    }

    // ---------------------------------------------------------- propiedad

    @Test
    @DisplayName("R10 - Pedido de otro usuario → 404")
    void shouldReturn404WhenOrderBelongsToAnotherUser() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user()));
        when(orderRepository.findByUserIdAndOrderNumber(7L, ORDER_NUMBER))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(ITEM_ID, "Talla incorrecta")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("R10 - orderItemId ajeno al pedido → 404")
    void shouldReturn404WhenOrderItemIdIsNotFromOrder() {
        stubOrderOwnedWith(item(ITEM_ID, new BigDecimal("25.00"), 1, new BigDecimal("0.00")));

        assertThatThrownBy(() -> returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(999L, "Talla incorrecta")))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(productReturnRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("R10 - Usuario inexistente → 404")
    void shouldReturn404WhenUserDoesNotExist() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> returnService.createReturn(
                EMAIL, ORDER_NUMBER, new ReturnRequest(ITEM_ID, "Talla incorrecta")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ------------------------------------------------------------------ R7

    @Test
    @DisplayName("R7 - El listado devuelve las devoluciones del pedido")
    void shouldListReturnsOfOrder() {
        OrderItem item = item(ITEM_ID, new BigDecimal("25.00"), 1, new BigDecimal("0.00"));
        stubOrderOwnedWith(item);

        ProductReturn productReturn = ProductReturn.builder()
                .id(10L)
                .orderItem(item)
                .user(user())
                .status(ReturnStatus.REQUESTED)
                .reason("Talla incorrecta")
                .currency("EUR")
                .refundAmount(new BigDecimal("25.00"))
                .requestedAt(Instant.now())
                .build();
        when(productReturnRepository.findByOrderItemOrderId(1L)).thenReturn(List.of(productReturn));

        List<ReturnResponse> returns = returnService.listReturns(EMAIL, ORDER_NUMBER);

        assertThat(returns).hasSize(1);
        assertThat(returns.get(0).orderItemId()).isEqualTo(ITEM_ID);
        assertThat(returns.get(0).skuCode()).isEqualTo("SKU-55");
        assertThat(returns.get(0).refundAmount()).isEqualByComparingTo("25.00");
    }

    @Test
    @DisplayName("R7 - Pedido sin devoluciones → lista vacía")
    void shouldReturnEmptyListWhenThereAreNoReturns() {
        stubOrderOwnedWith(item(ITEM_ID, new BigDecimal("25.00"), 1, new BigDecimal("0.00")));
        when(productReturnRepository.findByOrderItemOrderId(1L)).thenReturn(List.of());

        assertThat(returnService.listReturns(EMAIL, ORDER_NUMBER)).isEmpty();
    }

    // ------------------------------------------------------------- helpers

    private User user() {
        User user = new User();
        user.setId(7L);
        user.setEmail(EMAIL);
        return user;
    }

    private Sku sku(String barcode) {
        Sku sku = new Sku();
        sku.setBarcode(barcode);
        return sku;
    }

    private OrderItem item(Long id, BigDecimal unitPrice, int quantity, BigDecimal taxAmount) {
        OrderItem item = new OrderItem();
        item.setId(id);
        item.setUnitPrice(unitPrice);
        item.setQuantity(quantity);
        item.setTaxAmount(taxAmount);
        item.setSku(sku("SKU-" + id));
        return item;
    }

    private Order orderWith(OrderItem... items) {
        Order order = new Order();
        order.setId(1L);
        order.setCurrency("EUR");
        order.setItems(new ArrayList<>(List.of(items)));
        return order;
    }

    /** Simula un pedido propiedad del usuario logueado. */
    private void stubOrderOwnedWith(OrderItem... items) {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user()));
        when(orderRepository.findByUserIdAndOrderNumber(7L, ORDER_NUMBER))
                .thenReturn(Optional.of(orderWith(items)));
    }

    private void stubEligible(OrderItem item) {
        when(eligibilityService.evaluate(any(Order.class), org.mockito.ArgumentMatchers.eq(item)))
                .thenReturn(new Eligibility(true, null));
    }

    /** Hibernate asigna id y fecha de creación al persistir. */
    private void stubPersist() {
        when(productReturnRepository.saveAndFlush(any(ProductReturn.class))).thenAnswer(invocation -> {
            ProductReturn created = invocation.getArgument(0);
            created.setId(10L);
            created.setRequestedAt(Instant.now());
            return created;
        });
    }
}
