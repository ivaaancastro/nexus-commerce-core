package com.nexus.commerce.controller;

import com.nexus.commerce.dto.ProductSearchRequest;
import com.nexus.commerce.dto.ProductSearchResultResponse;
import com.nexus.commerce.service.ProductSearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/products/search")
@RequiredArgsConstructor
@Tag(name = "Search & AI", description = "Búsqueda semántica híbrida con pgvector e indexación de catálogo")
public class ProductSearchController {

    private final ProductSearchService productSearchService;

    @GetMapping("/semantic")
    @Operation(summary = "Búsqueda semántica por significado",
            description = "Devuelve productos parecidos al texto consultado. family es opcional y filtra por la "
                    + "metadata de familia ya indexada; una familia desconocida devuelve 200 con lista vacía. "
                    + "No admite filtro por precio.")
    public ResponseEntity<List<ProductSearchResultResponse>> searchSemantic(
            @RequestParam String query,
            @RequestParam(required = false) String family,
            @RequestParam(defaultValue = "10") Integer limit
    ) {
        ProductSearchRequest request = new ProductSearchRequest(query, family, limit);
        List<ProductSearchResultResponse> results = productSearchService.searchSimilar(request);
        return ResponseEntity.ok(results);
    }

    @PostMapping("/index")
    public ResponseEntity<Map<String, String>> indexCatalog() {
        productSearchService.indexAllProducts();
        return ResponseEntity.ok(Map.of("message", "Catálogo indexado correctamente en Vector Store"));
    }
}