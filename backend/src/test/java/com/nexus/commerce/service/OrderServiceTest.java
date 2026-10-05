package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

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
    private UserRepository userRepository;

    @Mock
    private InventoryService inventoryService;

    @Mock
    private PricingService pricingService;

    @Mock
    private WarehouseSelectionService warehouseSelectionService;

    @InjectMocks
    private OrderService orderService;

    @Test
    @DisplayName("Debe procesar el checkout, reservar inventario y persistir la orden en CONFIRMED")
    void shouldProcessCheckoutSuccessfully() {
        // GIVEN
        String idempotencyKey = "key-12345";
        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 2)
        ), "ES", 40.4168, -3.7038);

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());

        when(warehouseSelectionService.selectOptimalWarehouse(any(), any(), any(), any()))
                .thenReturn("WH-MAD-01");

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

        // WHEN — sin sesión: checkout de invitado
        OrderResponse response = orderService.processCheckout(idempotencyKey, request, null);

        // THEN
        assertThat(response.idempotencyKey()).isEqualTo(idempotencyKey);
        assertThat(response.status()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(response.currency()).isEqualTo("EUR");
        assertThat(response.totalAmount()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(response.taxAmount()).isEqualByComparingTo(new BigDecimal("17.36"));
        assertThat(response.items()).hasSize(1);

        verify(inventoryService).reserveStock(any(ReserveStockRequest.class));

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isNull();
    }

    @Test
    @DisplayName("Debe asociar el usuario autenticado al pedido creado")
    void shouldAssociateAuthenticatedUserToOrder() {
        // GIVEN
        String idempotencyKey = "key-user";
        String email = "ana@nexus.dev";
        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 1)
        ), "ES", 40.4168, -3.7038);

        User user = User.builder().id(7L).email(email).build();

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(warehouseSelectionService.selectOptimalWarehouse(any(), any(), any(), any()))
                .thenReturn("WH-MAD-01");
        when(inventoryService.reserveStock(any(ReserveStockRequest.class))).thenReturn(
                new StockReservationResponse(1L, "WH-MAD-01", 1, 9, "RESERVED")
        );
        when(pricingService.calculatePrice(1L, "ES")).thenReturn(Optional.of(new PriceCalculationResponse(
                1L, "ES", "EUR",
                new BigDecimal("50.00"), new BigDecimal("50.00"), false,
                new BigDecimal("41.32"), new BigDecimal("8.68"), new BigDecimal("21.00")
        )));
        when(skuRepository.findById(1L)).thenReturn(Optional.of(Sku.builder().id(1L).build()));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId(100L);
            return o;
        });

        // WHEN
        orderService.processCheckout(idempotencyKey, request, email);

        // THEN
        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isSameAs(user);
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
        ), "ES", 40.4168, -3.7038);

        // WHEN
        OrderResponse response = orderService.processCheckout(idempotencyKey, request, null);

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
        ), "ES", 40.4168, -3.7038);

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(warehouseSelectionService.selectOptimalWarehouse(any(), any(), any(), any()))
                .thenReturn("WH-MAD-01");
        when(pricingService.calculatePrice(1L, "US")).thenReturn(Optional.empty());

        // WHEN & THEN
        assertThatThrownBy(() -> orderService.processCheckout(idempotencyKey, request, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Precio no configurado");

        verify(orderRepository, never()).save(any());
    }

    // ── Historial de pedidos ────────────────────────────────────────────────

    @Test
    @DisplayName("Debe listar los pedidos del usuario paginados con su número de artículos")
    void shouldListUserOrdersPaginated() {
        // GIVEN
        String email = "ana@nexus.dev";
        User user = User.builder().id(7L).email(email).build();

        Order order = Order.builder()
                .id(1L)
                .orderNumber("ORD-001")
                .status(OrderStatus.DELIVERED)
                .currency("EUR")
                .totalAmount(new BigDecimal("50.00"))
                .createdAt(Instant.now())
                .items(List.of(new OrderItem(), new OrderItem()))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(eq(7L), any()))
                .thenReturn(new PageImpl<>(List.of(order), PageRequest.of(0, 20), 1));

        // WHEN
        OrderPageResponse page = orderService.listOrders(email, 0, 20);

        // THEN
        assertThat(page.orders()).hasSize(1);
        assertThat(page.page()).isZero();
        assertThat(page.size()).isEqualTo(20);
        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.totalPages()).isEqualTo(1);

        OrderSummaryResponse summary = page.orders().get(0);
        assertThat(summary.orderNumber()).isEqualTo("ORD-001");
        assertThat(summary.status()).isEqualTo(OrderStatus.DELIVERED);
        assertThat(summary.totalAmount()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(summary.itemCount()).isEqualTo(2);

        verify(orderRepository).findByUserIdOrderByCreatedAtDesc(eq(7L), any());
    }

    @Test
    @DisplayName("Debe pedir a la base de datos los pedidos ordenados por fecha descendente")
    void shouldRequestOrdersSortedByDateDescending() {
        // GIVEN
        String email = "ana@nexus.dev";
        when(userRepository.findByEmail(email))
                .thenReturn(Optional.of(User.builder().id(7L).email(email).build()));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(eq(7L), any()))
                .thenReturn(Page.empty());

        // WHEN
        OrderPageResponse page = orderService.listOrders(email, 3, 20);

        // THEN — PageRequest recibe la página pedida; el orden DESC lo deriva
        // Spring Data del nombre del método `findByUserIdOrderByCreatedAtDesc`.
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(orderRepository).findByUserIdOrderByCreatedAtDesc(eq(7L), captor.capture());
        assertThat(captor.getValue().getPageNumber()).isEqualTo(3);
        assertThat(captor.getValue().getPageSize()).isEqualTo(20);
        assertThat(page.orders()).isEmpty();
        assertThat(page.totalElements()).isZero();
    }

    @Test
    @DisplayName("Debe devolver lista vacía si el usuario no tiene pedidos")
    void shouldReturnEmptyListWhenUserHasNoOrders() {
        // GIVEN
        String email = "nuevo@nexus.dev";
        when(userRepository.findByEmail(email))
                .thenReturn(Optional.of(User.builder().id(9L).email(email).build()));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(eq(9L), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        // WHEN
        OrderPageResponse page = orderService.listOrders(email, 0, 20);

        // THEN
        assertThat(page.orders()).isEmpty();
        assertThat(page.totalElements()).isZero();
        assertThat(page.totalPages()).isZero();
    }

    @Test
    @DisplayName("Debe devolver el detalle de un pedido propiedad del usuario")
    void shouldGetOrderOwnedByUser() {
        // GIVEN
        String email = "ana@nexus.dev";
        String orderNumber = "ORD-001";
        User user = User.builder().id(7L).email(email).build();

        Order order = Order.builder()
                .id(1L)
                .orderNumber(orderNumber)
                .idempotencyKey("k")
                .marketCode("ES")
                .currency("EUR")
                .status(OrderStatus.DELIVERED)
                .subtotalAmount(new BigDecimal("41.32"))
                .taxAmount(new BigDecimal("8.68"))
                .totalAmount(new BigDecimal("50.00"))
                .createdAt(Instant.now())
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(orderRepository.findByUserIdAndOrderNumber(7L, orderNumber))
                .thenReturn(Optional.of(order));

        // WHEN
        Optional<OrderResponse> result = orderService.getOrderForUser(email, orderNumber);

        // THEN
        assertThat(result).isPresent();
        assertThat(result.get().orderNumber()).isEqualTo(orderNumber);
        assertThat(result.get().status()).isEqualTo(OrderStatus.DELIVERED);
        verify(orderRepository).findByUserIdAndOrderNumber(7L, orderNumber);
    }

    @Test
    @DisplayName("Debe devolver vacío si el pedido es de otro usuario")
    void shouldReturnEmptyWhenOrderBelongsToAnotherUser() {
        // GIVEN — la propiedad se comprueba en la consulta, así que llega vacío
        String email = "ana@nexus.dev";
        when(userRepository.findByEmail(email))
                .thenReturn(Optional.of(User.builder().id(7L).email(email).build()));
        when(orderRepository.findByUserIdAndOrderNumber(7L, "ORD-AJENO"))
                .thenReturn(Optional.empty());

        // WHEN
        Optional<OrderResponse> result = orderService.getOrderForUser(email, "ORD-AJENO");

        // THEN
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Debe devolver vacío si el usuario del token ya no existe")
    void shouldReturnEmptyWhenUserDoesNotExist() {
        // GIVEN
        when(userRepository.findByEmail("fantasma@nexus.dev")).thenReturn(Optional.empty());

        // WHEN
        Optional<OrderResponse> result =
                orderService.getOrderForUser("fantasma@nexus.dev", "ORD-001");

        // THEN
        assertThat(result).isEmpty();
        verify(orderRepository, never()).findByUserIdAndOrderNumber(any(), any());
    }
}