package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.repository.ProductRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CatalogServiceTest {

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private CatalogService catalogService;

    @Test
    @DisplayName("Debe listar todos los productos mapeados a ProductResponse correctamente")
    void shouldReturnAllProductsMappedToDto() {
        // GIVEN
        Product product = Product.builder()
                .id(1L)
                .referenceCode("0432/021")
                .name("Blazer Estructura")
                .family("OUTERWEAR")
                .build();

        Sku sku = Sku.builder()
                .id(10L)
                .barcode("843321900101")
                .color("Marino")
                .size("M")
                .product(product)
                .build();

        product.setSkus(List.of(sku));

        when(productRepository.findAll()).thenReturn(List.of(product));

        // WHEN
        List<ProductResponse> result = catalogService.getAllProducts();

        // THEN
        assertThat(result).hasSize(1);
        ProductResponse response = result.getFirst();
        assertThat(response.referenceCode()).isEqualTo("0432/021");
        assertThat(response.skus()).hasSize(1);
        assertThat(response.skus().getFirst().barcode()).isEqualTo("843321900101");

        verify(productRepository, times(1)).findAll();
    }

    @Test
    @DisplayName("Debe devolver Optional vacío si la referencia no existe")
    void shouldReturnEmptyOptionalWhenReferenceNotFound() {
        // GIVEN
        when(productRepository.findByReferenceCode("NON_EXISTENT")).thenReturn(Optional.empty());

        // WHEN
        Optional<ProductResponse> result = catalogService.getProductByReference("NON_EXISTENT");

        // THEN
        assertThat(result).isEmpty();
        verify(productRepository, times(1)).findByReferenceCode("NON_EXISTENT");
    }
}