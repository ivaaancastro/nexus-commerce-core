package com.nexus.commerce.controller;

import com.nexus.commerce.dto.FamilyResponse;
import com.nexus.commerce.dto.ProductResponse;
import com.nexus.commerce.service.CatalogService;
import io.swagger.v3.oas.annotations.Operation;
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
    @Operation(summary = "Listar productos del catálogo",
            description = "Filtros opcionales y combinables entre sí. Sin parámetros devuelve el catálogo completo. "
                    + "size y color se exigen sobre el mismo SKU. sort admite default, name-asc y name-desc; "
                    + "un orden desconocido responde 400, mientras que family/size/color desconocidos responden 200 []. "
                    + "La respuesta no se pagina.")
    public ResponseEntity<List<ProductResponse>> getAllProducts(
            @RequestParam(required = false) String family,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String color,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok(catalogService.listarProductos(family, size, color, sort));
    }

    @GetMapping("/families")
    @Operation(summary = "Listar las familias del catálogo",
            description = "Taxonomía real agrupada en base de datos con el número de productos de cada familia, "
                    + "ordenada alfabéticamente. Es la fuente de la portada y del menú de filtros.")
    public ResponseEntity<List<FamilyResponse>> getFamilies() {
        return ResponseEntity.ok(catalogService.listarFamilias());
    }

    @GetMapping("/search")
    @Operation(summary = "Buscar producto por referencia")
    public ResponseEntity<ProductResponse> getProductByReference(@RequestParam String reference) {
        return catalogService.getProductByReference(reference)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
