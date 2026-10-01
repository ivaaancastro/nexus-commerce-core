package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.dto.CheckoutItemRequest;
import com.nexus.commerce.dto.CheckoutRequest;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.entity.OrderStatus;
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
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
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
        ), "ES", 40.4168, -3.7038);

        OrderResponse response = new OrderResponse(
                1L, "ORD-9999", "idem-uuid-001", "ES", "EUR",
                OrderStatus.CONFIRMED, new BigDecimal("41.32"), new BigDecimal("8.68"),
                new BigDecimal("50.00"), Instant.now(), List.of()
        );

        when(orderService.processCheckout(eq("idem-uuid-001"), any(CheckoutRequest.class)))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Idempotency-Key", "idem-uuid-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderNumber").value("ORD-9999"))
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.totalAmount").value(50.00));
    }

    @Test
    @DisplayName("GET /api/v1/orders/{orderNumber} - Debe retornar 200 OK si la orden existe")
    void shouldReturn200WhenOrderFound() throws Exception {
        OrderResponse response = new OrderResponse(
                1L, "ORD-9999", "idem-uuid-001", "ES", "EUR",
                OrderStatus.CONFIRMED, new BigDecimal("41.32"), new BigDecimal("8.68"),
                new BigDecimal("50.00"), Instant.now(), List.of()
        );

        when(orderService.getOrderByNumber("ORD-9999")).thenReturn(Optional.of(response));

        mockMvc.perform(get("/api/v1/orders/ORD-9999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNumber").value("ORD-9999"));
    }
}