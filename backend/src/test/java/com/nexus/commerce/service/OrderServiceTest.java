package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.SkuRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private SkuRepository skuRepository;

    @Mock
    private InventoryService inventoryService;

    @Mock
    private PricingService pricingService;

    @InjectMocks
    private OrderService orderService;

    @Test
    @DisplayName("Debe procesar el checkout, reservar inventario y persistir la orden en CONFIRMED")
    void shouldProcessCheckoutSuccessfully() {
        // GIVEN
        String idempotencyKey = "key-12345";
        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 2)
        ));

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());

        when(inventoryService.reserveStock(any(ReserveStockRequest.class))).thenReturn(
                new StockReservationResponse(1L, "WH-MAD-01", 2, 8, "RESERVED")
        );

        PriceCalculationResponse price = new PriceCalculationResponse(
                1L, "ES", "EUR",
                new BigDecimal("50.00"), new BigDecimal("50.00"), false,
                new BigDecimal("41.32"), new BigDecimal("8.68"), new BigDecimal("21.00")
        );
        when(pricingService.calculatePrice(1L, "ES")).thenReturn(Optional.of(price));

        Sku sku = Sku.builder().id(1L).barcode("0432-021-M").build();
        when(skuRepository.findById(1L)).thenReturn(Optional.of(sku));

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId(100L);
            return o;
        });

        // WHEN
        OrderResponse response = orderService.processCheckout(idempotencyKey, request);

        // THEN
        assertThat(response.idempotencyKey()).isEqualTo(idempotencyKey);
        assertThat(response.status()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(response.currency()).isEqualTo("EUR");
        assertThat(response.totalAmount()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(response.taxAmount()).isEqualByComparingTo(new BigDecimal("17.36"));
        assertThat(response.items()).hasSize(1);

        verify(inventoryService).reserveStock(any(ReserveStockRequest.class));
        verify(orderRepository).save(any(Order.class));
    }

    @Test
    @DisplayName("Debe ser idempotente y no duplicar reservas si la clave ya existe")
    void shouldReturnExistingOrderWhenIdempotencyKeyMatches() {
        // GIVEN
        String idempotencyKey = "duplicate-key";
        Order existingOrder = Order.builder()
                .id(50L)
                .orderNumber("ORD-EXISTING")
                .idempotencyKey(idempotencyKey)
                .marketCode("ES")
                .currency("EUR")
                .status(OrderStatus.CONFIRMED)
                .subtotalAmount(new BigDecimal("82.64"))
                .taxAmount(new BigDecimal("17.36"))
                .totalAmount(new BigDecimal("100.00"))
                .createdAt(Instant.now())
                .build();

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.of(existingOrder));

        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 2)
        ));

        // WHEN
        OrderResponse response = orderService.processCheckout(idempotencyKey, request);

        // THEN
        assertThat(response.orderNumber()).isEqualTo("ORD-EXISTING");
        verifyNoInteractions(inventoryService);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Debe lanzar excepción si el precio no está configurado para el SKU en ese mercado")
    void shouldThrowExceptionWhenPriceNotFound() {
        // GIVEN
        String idempotencyKey = "key-error";
        CheckoutRequest request = new CheckoutRequest("US", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 1)
        ));

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(pricingService.calculatePrice(1L, "US")).thenReturn(Optional.empty());

        // WHEN & THEN
        assertThatThrownBy(() -> orderService.processCheckout(idempotencyKey, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Precio no configurado");

        verify(orderRepository, never()).save(any());
    }
}