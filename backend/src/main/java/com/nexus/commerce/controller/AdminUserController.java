package com.nexus.commerce.controller;

import com.nexus.commerce.dto.AdminUserPageResponse;
import com.nexus.commerce.dto.AdminUserResponse;
import com.nexus.commerce.dto.AdminUserRoleRequest;
import com.nexus.commerce.dto.AdminUserSuspensionRequest;
import com.nexus.commerce.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Gestión de usuarios del panel (Tarea 7.5, spec specs/admin-users/, R1/R2/R3).
 *
 * <p>Los 3 endpoints viven bajo {@code /api/v1/admin/**} y <strong>heredan</strong>
 * el {@code hasRole("ADMIN")} de la 7.1 (ADR-0006): la autorización no cambia en
 * este fichero ni en {@code SecurityConfig} (plan D1).</p>
 *
 * <p>Sin <strong>autorización por propiedad</strong> a propósito: el admin ve y
 * gestiona <em>todos</em> los usuarios. No es un IDOR — el rol lo autoriza. El
 * único caso donde el operador importa es la auto-suspensión, y la resuelve la
 * guarda de {@code USER_CONFLICT} comparando con {@code authentication.getName()}.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin · Usuarios",
        description = "Listado, cambio de rol y suspensión de cuentas. Requiere rol ADMIN: 401 sin sesión, 403 con rol USER.")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    @Operation(summary = "Listado paginado de todos los usuarios, con búsqueda q")
    public ResponseEntity<AdminUserPageResponse> listar(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(adminUserService.listar(page, size, q));
    }

    @PutMapping("/{id}/role")
    @Operation(summary = "Cambia el rol USER ⇄ ADMIN (guarda: no degradar al último admin activo)")
    public ResponseEntity<AdminUserResponse> cambiarRol(
            @PathVariable Long id,
            @Valid @RequestBody AdminUserRoleRequest request) {
        return ResponseEntity.ok(adminUserService.cambiarRol(id, request));
    }

    @PutMapping("/{id}/suspension")
    @Operation(summary = "Suspende o restaura una cuenta (guardas: ni auto-suspensión ni último admin)")
    public ResponseEntity<AdminUserResponse> cambiarSuspension(
            @PathVariable Long id,
            @Valid @RequestBody AdminUserSuspensionRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(adminUserService.cambiarSuspension(id, request,
                authentication.getName()));
    }
}
