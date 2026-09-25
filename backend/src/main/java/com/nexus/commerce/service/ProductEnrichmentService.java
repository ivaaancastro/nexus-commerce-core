package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductEnrichmentResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.repository.ProductRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Slf4j
@Service
public class ProductEnrichmentService {

    private final ProductRepository productRepository;
    private final ChatClient chatClient;

    public ProductEnrichmentService(ProductRepository productRepository, ChatClient.Builder chatClientBuilder) {
        this.productRepository = productRepository;
        this.chatClient = chatClientBuilder.build();
    }

    @Transactional(readOnly = true)
    public Optional<ProductEnrichmentResponse> enrichProductByReference(String referenceCode) {
        return productRepository.findByReferenceCode(referenceCode)
                .map(this::callAiEnrichment);
    }

    private ProductEnrichmentResponse callAiEnrichment(Product product) {
        log.info("Enriqueciendo producto con IA: {} ({})", product.getName(), product.getReferenceCode());

        String userPrompt = """
                Analiza el siguiente producto del catálogo textil y clasifícalo:
                - Nombre: %s
                - Familia actual: %s
                - Descripción: %s

                Determina la categoría normalizada (ej: BLAZER, DRESS, TROUSERS, COAT),
                la ocasión de uso prioritaria (ej: CASUAL, OFFICE, FORMAL, NIGHT),
                la temporada adecuada (ej: SPRING_SUMMER, AUTUMN_WINTER, ALL_SEASON),
                un resumen estilístico breve de una frase,
                y entre 4 y 6 etiquetas de búsqueda (searchTags) relevantes.
                """.formatted(product.getName(), product.getFamily(), product.getDescription());

        return chatClient.prompt()
                .user(userPrompt)
                .call()
                .entity(ProductEnrichmentResponse.class);
    }
}