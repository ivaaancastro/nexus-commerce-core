package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Address;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.PaymentMethod;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.AddressRepository;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductReturnRepository;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
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
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
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
    private AddressRepository addressRepository;

    @Mock
    private ProductReturnRepository productReturnRepository;

    @Mock
    private InventoryService inventoryService;

    @Mock
    private PricingService pricingService;

    @Mock
    private WarehouseSelectionService warehouseSelectionService;

    @Mock
    private ReturnEligibilityService returnEligibilityService;

    @InjectMocks
    private OrderService orderService;

    @BeforeEach
    void stubReturnEligibility() {
        // mapToOrderResponse enriquece cada línea con su elegibilidad de devolución
        // (spec Tarea 5.4, §2.2). Ningún pedido de estos tests está DELIVERED.
        // lenient() porque no todos los tests llegan al mapeo del detalle.
        lenient().when(returnEligibilityService.evaluate(any(Order.class), any(OrderItem.class)))
                .thenReturn(new ReturnEligibilityService.Eligibility(false, "NOT_DELIVERED"));
    }

    /** Dirección de prueba: el checkout exige que pertenezca al usuario (Tarea 5.5, R1). */
    private static final Long ADDRESS_ID = 5L;

    private static final long USER_ID = 7L;

    private Address validAddress() {
        return Address.builder()
                .fullName("Ana Castro")
                .street("Calle Mayor 1")
                .city("Madrid")
                .postalCode("28013")
                .countryCode("ES")
                .build();
    }

    /**
     * SKU con producto: el mapeo del detalle recorre {@code Sku → Product} para
     * pintar nombre y variantes (Tarea 5.5, R3), así que un SKU sin producto
     * revienta con NPE.
     */
    private Sku skuWithProduct(Long id, String barcode) {
        return Sku.builder()
                .id(id)
                .barcode(barcode)
                .size("M")
                .color("Blanco")
                .product(Product.builder().id(3L).name("Camisa Oxford").family("Camisas").build())
                .build();
    }

    @Test
    @DisplayName("Debe procesar el checkout, reservar inventario y persistir la orden en CONFIRMED")
    void shouldProcessCheckoutSuccessfully() {
        // GIVEN — el checkout exige sesión desde el PR #13 y, desde la Tarea 5.5,
        // una dirección de envío que pertenezca a ese usuario (R1).
        String idempotencyKey = "key-12345";
        String email = "ana@nexus.dev";
        User user = User.builder().id(USER_ID).email(email).build();

        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 2)
        ), "ES", 40.4168, -3.7038, ADDRESS_ID, PaymentMethod.CARD);

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(addressRepository.findByIdAndUserId(ADDRESS_ID, USER_ID))
                .thenReturn(Optional.of(validAddress()));

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

        when(skuRepository.findById(1L)).thenReturn(Optional.of(skuWithProduct(1L, "0432-021-M")));

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId(100L);
            return o;
        });

        // WHEN
        OrderResponse response = orderService.processCheckout(idempotencyKey, request, email);

        // THEN
        assertThat(response.idempotencyKey()).isEqualTo(idempotencyKey);
        assertThat(response.status()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(response.currency()).isEqualTo("EUR");
        assertThat(response.totalAmount()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(response.taxAmount()).isEqualByComparingTo(new BigDecimal("17.36"));
        assertThat(response.items()).hasSize(1);

        // R1: snapshot de envío copiado a la orden
        assertThat(response.shippingAddress()).isNotNull();
        assertThat(response.shippingAddress().city()).isEqualTo("Madrid");
        assertThat(response.shippingAddress().postalCode()).isEqualTo("28013");

        // R2: método de pago declarado, no procesado
        assertThat(response.paymentMethod()).isEqualTo(PaymentMethod.CARD);

        // R3: nombre y variantes resueltos vía Sku → Product
        assertThat(response.items().get(0).productName()).isEqualTo("Camisa Oxford");
        assertThat(response.items().get(0).productFamily()).isEqualTo("Camisas");
        assertThat(response.items().get(0).size()).isEqualTo("M");
        assertThat(response.items().get(0).color()).isEqualTo("Blanco");

        verify(inventoryService).reserveStock(any(ReserveStockRequest.class));

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isSameAs(user);
        assertThat(captor.getValue().getPaymentMethod()).isEqualTo(PaymentMethod.CARD);
    }

    @Test
    @DisplayName("Debe asociar el usuario autenticado al pedido creado")
    void shouldAssociateAuthenticatedUserToOrder() {
        // GIVEN
        String idempotencyKey = "key-user";
        String email = "ana@nexus.dev";
        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 1)
        ), "ES", 40.4168, -3.7038, ADDRESS_ID, PaymentMethod.BIZUM);

        User user = User.builder().id(USER_ID).email(email).build();

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(addressRepository.findByIdAndUserId(ADDRESS_ID, USER_ID))
                .thenReturn(Optional.of(validAddress()));
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
        when(skuRepository.findById(1L)).thenReturn(Optional.of(skuWithProduct(1L, "0432-021-M")));
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
        assertThat(captor.getValue().getShippingAddress()).isNotNull();
        assertThat(captor.getValue().getShippingAddress().getCountryCode()).isEqualTo("ES");
        assertThat(captor.getValue().getPaymentMethod()).isEqualTo(PaymentMethod.BIZUM);
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
        ), "ES", 40.4168, -3.7038, ADDRESS_ID, PaymentMethod.CARD);

        // WHEN — la clave corta el flujo ANTES de resolver la dirección
        OrderResponse response = orderService.processCheckout(idempotencyKey, request, null);

        // THEN
        assertThat(response.orderNumber()).isEqualTo("ORD-EXISTING");
        verifyNoInteractions(inventoryService);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Debe lanzar excepción si el precio no está configurado para el SKU en ese mercado")
    void shouldThrowExceptionWhenPriceNotFound() {
        // GIVEN — la dirección se resuelve ANTES de buscar precio, así que hace
        // falta un usuario con dirección válida para llegar al fallo de precios.
        String idempotencyKey = "key-error";
        String email = "ana@nexus.dev";
        CheckoutRequest request = new CheckoutRequest("US", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 1)
        ), "ES", 40.4168, -3.7038, ADDRESS_ID, PaymentMethod.PAYPAL);

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(userRepository.findByEmail(email))
                .thenReturn(Optional.of(User.builder().id(USER_ID).email(email).build()));
        when(addressRepository.findByIdAndUserId(ADDRESS_ID, USER_ID))
                .thenReturn(Optional.of(validAddress()));
        when(warehouseSelectionService.selectOptimalWarehouse(any(), any(), any(), any()))
                .thenReturn("WH-MAD-01");
        when(pricingService.calculatePrice(1L, "US")).thenReturn(Optional.empty());

        // WHEN & THEN
        assertThatThrownBy(() -> orderService.processCheckout(idempotencyKey, request, email))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Precio no configurado");

        verify(orderRepository, never()).save(any());
    }

    // ── Historial de pedidos ────────────────────────────────────────────────

    @Test
    @DisplayName("Debe listar los pedidos del usuario paginados con sus líneas y su badge")
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
                .items(List.of(sampleItem(51L), sampleItem(52L)))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(eq(7L), any()))
                .thenReturn(new PageImpl<>(List.of(order), PageRequest.of(0, 20), 1));
        // R10: UNA consulta por página, con todos los identificadores de golpe
        when(productReturnRepository.findOrderItemIdIn(List.of(51L, 52L)))
                .thenReturn(List.of(52L));

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

        // R9: nombre y variante para pintar la tarjeta del historial
        assertThat(summary.items()).hasSize(2);
        assertThat(summary.items().get(0).productName()).isEqualTo("Camisa Oxford");
        assertThat(summary.items().get(0).productFamily()).isEqualTo("Camisas");
        assertThat(summary.items().get(0).size()).isEqualTo("M");
        assertThat(summary.items().get(0).color()).isEqualTo("Blanco");
        assertThat(summary.items().get(0).quantity()).isEqualTo(1);

        // R10: la línea 52 tiene devolución → la tarjeta lleva el badge
        assertThat(summary.returnRequested()).isTrue();

        // R10: una sola consulta, no una por línea
        verify(productReturnRepository, times(1)).findOrderItemIdIn(anyCollection());

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
    @DisplayName("Debe enriquecer el detalle con la elegibilidad de devolución (spec 5.4, §2.2)")
    void shouldEnrichDetailWithReturnEligibility() {
        // GIVEN
        String email = "ana@nexus.dev";
        String orderNumber = "ORD-001";
        User user = User.builder().id(7L).email(email).build();

        OrderItem item = OrderItem.builder()
                .id(55L)
                .warehouseCode("MAD-01")
                .quantity(1)
                .unitPrice(new BigDecimal("50.00"))
                .taxRate(new BigDecimal("21.00"))
                .taxAmount(new BigDecimal("10.50"))
                .totalAmount(new BigDecimal("60.50"))
                .sku(skuWithProduct(9L, "SKU-55"))
                .build();

        Order order = Order.builder()
                .id(1L)
                .orderNumber(orderNumber)
                .idempotencyKey("k")
                .marketCode("ES")
                .currency("EUR")
                .status(OrderStatus.DELIVERED)
                .subtotalAmount(new BigDecimal("50.00"))
                .taxAmount(new BigDecimal("10.50"))
                .totalAmount(new BigDecimal("60.50"))
                .createdAt(Instant.now())
                .items(List.of(item))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(orderRepository.findByUserIdAndOrderNumber(7L, orderNumber))
                .thenReturn(Optional.of(order));
        when(returnEligibilityService.evaluate(order, item))
                .thenReturn(new ReturnEligibilityService.Eligibility(true, null));

        // WHEN
        Optional<OrderResponse> result = orderService.getOrderForUser(email, orderNumber);

        // THEN
        assertThat(result.get().items()).hasSize(1);
        assertThat(result.get().items().get(0).returnEligible()).isTrue();
        assertThat(result.get().items().get(0).returnIneligibleReason()).isNull();
        verify(returnEligibilityService).evaluate(order, item);
    }

    @Test
    @DisplayName("Debe informar el motivo de inelegibilidad cuando la línea no puede devolverse")
    void shouldReportIneligibleReasonInDetail() {
        // GIVEN — misma línea, pero el servicio determina que no es devolvible
        String email = "ana@nexus.dev";
        String orderNumber = "ORD-002";
        User user = User.builder().id(7L).email(email).build();

        OrderItem item = OrderItem.builder()
                .id(55L)
                .warehouseCode("MAD-01")
                .quantity(1)
                .unitPrice(new BigDecimal("50.00"))
                .taxRate(new BigDecimal("21.00"))
                .taxAmount(new BigDecimal("10.50"))
                .totalAmount(new BigDecimal("60.50"))
                .sku(skuWithProduct(9L, "SKU-55"))
                .build();

        Order order = Order.builder()
                .id(2L)
                .orderNumber(orderNumber)
                .idempotencyKey("k2")
                .marketCode("ES")
                .currency("EUR")
                .status(OrderStatus.DELIVERED)
                .subtotalAmount(new BigDecimal("50.00"))
                .taxAmount(new BigDecimal("10.50"))
                .totalAmount(new BigDecimal("60.50"))
                .createdAt(Instant.now())
                .items(List.of(item))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(orderRepository.findByUserIdAndOrderNumber(7L, orderNumber))
                .thenReturn(Optional.of(order));
        when(returnEligibilityService.evaluate(order, item))
                .thenReturn(new ReturnEligibilityService.Eligibility(false, "EXPIRED"));

        // WHEN
        Optional<OrderResponse> result = orderService.getOrderForUser(email, orderNumber);

        // THEN
        assertThat(result.get().items().get(0).returnEligible()).isFalse();
        assertThat(result.get().items().get(0).returnIneligibleReason()).isEqualTo("EXPIRED");
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

    // ── Tarea 5.5 ───────────────────────────────────────────────────────────

    /** Línea con producto, apta para el mapeo del resumen del historial (R9). */
    private OrderItem sampleItem(Long id) {
        return OrderItem.builder()
                .id(id)
                .warehouseCode("MAD-01")
                .quantity(1)
                .unitPrice(new BigDecimal("50.00"))
                .taxRate(new BigDecimal("21.00"))
                .taxAmount(new BigDecimal("10.50"))
                .totalAmount(new BigDecimal("60.50"))
                .sku(skuWithProduct(9L, "SKU-55"))
                .build();
    }

    /** Pedido mínimo con una línea, apto para el mapeo del detalle (R3). */
    private Order sampleOrder(Instant createdAt) {
        return Order.builder()
                .id(1L)
                .orderNumber("ORD-001")
                .idempotencyKey("k")
                .marketCode("ES")
                .currency("EUR")
                .status(OrderStatus.DELIVERED)
                .subtotalAmount(new BigDecimal("50.00"))
                .taxAmount(new BigDecimal("10.50"))
                .totalAmount(new BigDecimal("60.50"))
                .createdAt(createdAt)
                .items(List.of(sampleItem(55L)))
                .build();
    }

    private void stubOwnedOrder(Order order) {
        String email = "ana@nexus.dev";
        when(userRepository.findByEmail(email))
                .thenReturn(Optional.of(User.builder().id(USER_ID).email(email).build()));
        when(orderRepository.findByUserIdAndOrderNumber(USER_ID, "ORD-001"))
                .thenReturn(Optional.of(order));
    }

    @Test
    @DisplayName("R1 - Debe rechazar el checkout si la dirección es de otro usuario o no existe")
    void shouldRejectCheckoutWhenAddressIsNotOwnedByUser() {
        // GIVEN — findByIdAndUserId devuelve vacío tanto si no existe como si es
        // de otro usuario: un único 400 que además no filtra direcciones ajenas.
        String idempotencyKey = "key-addr";
        String email = "ana@nexus.dev";
        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 1)
        ), "ES", 40.4168, -3.7038, ADDRESS_ID, PaymentMethod.CARD);

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(userRepository.findByEmail(email))
                .thenReturn(Optional.of(User.builder().id(USER_ID).email(email).build()));
        when(addressRepository.findByIdAndUserId(ADDRESS_ID, USER_ID)).thenReturn(Optional.empty());

        // WHEN & THEN
        assertThatThrownBy(() -> orderService.processCheckout(idempotencyKey, request, email))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dirección de envío");

        // Se falla ANTES de reservar stock: no se toca inventario (plan §R1)
        verify(inventoryService, never()).reserveStock(any(ReserveStockRequest.class));
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("R1 - El snapshot no cambia si el usuario edita su dirección después")
    void shouldKeepSnapshotWhenAddressIsEditedLater() {
        // GIVEN
        String idempotencyKey = "key-snapshot";
        String email = "ana@nexus.dev";
        Address address = validAddress();
        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 1)
        ), "ES", 40.4168, -3.7038, ADDRESS_ID, PaymentMethod.CARD);

        when(orderRepository.findByIdempotencyKey(idempotencyKey)).thenReturn(Optional.empty());
        when(userRepository.findByEmail(email))
                .thenReturn(Optional.of(User.builder().id(USER_ID).email(email).build()));
        when(addressRepository.findByIdAndUserId(ADDRESS_ID, USER_ID)).thenReturn(Optional.of(address));
        when(warehouseSelectionService.selectOptimalWarehouse(any(), any(), any(), any()))
                .thenReturn("WH-MAD-01");
        when(inventoryService.reserveStock(any(ReserveStockRequest.class)))
                .thenReturn(new StockReservationResponse(1L, "WH-MAD-01", 1, 9, "RESERVED"));
        when(pricingService.calculatePrice(1L, "ES")).thenReturn(Optional.of(new PriceCalculationResponse(
                1L, "ES", "EUR",
                new BigDecimal("50.00"), new BigDecimal("50.00"), false,
                new BigDecimal("41.32"), new BigDecimal("8.68"), new BigDecimal("21.00")
        )));
        when(skuRepository.findById(1L)).thenReturn(Optional.of(skuWithProduct(1L, "0432-021-M")));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId(100L);
            return o;
        });

        // WHEN — el pedido se hace y DESPUÉS el usuario muda su dirección
        orderService.processCheckout(idempotencyKey, request, email);
        address.setCity("Sevilla");
        address.setPostalCode("41001");

        // THEN — la orden conserva la dirección que se usó el día de la compra
        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(captor.capture());
        assertThat(captor.getValue().getShippingAddress().getCity()).isEqualTo("Madrid");
        assertThat(captor.getValue().getShippingAddress().getPostalCode()).isEqualTo("28013");
    }

    @Test
    @DisplayName("R4 - Debe calcular returnDeadline como fecha de compra + 30 días")
    void shouldComputeReturnDeadlineFromPurchaseDate() {
        // GIVEN
        Instant purchasedAt = Instant.parse("2026-10-05T10:00:00Z");
        stubOwnedOrder(sampleOrder(purchasedAt));

        // WHEN
        OrderResponse response = orderService.getOrderForUser("ana@nexus.dev", "ORD-001")
                .orElseThrow();

        // THEN — sale de la MISMA constante que evalúa R1: los 30 días viven en un sitio
        assertThat(response.returnDeadline())
                .isEqualTo(purchasedAt.plus(Duration.ofDays(ReturnEligibilityService.WINDOW_DAYS)));
        assertThat(response.returnDeadline()).isAfter(response.createdAt());
    }

    @Test
    @DisplayName("R7 - Las órdenes previas a V10 devuelven envío y pago en null")
    void shouldReturnNullShippingAndPaymentForLegacyOrders() {
        // GIVEN — esas columnas no existían: ni snapshot ni método de pago
        stubOwnedOrder(sampleOrder(Instant.now()));

        // WHEN
        OrderResponse response = orderService.getOrderForUser("ana@nexus.dev", "ORD-001")
                .orElseThrow();

        // THEN — el frontend NO pinta la sección en vez de dejar un hueco vacío
        assertThat(response.shippingAddress()).isNull();
        assertThat(response.paymentMethod()).isNull();
        assertThat(response.returnDeadline()).isNotNull();
    }
}