package com.nexus.commerce.controller;

import com.nexus.commerce.service.HealthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * {@code GET /api/v1/health} — health check público (Tarea 6.4, D7).
 *
 * <p>Responde {@code 200 {"status":"UP"}} con la BD sana y
 * {@code 503 {"status":"DOWN"}} si el {@code SELECT 1} falla. Es público a
 * propósito: un health check que exige sesión no sirve para vigilar nada.</p>
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Health", description = "Estado de vida del sistema (sin Actuator, D7)")
public class HealthController {

    private final HealthService healthService;

    @GetMapping("/health")
    @Operation(summary = "Estado del sistema", description = "200 UP con BD sana, 503 DOWN si no responde")
    public ResponseEntity<Map<String, String>> health() {
        return healthService.isHealthy()
                ? ResponseEntity.ok(Map.of("status", "UP"))
                : ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Map.of("status", "DOWN"));
    }
}
