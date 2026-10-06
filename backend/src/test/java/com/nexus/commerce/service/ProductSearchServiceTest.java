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
import org.springframework.ai.vectorstore.filter.Filter;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
        ProductSearchRequest request = new ProductSearchRequest("boda verano formal", "OUTERWEAR", 5);
        when(productRepository.existsByFamily("OUTERWEAR")).thenReturn(true);

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

    @Test
    @DisplayName("R9 - family se envía al vector store como filterExpression")
    void familiaSeAplicaComoFilterExpression() {
        // GIVEN
        when(productRepository.existsByFamily("OUTERWEAR")).thenReturn(true);
        when(vectorStore.similaritySearch(any(SearchRequest.class))).thenReturn(List.of());

        // WHEN
        productSearchService.searchSimilar(new ProductSearchRequest("abrigos de lana", "OUTERWEAR", 10));

        // THEN
        ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
        verify(vectorStore).similaritySearch(captor.capture());

        // Spring AI devuelve la expresión ya parseada: EQ sobre la clave 'family'
        // con el valor como literal, que es exactamente lo que se pidió.
        Filter.Expression expresion = captor.getValue().getFilterExpression();
        assertThat(expresion).isNotNull();
        assertThat(expresion.type()).isEqualTo(Filter.ExpressionType.EQ);
        assertThat(expresion.left().toString()).contains("family");
        assertThat(expresion.right().toString()).contains("OUTERWEAR");
    }

    @Test
    @DisplayName("R9 - Sin family no se envía ningún filterExpression")
    void sinFamiliaNoHayFilterExpression() {
        // GIVEN
        when(vectorStore.similaritySearch(any(SearchRequest.class))).thenReturn(List.of());

        // WHEN
        productSearchService.searchSimilar(new ProductSearchRequest("abrigos de lana", null, 10));

        // THEN
        ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
        verify(vectorStore).similaritySearch(captor.capture());
        assertThat(captor.getValue().getFilterExpression()).isNull();

        // La validación de familia no debe costarle una consulta a la base de datos
        verifyNoInteractions(productRepository);
    }

    /**
     * El valor se concatena dentro de una expresión que Spring AI interpreta, así
     * que una comilla lo rompería. Ni se llega a consultar la base de datos.
     */
    @Test
    @DisplayName("R9 - family con comilla no se concatena: ni consulta la BD ni el vector store")
    void familiaConComillaNoSeConcatena() {
        // WHEN
        List<ProductSearchResultResponse> results =
                productSearchService.searchSimilar(new ProductSearchRequest("abrigos", "OUTERWEAR'", 10));

        // THEN
        assertThat(results).isEmpty();
        verify(productRepository, never()).existsByFamily(anyString());
        verifyNoInteractions(vectorStore);
    }

    @Test
    @DisplayName("R9 - family desconocida devuelve vacío sin llegar a consultar el vector store")
    void familiaDesconocidaDevuelveVacio() {
        // GIVEN
        when(productRepository.existsByFamily("NOEXISTE")).thenReturn(false);

        // WHEN
        List<ProductSearchResultResponse> results =
                productSearchService.searchSimilar(new ProductSearchRequest("abrigos", "NOEXISTE", 10));

        // THEN
        assertThat(results).isEmpty();
        verifyNoInteractions(vectorStore);
    }
}