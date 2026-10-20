package com.nexus.commerce.controller;

import com.nexus.commerce.dto.AdminDashboardResponse;
import com.nexus.commerce.service.AdminDashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint del dashboard del panel (Tarea 7.6, R1).
 *
 * <p>Cae bajo {@code /api/v1/admin/**} y <strong>hereda el
 * {@code hasRole("ADMIN")} de la 7.1 con cero cambios en
 * {@code SecurityConfig}</strong> (ADR-0006, mismo argumento que 7.2–7.5).</p>
 */
@RestController
@RequestMapping("/api/v1/admin/dashboard")
@RequiredArgsConstructor
@Tag(name = "Admin Dashboard",
        description = "Métricas del panel: ventas del periodo, catálogo y usuarios (Tarea 7.6)")
public class AdminDashboardController {

    /** Default del periodo: 30 días cuando no llega {@code days} (R4). */
    static final String DIAS_POR_DEFECTO = "30";

    private final AdminDashboardService adminDashboardService;

    @GetMapping
    @Operation(summary = "Foto del negocio para la portada del panel",
            description = "Ventas del periodo (sin cancelados, ingresos por moneda), "
                    + "catálogo y usuarios en una sola respuesta. "
                    + "days: entero 1–365, por defecto 30.")
    public AdminDashboardResponse getDashboard(
            @RequestParam(name = "days", defaultValue = DIAS_POR_DEFECTO) int days) {
        return adminDashboardService.getDashboard(days);
    }
}
