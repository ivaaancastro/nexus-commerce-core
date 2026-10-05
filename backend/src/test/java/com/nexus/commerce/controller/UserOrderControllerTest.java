package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.nexus.commerce.dto.OrderPageResponse;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.dto.OrderSummaryResponse;
import com.nexus.commerce.dto.ReturnRequest;
import com.nexus.commerce.dto.ReturnResponse;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.ReturnStatus;
import com.nexus.commerce.exception.GlobalExceptionHandler;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.exception.ReturnNotAllowedException;
import com.nexus.commerce.service.OrderService;
import com.nexus.commerce.service.ReturnService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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

/**
 * Tests del controller de historial en modo standalone.
 *
 * Spring Security no está presente, así que inyectamos el principal sobre la
 * petición mock con {@code setUserPrincipal}, igual que hace el filtro JWT.
 */
@ExtendWith(MockitoExtension.class)
class UserOrderControllerTest {

    private static final String EMAIL = "ana@example.com";
    private static final String ORDER = "ORD-001";

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private OrderService orderService;

    @Mock
    private ReturnService returnService;

    @InjectMocks
    private UserOrderController userOrderController;

    @BeforeEach
    void setUp() {
        ObjectMapper mvcMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        mockMvc = MockMvcBuilders.standaloneSetup(userOrderController)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mvcMapper))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    /** Simula el principal que Spring Security dejaría en la petición. */
    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder builder) {
        return builder.with(request -> {
            request.setUserPrincipal(
                    new UsernamePasswordAuthenticationToken(EMAIL, null, List.of()));
            return request;
        });
    }

    @Test
    @DisplayName("GET /me/orders - Devuelve el historial paginado del usuario autenticado")
    void shouldReturnOrderHistory() throws Exception {
        // GIVEN
        OrderSummaryResponse summary = new OrderSummaryResponse(
                1L, "ORD-001", OrderStatus.DELIVERED, "EUR",
                new BigDecimal("50.00"), Instant.now(), 2);
        OrderPageResponse page = new OrderPageResponse(List.of(summary), 0, 20, 1, 1);

        when(orderService.listOrders(EMAIL, 0, 20)).thenReturn(page);

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me/orders")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orders[0].orderNumber").value("ORD-001"))
                .andExpect(jsonPath("$.orders[0].status").value("DELIVERED"))
                .andExpect(jsonPath("$.orders[0].itemCount").value(2))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("GET /me/orders - Reenvía la página y el tamaño pedidos")
    void shouldForwardPagingParams() throws Exception {
        // GIVEN
        when(orderService.listOrders(EMAIL, 3, 20))
                .thenReturn(new OrderPageResponse(List.of(), 3, 20, 60, 3));

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me/orders?page=3&size=20")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(3))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    @DisplayName("GET /me/orders/{orderNumber} - Devuelve 200 si el pedido es del usuario")
    void shouldReturn200WhenOrderBelongsToUser() throws Exception {
        // GIVEN
        OrderResponse order = new OrderResponse(
                1L, "ORD-001", "idem-1", "ES", "EUR",
                OrderStatus.DELIVERED, new BigDecimal("41.32"), new BigDecimal("8.68"),
                new BigDecimal("50.00"), Instant.now(), List.of());

        when(orderService.getOrderForUser(EMAIL, "ORD-001")).thenReturn(Optional.of(order));

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me/orders/ORD-001")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNumber").value("ORD-001"))
                .andExpect(jsonPath("$.status").value("DELIVERED"));
    }

    @Test
    @DisplayName("GET /me/orders/{orderNumber} - Devuelve 404 si es de otro usuario")
    void shouldReturn404WhenOrderBelongsToAnotherUser() throws Exception {
        // GIVEN
        when(orderService.getOrderForUser(EMAIL, "ORD-AJENO"))
                .thenReturn(Optional.empty());

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me/orders/ORD-AJENO")))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /me/orders/{orderNumber} - Devuelve 404 si el pedido no existe")
    void shouldReturn404WhenOrderDoesNotExist() throws Exception {
        // GIVEN
        when(orderService.getOrderForUser(eq(EMAIL), any())).thenReturn(Optional.empty());

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me/orders/ORD-INEXISTENTE")))
                .andExpect(status().isNotFound());
    }

    // ---------------------------------------------------------------- Devoluciones (Tarea 5.4)

    @Test
    @DisplayName("POST /me/orders/{orderNumber}/returns - Responde 201 con la devolución creada")
    void shouldCreateReturnAndRespond201() throws Exception {
        // GIVEN
        ReturnResponse response = new ReturnResponse(
                10L, 55L, "SKU-55", ReturnStatus.REQUESTED, "Talla incorrecta",
                "EUR", new BigDecimal("50.00"), Instant.now());
        when(returnService.createReturn(eq(EMAIL), eq(ORDER), any(ReturnRequest.class)))
                .thenReturn(response);

        // WHEN / THEN
        mockMvc.perform(asUser(post("/api/v1/users/me/orders/ORD-001/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderItemId\":55,\"reason\":\"Talla incorrecta\"}")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.orderItemId").value(55))
                .andExpect(jsonPath("$.status").value("REQUESTED"))
                .andExpect(jsonPath("$.currency").value("EUR"))
                .andExpect(jsonPath("$.refundAmount").value(50.00));
    }

    @Test
    @DisplayName("POST /me/orders/{orderNumber}/returns - Responde 400 si el motivo va en blanco")
    void shouldRespond400WhenReasonIsBlank() throws Exception {
        // WHEN / THEN  (regla de R4: validación en servidor como respaldo)
        mockMvc.perform(asUser(post("/api/v1/users/me/orders/ORD-001/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderItemId\":55,\"reason\":\"  \"}")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /me/orders/{orderNumber}/returns - Responde 409 si la línea no es elegible")
    void shouldRespond409WhenLineIsNotEligible() throws Exception {
        // GIVEN
        when(returnService.createReturn(eq(EMAIL), eq(ORDER), any(ReturnRequest.class)))
                .thenThrow(new ReturnNotAllowedException("Ha pasado el plazo de 30 días desde la compra."));

        // WHEN / THEN
        mockMvc.perform(asUser(post("/api/v1/users/me/orders/ORD-001/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderItemId\":55,\"reason\":\"Talla incorrecta\"}")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Ha pasado el plazo de 30 días desde la compra."));
    }

    @Test
    @DisplayName("POST /me/orders/{orderNumber}/returns - Responde 404 si la línea no pertenece al pedido")
    void shouldRespond404WhenOrderItemIdIsNotFromOrder() throws Exception {
        // GIVEN
        when(returnService.createReturn(eq(EMAIL), eq(ORDER), any(ReturnRequest.class)))
                .thenThrow(new ResourceNotFoundException("Línea de pedido no encontrada"));

        // WHEN / THEN
        mockMvc.perform(asUser(post("/api/v1/users/me/orders/ORD-001/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderItemId\":999,\"reason\":\"Talla incorrecta\"}")))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /me/orders/{orderNumber}/returns - Lista las devoluciones del pedido")
    void shouldListReturnsOfOrder() throws Exception {
        // GIVEN
        ReturnResponse response = new ReturnResponse(
                10L, 55L, "SKU-55", ReturnStatus.REQUESTED, "Talla incorrecta",
                "EUR", new BigDecimal("50.00"), Instant.now());
        when(returnService.listReturns(EMAIL, ORDER)).thenReturn(List.of(response));

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me/orders/ORD-001/returns")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].orderItemId").value(55))
                .andExpect(jsonPath("$[0].refundAmount").value(50.00));
    }

    @Test
    @DisplayName("GET /me/orders/{orderNumber}/returns - Devuelve lista vacía si aún no hay devoluciones")
    void shouldReturnEmptyListWhenNoReturns() throws Exception {
        // GIVEN
        when(returnService.listReturns(EMAIL, ORDER)).thenReturn(List.of());

        // WHEN / THEN
        mockMvc.perform(asUser(get("/api/v1/users/me/orders/ORD-001/returns")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
