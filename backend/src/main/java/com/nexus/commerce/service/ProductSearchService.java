package com.nexus.commerce.service;

import com.nexus.commerce.config.OpenAiKey;
import com.nexus.commerce.dto.ProductSearchRequest;
import com.nexus.commerce.dto.ProductSearchResultResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.exception.AiFeatureUnavailableException;
import com.nexus.commerce.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductSearchService {

    private final VectorStore vectorStore;
    private final ProductRepository productRepository;

    /**
     * Clave de OpenAI (Tarea 6.2). Spring la asigna después de construir el
     * bean; en tests unitarios sin contexto queda a {@code null} y
     * {@link OpenAiKey#isUsable} lo trata como «no bloquear» — ver su Javadoc.
     */
    @Value("${spring.ai.openai.api-key:mock-key}")
    private String openAiApiKey;

    @Transactional(readOnly = true)
    public void indexAllProducts() {
        // R2: indexar exige embeddings, y sin clave el intento sólo puede
        // terminar en un 401 de OpenAI. Se avisa con 503 antes de tocar nada.
        if (!isSemanticAvailable()) {
            throw new AiFeatureUnavailableException(
                    "SEMANTIC_SEARCH_UNAVAILABLE",
                    "La indexación vectorial requiere una clave de OPENAI_API_KEY válida");
        }

        List<Product> products = productRepository.findAll();
        log.info("Indexando {} productos en el Vector Store...", products.size());

        List<Document> documents = products.stream()
                .map(this::toDocument)
                .toList();

        vectorStore.add(documents);
        log.info("Indexación vectorial completada con éxito.");
    }

    @Transactional(readOnly = true)
    public List<ProductSearchResultResponse> searchSimilar(ProductSearchRequest request) {
        String familia = normalizar(request.family());

        log.info("Ejecutando búsqueda para query: '{}'{}",
                request.query(),
                familia == null ? "" : " (familia " + familia + ")");

        if (familia != null && !esFamiliaUtilizable(familia)) {
            log.info("La familia '{}' no existe o no es segura: 0 resultados sin consultar el vector store.", familia);
            return List.of();
        }

        // R2/D3: sin clave utilizable la búsqueda no se intenta siquiera —
        // se resuelve con ILIKE contra la propia BD, que siempre está ahí.
        if (!isSemanticAvailable()) {
            log.info("Sin clave de OPENAI_API_KEY: búsqueda por texto (ILIKE) para '{}'.", request.query());
            return buscarPorTexto(request, familia);
        }

        try {
            SearchRequest.Builder builder = SearchRequest.builder()
                    .query(request.query())
                    .topK(request.limit())
                    .similarityThreshold(0.65);

            // R9: family se aplicaba como parámetro y se tiraba a la basura. La metadata
            // 'family' ya se guarda en cada documento al indexar, así que no hay que
            // reindexar nada para que el filtro surta efecto.
            if (familia != null) {
                builder.filterExpression("family == '" + familia + "'");
            }

            List<Document> similarDocuments = vectorStore.similaritySearch(builder.build());

            return similarDocuments.stream()
                    .map(this::toSearchResult)
                    .toList();
        } catch (RuntimeException e) {
            // R2/D3, belt-and-braces: la detección previa cubre el caso esperado
            // (clave vacía o mock), pero una clave inválida, sin cuota o una caída
            // de red llegarían aquí. Un 500 en /search es peor que malos resultados.
            log.warn("La búsqueda semántica ha fallado pese a haber clave ({}): fallback de texto.",
                    e.getMessage());
            return buscarPorTexto(request, familia);
        }
    }

    /**
     * ¿Hay una clave de OpenAI utilizable? (Tarea 6.2, R2)
     *
     * <p>{@code true} con clave real; {@code false} con la propiedad vacía o
     * con el literal {@code mock-key} del {@code application.properties}.</p>
     */
    public boolean isSemanticAvailable() {
        return OpenAiKey.isUsable(openAiApiKey);
    }

    /**
     * Fallback por texto (Tarea 6.2, R2): mismo contrato que la vía semántica —
     * respeta {@code family} y {@code limit} — con la semántica de «contiene»
     * sobre nombre, descripción y referencia.
     */
    private List<ProductSearchResultResponse> buscarPorTexto(ProductSearchRequest request, String familia) {
        List<Product> products = productRepository.buscarPorTexto(
                request.query(), familia, Pageable.ofSize(request.limit()));
        return products.stream()
                .map(this::toTextSearchResult)
                .toList();
    }

    /**
     * En texto no hay similitud que declarar, así que {@code similarityScore}
     * queda a {@code null}: el DTO lleva {@code @JsonInclude(NON_NULL)} y el
     * campo no viaja en la respuesta, de modo que la UI no pinta una
     * «Match 0 %» mentirosa.
     */
    private ProductSearchResultResponse toTextSearchResult(Product product) {
        return new ProductSearchResultResponse(
                product.getId(),
                product.getReferenceCode(),
                product.getName(),
                product.getFamily(),
                product.getDescription(),
                null,
                List.of(),
                "TEXT"
        );
    }

    private String normalizar(String familia) {
        return (familia == null || familia.isBlank()) ? null : familia.trim();
    }

    /**
     * Decide si un valor de {@code family} puede entrar en la expresión de filtro.
     *
     * <p>El valor viaja en un <strong>string de expresión</strong> que Spring AI
     * interpreta después ({@code family == 'OUTERWEAR'}), así que no basta con
     * escaparlo para SQL: hay que tratarlo como código. Por eso se rechaza
     * cualquier familia que contenga una comilla y, acto seguido, se comprueba
     * contra la base de datos con {@code existsByFamily} — sólo se concatena un
     * valor que ya sabemos que existe como familia. Una familia desconocida
     * responde vacío, igual que en el listado de catálogo.</p>
     *
     * <p>El comprobador de comillas va primero a propósito: evita hasta la consulta
     * cuando el valor es claramente inválido.</p>
     */
    private boolean esFamiliaUtilizable(String familia) {
        return !familia.contains("'") && productRepository.existsByFamily(familia);
    }

    private Document toDocument(Product product) {
        String textToEmbed = """
                Producto: %s
                Familia: %s
                Referencia: %s
                Descripción: %s
                """.formatted(
                product.getName(),
                product.getFamily(),
                product.getReferenceCode(),
                product.getDescription() != null ? product.getDescription() : ""
        );

        Map<String, Object> metadata = Map.of(
                "productId", product.getId(),
                "referenceCode", product.getReferenceCode(),
                "family", product.getFamily(),
                "name", product.getName()
        );

        return new Document(textToEmbed, metadata);
    }

    private ProductSearchResultResponse toSearchResult(Document doc) {
        Map<String, Object> metadata = doc.getMetadata();

        Long productId = ((Number) metadata.get("productId")).longValue();
        String referenceCode = (String) metadata.get("referenceCode");
        String name = (String) metadata.get("name");
        String family = (String) metadata.get("family");
        Double score = doc.getScore();

        return new ProductSearchResultResponse(
                productId,
                referenceCode,
                name,
                family,
                doc.getText(),
                score,
                List.of(),
                "SEMANTIC"
        );
    }
}