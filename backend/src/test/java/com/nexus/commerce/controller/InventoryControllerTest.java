package com.nexus.commerce.controller;

import com.nexus.commerce.dto.ReserveStockRequest;
import com.nexus.commerce.dto.StockReservationResponse;
import com.nexus.commerce.dto.StockResponse;
import com.nexus.commerce.exception.GlobalExceptionHandler;
import com.nexus.commerce.exception.InsufficientStockException;
import com.nexus.commerce.service.InventoryService;
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

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class InventoryControllerTest {

    private MockMvc mockMvc;

    @Mock
    private InventoryService inventoryService;

    @InjectMocks
    private InventoryController inventoryController;

    @BeforeEach
    void setUp() {
        // Configuramos MockMvc en modo standalone inyectando el controlador y su manejador de excepciones
        mockMvc = MockMvcBuilders.standaloneSetup(inventoryController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/inventory/skus/{id} - Debe retornar 200 OK con el stock agregado")
    void shouldReturnStockResponse() throws Exception {
        // GIVEN
        StockResponse mockResponse = new StockResponse(1L, 225, true, List.of());
        when(inventoryService.getStockBySku(1L)).thenReturn(mockResponse);

        // WHEN / THEN
        mockMvc.perform(get("/api/v1/inventory/skus/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skuId").value(1))
                .andExpect(jsonPath("$.totalAvailable").value(225))
                .andExpect(jsonPath("$.inStock").value(true));
    }

    @Test
    @DisplayName("POST /api/v1/inventory/reserve - Debe retornar 200 OK cuando la reserva es exitosa")
    void shouldReserveStockSuccessfully() throws Exception {
        // GIVEN
        StockReservationResponse mockResponse = new StockReservationResponse(
                1L, "WH_ARTEIXO", 5, 140, "RESERVED"
        );
        when(inventoryService.reserveStock(any(ReserveStockRequest.class))).thenReturn(mockResponse);

        String jsonBody = """
                {
                    "skuId": 1,
                    "warehouseCode": "WH_ARTEIXO",
                    "quantity": 5
                }
                """;

        // WHEN / THEN
        mockMvc.perform(post("/api/v1/inventory/reserve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESERVED"))
                .andExpect(jsonPath("$.remainingAvailable").value(140));
    }

    @Test
    @DisplayName("POST /api/v1/inventory/reserve - Debe retornar 409 Conflict vía GlobalExceptionHandler cuando no hay existencias")
    void shouldReturn409WhenStockIsInsufficient() throws Exception {
        // GIVEN
        when(inventoryService.reserveStock(any(ReserveStockRequest.class)))
                .thenThrow(new InsufficientStockException("Stock insuficiente en WH_ARTEIXO"));

        String jsonBody = """
                {
                    "skuId": 1,
                    "warehouseCode": "WH_ARTEIXO",
                    "quantity": 999
                }
                """;

        // WHEN / THEN
        mockMvc.perform(post("/api/v1/inventory/reserve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Stock insuficiente en WH_ARTEIXO"));
    }
}