package com.nexus.commerce.controller;

import com.nexus.commerce.dto.ProductResponse;
import com.nexus.commerce.service.CatalogService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
@Tag(name = "Catalog", description = "Gestión jerárquica de catálogo, familias y SKUs")
public class ProductController {

    private final CatalogService catalogService;

    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAllProducts() {
        return ResponseEntity.ok(catalogService.getAllProducts());
    }

    @GetMapping("/search")
    public ResponseEntity<ProductResponse> getProductByReference(@RequestParam String reference) {
        return catalogService.getProductByReference(reference)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}