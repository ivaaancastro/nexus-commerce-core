package com.nexus.commerce.controller;

import com.nexus.commerce.dto.PriceCalculationResponse;
import com.nexus.commerce.service.PricingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.Optional;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PricingControllerTest {

    private MockMvc mockMvc;

    @Mock
    private PricingService pricingService;

    @InjectMocks
    private PricingController pricingController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(pricingController).build();
    }

    @Test
    @DisplayName("GET /api/v1/pricing/skus/{id} - Debe retornar 200 OK con el desglose de precio calculado")
    void shouldReturnPriceCalculationWhenFound() throws Exception {
        PriceCalculationResponse response = new PriceCalculationResponse(
                1L, "CH", "CHF",
                new BigDecimal("119.00"), new BigDecimal("119.00"),
                false,
                new BigDecimal("110.08"), new BigDecimal("8.92"),
                new BigDecimal("8.10")
        );

        when(pricingService.calculatePrice(1L, "CH")).thenReturn(Optional.of(response));

        mockMvc.perform(get("/api/v1/pricing/skus/1").param("market", "CH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skuId").value(1))
                .andExpect(jsonPath("$.marketCode").value("CH"))
                .andExpect(jsonPath("$.currency").value("CHF"))
                .andExpect(jsonPath("$.finalPrice").value(119.00))
                .andExpect(jsonPath("$.taxAmount").value(8.92));
    }

    @Test
    @DisplayName("GET /api/v1/pricing/skus/{id} - Debe aplicar 'ES' por defecto si no se indica mercado")
    void shouldUseDefaultMarketWhenNotProvided() throws Exception {
        PriceCalculationResponse response = new PriceCalculationResponse(
                1L, "ES", "EUR",
                new BigDecimal("79.95"), new BigDecimal("79.95"),
                false,
                new BigDecimal("66.07"), new BigDecimal("13.88"),
                new BigDecimal("21.00")
        );

        when(pricingService.calculatePrice(1L, "ES")).thenReturn(Optional.of(response));

        mockMvc.perform(get("/api/v1/pricing/skus/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.marketCode").value("ES"))
                .andExpect(jsonPath("$.currency").value("EUR"));

        verify(pricingService).calculatePrice(1L, "ES");
    }

    @Test
    @DisplayName("GET /api/v1/pricing/skus/{id} - Debe retornar 404 Not Found si no hay precio configurado")
    void shouldReturn404WhenPriceNotFound() throws Exception {
        when(pricingService.calculatePrice(99L, "ES")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/pricing/skus/99"))
                .andExpect(status().isNotFound());
    }
}