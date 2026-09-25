package com.nexus.commerce.controller;

import com.nexus.commerce.dto.ProductEnrichmentResponse;
import com.nexus.commerce.service.ProductEnrichmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductEnrichmentController {

    private final ProductEnrichmentService enrichmentService;

    @PostMapping("/enrich")
    public ResponseEntity<ProductEnrichmentResponse> enrichProduct(
            @RequestParam String reference
    ) {
        return enrichmentService.enrichProductByReference(reference)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}