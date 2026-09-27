package com.nexus.commerce.controller;

import com.nexus.commerce.dto.ProductSearchRequest;
import com.nexus.commerce.dto.ProductSearchResultResponse;
import com.nexus.commerce.service.ProductSearchService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ProductSearchControllerTest {

    private MockMvc mockMvc;

    @Mock
    private ProductSearchService productSearchService;

    @InjectMocks
    private ProductSearchController productSearchController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(productSearchController).build();
    }

    @Test
    @DisplayName("GET /api/v1/products/search/semantic - Debe retornar 200 OK con lista de coincidencias")
    void shouldReturnSemanticSearchResults() throws Exception {
        ProductSearchResultResponse response = new ProductSearchResultResponse(
                1L, "0432/021", "Blazer Lino", "OUTERWEAR",
                "Chaqueta formal", 0.92, List.of()
        );

        when(productSearchService.searchSimilar(any(ProductSearchRequest.class)))
                .thenReturn(List.of(response));

        mockMvc.perform(get("/api/v1/products/search/semantic")
                        .param("query", "traje para fiesta en playa")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].productId").value(1))
                .andExpect(jsonPath("$[0].referenceCode").value("0432/021"))
                .andExpect(jsonPath("$[0].similarityScore").value(0.92));
    }

    @Test
    @DisplayName("POST /api/v1/products/search/index - Debe retornar 200 OK tras indexar")
    void shouldTriggerIndexing() throws Exception {
        mockMvc.perform(post("/api/v1/products/search/index"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());

        verify(productSearchService).indexAllProducts();
    }
}