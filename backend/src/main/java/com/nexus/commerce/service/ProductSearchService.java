package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductSearchRequest;
import com.nexus.commerce.dto.ProductSearchResultResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
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

    @Transactional(readOnly = true)
    public void indexAllProducts() {
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
        log.info("Ejecutando búsqueda semántica para query: '{}'", request.query());

        SearchRequest searchRequest = SearchRequest.builder()
                .query(request.query())
                .topK(request.limit())
                .similarityThreshold(0.65)
                .build();

        List<Document> similarDocuments = vectorStore.similaritySearch(searchRequest);

        return similarDocuments.stream()
                .map(this::toSearchResult)
                .toList();
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
                List.of()
        );
    }
}