package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductEnrichmentResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductEnrichmentServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ChatClient.Builder chatClientBuilder;

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private ChatClient chatClient;

    private ProductEnrichmentService enrichmentService;

    @BeforeEach
    void setUp() {
        when(chatClientBuilder.build()).thenReturn(chatClient);
        enrichmentService = new ProductEnrichmentService(productRepository, chatClientBuilder);
    }

    @Test
    @DisplayName("Debe enriquecer un producto existente extrayendo metadatos vía LLM estructurado")
    void shouldEnrichExistingProductSuccessfully() {
        // GIVEN
        Product product = Product.builder()
                .referenceCode("0432/021")
                .name("Blazer Cruzada")
                .family("OUTERWEAR")
                .description("Blazer de lino con hombreras")
                .build();

        when(productRepository.findByReferenceCode("0432/021")).thenReturn(Optional.of(product));

        ProductEnrichmentResponse mockAiResponse = new ProductEnrichmentResponse(
                "BLAZER",
                "OFFICE",
                "SPRING_SUMMER",
                "Blazer estructurada formal de lino",
                List.of("blazer", "lino", "oficina", "hombreras")
        );

        // Simulamos la cadena fluida completa de Spring AI
        when(chatClient.prompt()
                .user(anyString())
                .call()
                .entity(ProductEnrichmentResponse.class))
                .thenReturn(mockAiResponse);

        // WHEN
        Optional<ProductEnrichmentResponse> response = enrichmentService.enrichProductByReference("0432/021");

        // THEN
        assertThat(response).isPresent();
        ProductEnrichmentResponse result = response.get();
        assertThat(result.normalizedCategory()).isEqualTo("BLAZER");
        assertThat(result.targetOccasion()).isEqualTo("OFFICE");
        assertThat(result.targetSeason()).isEqualTo("SPRING_SUMMER");
        assertThat(result.searchTags()).contains("lino", "oficina");

        verify(productRepository).findByReferenceCode("0432/021");
    }

    @Test
    @DisplayName("Debe devolver Optional vacío si la referencia del producto no existe")
    void shouldReturnEmptyWhenProductNotFound() {
        // GIVEN
        when(productRepository.findByReferenceCode("UNKNOWN")).thenReturn(Optional.empty());

        // WHEN
        Optional<ProductEnrichmentResponse> response = enrichmentService.enrichProductByReference("UNKNOWN");

        // THEN
        assertThat(response).isEmpty();
        verify(productRepository).findByReferenceCode("UNKNOWN");
        verifyNoInteractions(chatClient);
    }
}