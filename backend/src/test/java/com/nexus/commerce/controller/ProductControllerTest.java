package com.nexus.commerce.controller;

import com.nexus.commerce.dto.ProductResponse;
import com.nexus.commerce.dto.SkuResponse;
import com.nexus.commerce.service.CatalogService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ProductControllerTest {

    private MockMvc mockMvc;

    @Mock
    private CatalogService catalogService;

    @InjectMocks
    private ProductController productController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(productController).build();
    }

    @Test
    @DisplayName("GET /api/v1/products - Debe retornar 200 OK con la lista de productos")
    void shouldReturnAllProducts() throws Exception {
        SkuResponse sku = new SkuResponse(1L, "843321900101", "Marino", "M");
        ProductResponse product = new ProductResponse(
                1L, "0432/021", "Blazer Cruzada", "Descripción", "OUTERWEAR", List.of(sku)
        );

        when(catalogService.getAllProducts()).thenReturn(List.of(product));

        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].referenceCode").value("0432/021"))
                .andExpect(jsonPath("$[0].name").value("Blazer Cruzada"))
                .andExpect(jsonPath("$[0].skus[0].barcode").value("843321900101"));
    }

    @Test
    @DisplayName("GET /api/v1/products/search - Debe retornar 200 OK si la referencia existe")
    void shouldReturnProductByReferenceWhenFound() throws Exception {
        ProductResponse product = new ProductResponse(
                1L, "0432/021", "Blazer Cruzada", "Descripción", "OUTERWEAR", List.of()
        );

        when(catalogService.getProductByReference("0432/021")).thenReturn(Optional.of(product));

        mockMvc.perform(get("/api/v1/products/search").param("reference", "0432/021"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.referenceCode").value("0432/021"))
                .andExpect(jsonPath("$.name").value("Blazer Cruzada"));
    }

    @Test
    @DisplayName("GET /api/v1/products/search - Debe retornar 404 Not Found si la referencia no existe")
    void shouldReturn404WhenProductNotFound() throws Exception {
        when(catalogService.getProductByReference("NON_EXISTENT")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/products/search").param("reference", "NON_EXISTENT"))
                .andExpect(status().isNotFound());
    }
}