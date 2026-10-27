package com.nexus.commerce.controller;

import com.nexus.commerce.dto.WishlistAddRequest;
import com.nexus.commerce.dto.WishlistItemResponse;
import com.nexus.commerce.dto.WishlistResponse;
import com.nexus.commerce.service.WishlistService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Favoritos del usuario autenticado (spec V3 wishlist, R3/R4).
 *
 * <p>La identidad sale de {@code Authentication.getName()} (email), patrón de
 * {@code UserOrderController}: no hay endpoint por id de usuario, así que
 * nadie lee ni escribe la lista de otro (R4.3). Todo bajo
 * {@code /api/v1/wishlist/**}, que SecurityConfig exige autenticado (R4.1).</p>
 */
@RestController
@RequestMapping("/api/v1/wishlist")
@RequiredArgsConstructor
@Tag(name = "Wishlist",
        description = "Favoritos del usuario autenticado: una lista por usuario, guardados por producto")
public class WishlistController {

    private final WishlistService wishlistService;

    @GetMapping
    @Operation(summary = "Listar los favoritos del usuario (más reciente primero)",
            description = "Lectura sin efectos: sin lista propia devuelve items vacío, sin crear filas.")
    public ResponseEntity<WishlistResponse> getWishlist(Authentication authentication) {
        return ResponseEntity.ok(wishlistService.getWishlist(authentication.getName()));
    }

    @PostMapping("/items")
    @Operation(summary = "Guardar un producto en favoritos (idempotente: repetir no duplica)",
            description = "Producto nuevo → 201; ya guardado → 200 con el ítem existente y sin fila nueva. "
                    + "Producto inexistente → 404. Sin precios: se piden frescos a /pricing (plan D13).")
    public ResponseEntity<WishlistItemResponse> addItem(
            Authentication authentication,
            @Valid @RequestBody WishlistAddRequest request) {
        WishlistService.AddResult resultado =
                wishlistService.addItem(authentication.getName(), request.productId());
        return resultado.created()
                ? ResponseEntity.status(HttpStatus.CREATED).body(resultado.item())
                : ResponseEntity.ok(resultado.item());
    }

    @DeleteMapping("/items/{productId}")
    @Operation(summary = "Quitar un producto de favoritos (204 siempre, exista o no)",
            description = "Idempotente por diseño: el botón de corazón nunca tiene que comprobar antes (plan D4).")
    public ResponseEntity<Void> removeItem(Authentication authentication, @PathVariable Long productId) {
        wishlistService.removeItem(authentication.getName(), productId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @Operation(summary = "Vaciar la lista de favoritos",
            description = "204 idempotente; borra los ítems y conserva la fila de la lista.")
    public ResponseEntity<Void> clear(Authentication authentication) {
        wishlistService.clear(authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
