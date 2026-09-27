package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductSearchRequest;
import com.nexus.commerce.dto.ProductSearchResultResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.repository.ProductRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductSearchServiceTest {

    @Mock
    private VectorStore vectorStore;

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private ProductSearchService productSearchService;

    @Test
    @DisplayName("Debe transformar los productos del catálogo y añadirlos al VectorStore")
    void shouldIndexAllProductsSuccessfully() {
        // GIVEN
        Product product = Product.builder()
                .id(1L)
                .referenceCode("0432/021")
                .name("Blazer Lino")
                .family("OUTERWEAR")
                .description("Chaqueta ligera de lino cruzada")
                .build();

        when(productRepository.findAll()).thenReturn(List.of(product));

        // WHEN
        productSearchService.indexAllProducts();

        // THEN
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Document>> captor = ArgumentCaptor.forClass(List.class);
        verify(vectorStore).add(captor.capture());

        List<Document> indexedDocs = captor.getValue();
        assertThat(indexedDocs).hasSize(1);
        Document doc = indexedDocs.getFirst();
        assertThat(doc.getText()).contains("Blazer Lino", "OUTERWEAR", "0432/021");
        assertThat(doc.getMetadata()).containsEntry("productId", 1L);
        assertThat(doc.getMetadata()).containsEntry("referenceCode", "0432/021");
    }

    @Test
    @DisplayName("Debe buscar documentos similares en VectorStore y mapear los resultados con score")
    void shouldSearchSimilarProductsAndMapResults() {
        // GIVEN
        ProductSearchRequest request = new ProductSearchRequest("boda verano formal", "OUTERWEAR", null, 5);

        Document doc = Document.builder()
                .text("Blazer formal de lino")
                .metadata(Map.of(
                        "productId", 10L,
                        "referenceCode", "0432/021",
                        "name", "Blazer Lino",
                        "family", "OUTERWEAR"
                ))
                .score(0.89)
                .build();

        when(vectorStore.similaritySearch(any(SearchRequest.class))).thenReturn(List.of(doc));

        // WHEN
        List<ProductSearchResultResponse> results = productSearchService.searchSimilar(request);

        // THEN
        assertThat(results).hasSize(1);
        ProductSearchResultResponse result = results.getFirst();
        assertThat(result.productId()).isEqualTo(10L);
        assertThat(result.referenceCode()).isEqualTo("0432/021");
        assertThat(result.name()).isEqualTo("Blazer Lino");
        assertThat(result.similarityScore()).isEqualTo(0.89);

        verify(vectorStore).similaritySearch(any(SearchRequest.class));
    }
}