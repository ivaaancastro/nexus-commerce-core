package com.nexus.commerce.controller;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.service.AdminProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD de productos y SKUs del panel de administración (Tarea 7.2,
 * spec specs/admin-product-crud/, R1).
 *
 * <p><strong>No hay reglas de seguridad nuevas</strong>: al vivir bajo
 * {@code /api/v1/admin/**}, estos endpoints heredan el
 * {@code hasRole("ADMIN")} instalado en la 7.1 (ADR-0006) <em>antes</em> del
 * {@code anyRequest().denyAll()}. {@code SecurityConfig} no se modifica.</p>
 *
 * <p>Las lecturas devuelven los mismos DTOs que la vitrina
 * ({@link ProductResponse}/{@link SkuResponse}) — nunca entidades JPA.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/products")
@RequiredArgsConstructor
@Tag(name = "Admin · Productos",
        description = "CRUD de productos y SKUs. Requiere rol ADMIN: 401 sin sesión, 403 con rol USER.")
public class AdminProductController {

    private final AdminProductService service;

    @GetMapping
    @Operation(summary = "Lista todos los productos con sus SKUs")
    public ResponseEntity<List<ProductResponse>> listar() {
        return ResponseEntity.ok(service.listar());
    }

    @PostMapping
    @Operation(summary = "Crea un producto",
            description = "La referencia debe ser única y tener formato NNNN/NNN. "
                    + "No crea precios ni stock (tarea 7.3).")
    public ResponseEntity<ProductResponse> crear(@Valid @RequestBody ProductCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.crear(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detalle de un producto para editar")
    public ResponseEntity<ProductResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(service.obtener(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualiza nombre, familia y descripción",
            description = "La referencia es inmutable: no se acepta en el cuerpo.")
    public ResponseEntity<ProductResponse> actualizar(@PathVariable Long id,
                                                      @Valid @RequestBody ProductUpdateRequest request) {
        return ResponseEntity.ok(service.actualizar(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Borra un producto",
            description = "204 si nadie lo compró (cascada: SKUs, precios, stock). "
                    + "409 si algún SKU tiene pedidos — no se borra nada.")
    public ResponseEntity<Void> borrar(@PathVariable Long id) {
        service.borrar(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/skus")
    @Operation(summary = "Crea un SKU (variante) del producto",
            description = "El código de barras debe ser único. No crea precio ni stock (tarea 7.3).")
    public ResponseEntity<SkuResponse> crearSku(@PathVariable Long id,
                                                @Valid @RequestBody SkuCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.crearSku(id, request));
    }

    @PutMapping("/{id}/skus/{skuId}")
    @Operation(summary = "Actualiza color y talla de un SKU",
            description = "El código de barras es inmutable: no se acepta en el cuerpo.")
    public ResponseEntity<SkuResponse> actualizarSku(@PathVariable Long id,
                                                     @PathVariable Long skuId,
                                                     @Valid @RequestBody SkuUpdateRequest request) {
        return ResponseEntity.ok(service.actualizarSku(id, skuId, request));
    }

    @DeleteMapping("/{id}/skus/{skuId}")
    @Operation(summary = "Borra un SKU",
            description = "204 si el SKU no tiene pedidos; 409 en caso contrario.")
    public ResponseEntity<Void> borrarSku(@PathVariable Long id, @PathVariable Long skuId) {
        service.borrarSku(id, skuId);
        return ResponseEntity.noContent().build();
    }
}
