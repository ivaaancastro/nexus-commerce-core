package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.dto.CheckoutItemRequest;
import com.nexus.commerce.dto.CheckoutRequest;
import com.nexus.commerce.dto.CheckoutResponse;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.PaymentMethod;
import com.nexus.commerce.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class OrderControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private OrderService orderService;

    @InjectMocks
    private OrderController orderController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(orderController).build();
    }

    @Test
    @DisplayName("POST /api/v1/orders/checkout - Debe retornar 201 CREATED con el detalle del pedido")
    void shouldReturn201OnSuccessfulCheckout() throws Exception {
        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 1)
        ), "ES", 40.4168, -3.7038, 5L, PaymentMethod.CARD, null);

        OrderResponse orderResponse = new OrderResponse(
                1L, "ORD-9999", "idem-uuid-001", "ES", "EUR",
                OrderStatus.CONFIRMED, new BigDecimal("41.32"), new BigDecimal("8.68"),
                new BigDecimal("50.00"), Instant.now(), Instant.now().plus(Duration.ofDays(30)),
                null, PaymentMethod.CARD, null, null, List.of(),
                null
        );

        CheckoutResponse checkoutResponse = new CheckoutResponse(orderResponse, "pi_test_123", "pi_test_123_secret");

        when(orderService.processCheckout(eq("idem-uuid-001"), any(CheckoutRequest.class), eq(null)))
                .thenReturn(checkoutResponse);

        mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Idempotency-Key", "idem-uuid-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.order.orderNumber").value("ORD-9999"))
                .andExpect(jsonPath("$.order.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.order.paymentMethod").value("CARD"))
                .andExpect(jsonPath("$.order.returnDeadline").exists())
                .andExpect(jsonPath("$.order.totalAmount").value(50.00))
                .andExpect(jsonPath("$.paymentIntentId").value("pi_test_123"))
                .andExpect(jsonPath("$.clientSecret").value("pi_test_123_secret"));
    }

    @Test
    @DisplayName("POST /api/v1/orders/checkout - Sin dirección o método de pago responde 400")
    void shouldRejectCheckoutWithoutAddressOrPaymentMethod() throws Exception {
        // GIVEN — `addressId` y `paymentMethod` son obligatorios desde la
        // Tarea 5.5 (R1 y R2): sin ellos no hay snapshot ni preferencia que guardar.
        CheckoutRequest request = new CheckoutRequest("ES", List.of(
                new CheckoutItemRequest(1L, "WH-MAD-01", 1)
        ), "ES", 40.4168, -3.7038, null, null, null);

        // WHEN / THEN
        mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Idempotency-Key", "idem-sin-direccion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        // La validación corta antes del servicio: ni se reserva stock
        verifyNoInteractions(orderService);
    }

    @Test
    @DisplayName("GET /api/v1/orders/{orderNumber} - Debe retornar 200 OK si la orden existe")
    void shouldReturn200WhenOrderFound() throws Exception {
        OrderResponse response = new OrderResponse(
                1L, "ORD-9999", "idem-uuid-001", "ES", "EUR",
                OrderStatus.CONFIRMED, new BigDecimal("41.32"), new BigDecimal("8.68"),
                new BigDecimal("50.00"), Instant.now(), Instant.now().plus(Duration.ofDays(30)),
                null, PaymentMethod.CARD, null, null, List.of(),
                null
        );

        when(orderService.getOrderByNumber("ORD-9999")).thenReturn(Optional.of(response));

        mockMvc.perform(get("/api/v1/orders/ORD-9999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNumber").value("ORD-9999"));
    }
}