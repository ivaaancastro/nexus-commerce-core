package com.nexus.commerce.controller;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.service.AddressService;
import com.nexus.commerce.service.SizeRecommendationService;
import com.nexus.commerce.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Profile & Addresses",
        description = "Perfil del usuario autenticado, direcciones de entrega y recomendación de talla")
public class UserController {

    private final UserService userService;
    private final AddressService addressService;
    private final SizeRecommendationService sizeRecommendationService;

    // ── Perfil ──────────────────────────────────────────────────────────────

    @GetMapping("/me")
    @Operation(summary = "Obtener el perfil del usuario autenticado")
    public ResponseEntity<UserResponse> getProfile(Authentication authentication) {
        return ResponseEntity.ok(userService.getProfile(authentication.getName()));
    }

    @PutMapping("/me")
    @Operation(summary = "Actualizar el perfil del usuario autenticado (el email no es modificable)")
    public ResponseEntity<UserResponse> updateProfile(
            Authentication authentication,
            @Valid @RequestBody ProfileUpdateRequest request) {
        return ResponseEntity.ok(userService.updateProfile(authentication.getName(), request));
    }

    // ── Direcciones ─────────────────────────────────────────────────────────

    @GetMapping("/me/addresses")
    @Operation(summary = "Listar las direcciones del usuario (máximo 2)")
    public ResponseEntity<List<AddressResponse>> listAddresses(Authentication authentication) {
        return ResponseEntity.ok(addressService.list(authentication.getName()));
    }

    @PostMapping("/me/addresses")
    @Operation(summary = "Añadir una dirección de entrega")
    public ResponseEntity<AddressResponse> createAddress(
            Authentication authentication,
            @Valid @RequestBody AddressRequest request) {
        AddressResponse created = addressService.create(authentication.getName(), request);
        return ResponseEntity.created(URI.create("/api/v1/users/me/addresses/" + created.id()))
                .body(created);
    }

    @PutMapping("/me/addresses/{id}")
    @Operation(summary = "Actualizar una dirección existente")
    public ResponseEntity<AddressResponse> updateAddress(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody AddressRequest request) {
        return ResponseEntity.ok(addressService.update(authentication.getName(), id, request));
    }

    @DeleteMapping("/me/addresses/{id}")
    public ResponseEntity<Void> deleteAddress(
            Authentication authentication,
            @PathVariable Long id) {
        addressService.delete(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

    // ── Recomendación de talla ──────────────────────────────────────────────

    @PostMapping("/me/size-recommendation")
    @Operation(summary = "Recomendar una talla según las medidas del perfil")
    public ResponseEntity<SizeRecommendationResponse> recommendSize(
            Authentication authentication,
            @Valid @RequestBody SizeRecommendationRequest request) {
        return ResponseEntity.ok(sizeRecommendationService.recommend(
                authentication.getName(), request.productId()));
    }
}
