package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductSearchRequest;
import com.nexus.commerce.dto.ProductSearchResultResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.exception.AiFeatureUnavailableException;
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
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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

    // =====================================================================
    // Tarea 6.2 (R2) — búsqueda sin OPENAI_API_KEY
    // =====================================================================

    @Test
    @DisplayName("R2 - Clave no inyectada (tests sin contexto Spring) no bloquea el camino semántico")
    void claveNoInyectadaNoBloquea() {
        // El campo queda a null sin contenedor Spring; OpenAiKey lo trata como
        // «no bloquear» para no desviar los tests preexistentes de esta clase.
        assertThat(productSearchService.isSemanticAvailable()).isTrue();
    }

    @Test
    @DisplayName("R2 - Con clave mock la búsqueda cae al fallback por texto y no toca el VectorStore")
    void conClaveMockSeUsaElFallbackDeTexto() {
        // GIVEN
        ReflectionTestUtils.setField(productSearchService, "openAiApiKey", "mock-key");
        assertThat(productSearchService.isSemanticAvailable()).isFalse();

        Product blazer = Product.builder()
                .id(1L)
                .referenceCode("0432/021")
                .name("Blazer Cruzada Estructura")
                .family("OUTERWEAR")
                .description("Blazer de cuello solapa con manga larga")
                .build();
        when(productRepository.buscarPorTexto(eq("blazer"), isNull(), eq(Pageable.ofSize(5))))
                .thenReturn(List.of(blazer));

        // WHEN
        List<ProductSearchResultResponse> results =
                productSearchService.searchSimilar(new ProductSearchRequest("blazer", null, 5));

        // THEN
        assertThat(results).hasSize(1);
        ProductSearchResultResponse result = results.getFirst();
        assertThat(result.productId()).isEqualTo(1L);
        assertThat(result.referenceCode()).isEqualTo("0432/021");
        assertThat(result.name()).isEqualTo("Blazer Cruzada Estructura");
        // Sin similitud que declarar: el score se omite, no se miente con un 0.
        assertThat(result.similarityScore()).isNull();

        verifyNoInteractions(vectorStore);
    }

    @Test
    @DisplayName("R2 - Clave en blanco (sólo espacios) también se considera no disponible")
    void claveEnBlancoNoDisponible() {
        // GIVEN
        ReflectionTestUtils.setField(productSearchService, "openAiApiKey", "   ");
        when(productRepository.buscarPorTexto(any(), any(), any())).thenReturn(List.of());

        // WHEN
        List<ProductSearchResultResponse> results =
                productSearchService.searchSimilar(new ProductSearchRequest("abrigos", null, 10));

        // THEN
        assertThat(productSearchService.isSemanticAvailable()).isFalse();
        assertThat(results).isEmpty();
        verify(productRepository).buscarPorTexto(any(), any(), any());
        verifyNoInteractions(vectorStore);
    }

    @Test
    @DisplayName("R2 - El fallback respeta family y limit con el mismo contrato que la vía semántica")
    void elFallbackRespetaFamilyYLimit() {
        // GIVEN
        ReflectionTestUtils.setField(productSearchService, "openAiApiKey", "mock-key");
        when(productRepository.existsByFamily("OUTERWEAR")).thenReturn(true);
        when(productRepository.buscarPorTexto(eq("lana"), eq("OUTERWEAR"), eq(Pageable.ofSize(3))))
                .thenReturn(List.of());

        // WHEN
        productSearchService.searchSimilar(new ProductSearchRequest("lana", "OUTERWEAR", 3));

        // THEN
        verify(productRepository).buscarPorTexto(eq("lana"), eq("OUTERWEAR"), eq(Pageable.ofSize(3)));
        verifyNoInteractions(vectorStore);
    }

    @Test
    @DisplayName("R2 - Belt and braces: si el VectorStore falla pese a la clave, responde el fallback con 200")
    void siElVectorStoreFallaRespondeElFallback() {
        // GIVEN: clave real pero rota — la detección previa no la alcanza.
        ReflectionTestUtils.setField(productSearchService, "openAiApiKey", "sk-rota-123");
        when(vectorStore.similaritySearch(any(SearchRequest.class)))
                .thenThrow(new RuntimeException("401 Incorrect API key provided"));

        Product jersey = Product.builder()
                .id(3L)
                .referenceCode("0815/004")
                .name("Jersey Punto Lana")
                .family("KNITWEAR")
                .description("Jersey de punto fino con cuello redondo")
                .build();
        when(productRepository.buscarPorTexto(eq("jersey"), isNull(), eq(Pageable.ofSize(10))))
                .thenReturn(List.of(jersey));

        // WHEN
        List<ProductSearchResultResponse> results =
                productSearchService.searchSimilar(new ProductSearchRequest("jersey", null, 10));

        // THEN: no propaga la excepción y devuelve resultados reales.
        assertThat(results).hasSize(1);
        assertThat(results.getFirst().name()).isEqualTo("Jersey Punto Lana");
        verify(productRepository).buscarPorTexto(eq("jersey"), isNull(), eq(Pageable.ofSize(10)));
    }

    @Test
    @DisplayName("R2 - Con clave real el camino semántico no se toca y el fallback jamás se invoca")
    void conClaveRealNoSeUsaElFallback() {
        // GIVEN
        ReflectionTestUtils.setField(productSearchService, "openAiApiKey", "sk-real-123");
        assertThat(productSearchService.isSemanticAvailable()).isTrue();

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
        List<ProductSearchResultResponse> results =
                productSearchService.searchSimilar(new ProductSearchRequest("boda", null, 10));

        // THEN
        assertThat(results).hasSize(1);
        assertThat(results.getFirst().similarityScore()).isEqualTo(0.89);
        verify(vectorStore).similaritySearch(any(SearchRequest.class));
        verifyNoInteractions(productRepository);
    }

    @Test
    @DisplayName("R2 - indexAllProducts sin clave lanza AiFeatureUnavailableException con su código (503)")
    void indexSinClaveLanzaNoDisponible() {
        // GIVEN
        ReflectionTestUtils.setField(productSearchService, "openAiApiKey", "mock-key");

        // WHEN / THEN
        AiFeatureUnavailableException ex = catchThrowableOfType(
                productSearchService::indexAllProducts,
                AiFeatureUnavailableException.class);

        assertThat(ex).isNotNull();
        assertThat(ex.getCode()).isEqualTo("SEMANTIC_SEARCH_UNAVAILABLE");
        verifyNoInteractions(vectorStore, productRepository);
    }
}