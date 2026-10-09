package com.nexus.commerce.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Semilla del panel de administración (Tarea 7.1, spec specs/admin-roles/, D5).
 *
 * <p>El panel real llega con las tareas 7.2–7.6; aquí sólo hace falta un
 * endpoint <strong>real</strong> — no una maqueta — para que {@code AdminRoute}
 * y los tests de seguridad tengan algo que proteger y contra lo que verificar.</p>
 *
 * <p>La protección no vive aquí: la aplica {@code SecurityConfig} con
 * {@code hasRole("ADMIN")} antes de {@code anyRequest().denyAll()}. Con token
 * de {@code USER} la petición ni llega (403 del entry point).</p>
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Panel de administración. Requiere rol ADMIN: 401 sin sesión, 403 con rol USER.")
public class AdminController {

    @GetMapping("/ping")
    @Operation(summary = "Comprueba que la sesión es de administrador",
            description = "Devuelve email y rol de quien llama. Garantiza que la cadena "
                    + "hasRole -> denyAll deja pasar al ADMIN y bloquea al resto.")
    public ResponseEntity<Map<String, String>> ping(Authentication authentication) {
        String role = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals) ? "ADMIN" : "USER";
        return ResponseEntity.ok(Map.of(
                "email", authentication.getName(),
                "role", role));
    }
}
