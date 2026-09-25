package com.nexus.commerce.controller;

import com.nexus.commerce.dto.ProductEnrichmentResponse;
import com.nexus.commerce.service.ProductEnrichmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ProductEnrichmentControllerTest {

    private MockMvc mockMvc;

    @Mock
    private ProductEnrichmentService enrichmentService;

    @InjectMocks
    private ProductEnrichmentController enrichmentController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(enrichmentController).build();
    }

    @Test
    @DisplayName("POST /api/v1/products/enrich - Debe retornar 200 OK con el enriquecimiento de IA")
    void shouldReturnEnrichedProductWhenFound() throws Exception {
        ProductEnrichmentResponse response = new ProductEnrichmentResponse(
                "BLAZER",
                "FORMAL",
                "AUTUMN_WINTER",
                "Saco sastrero estructurado",
                List.of("blazer", "sastrería", "formal")
        );

        when(enrichmentService.enrichProductByReference("0432/021")).thenReturn(Optional.of(response));

        mockMvc.perform(post("/api/v1/products/enrich").param("reference", "0432/021"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.normalizedCategory").value("BLAZER"))
                .andExpect(jsonPath("$.targetOccasion").value("FORMAL"))
                .andExpect(jsonPath("$.searchTags[0]").value("blazer"));
    }

    @Test
    @DisplayName("POST /api/v1/products/enrich - Debe retornar 404 Not Found si el producto no existe")
    void shouldReturn404WhenNotFound() throws Exception {
        when(enrichmentService.enrichProductByReference("UNKNOWN")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/v1/products/enrich").param("reference", "UNKNOWN"))
                .andExpect(status().isNotFound());
    }
}