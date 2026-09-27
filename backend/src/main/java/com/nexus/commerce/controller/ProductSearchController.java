package com.nexus.commerce.controller;

import com.nexus.commerce.dto.ProductSearchRequest;
import com.nexus.commerce.dto.ProductSearchResultResponse;
import com.nexus.commerce.service.ProductSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/products/search")
@RequiredArgsConstructor
public class ProductSearchController {

    private final ProductSearchService productSearchService;

    @GetMapping("/semantic")
    public ResponseEntity<List<ProductSearchResultResponse>> searchSemantic(
            @RequestParam String query,
            @RequestParam(required = false) String family,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "10") Integer limit
    ) {
        ProductSearchRequest request = new ProductSearchRequest(query, family, maxPrice, limit);
        List<ProductSearchResultResponse> results = productSearchService.searchSimilar(request);
        return ResponseEntity.ok(results);
    }

    @PostMapping("/index")
    public ResponseEntity<Map<String, String>> indexCatalog() {
        productSearchService.indexAllProducts();
        return ResponseEntity.ok(Map.of("message", "Catálogo indexado correctamente en Vector Store"));
    }
}