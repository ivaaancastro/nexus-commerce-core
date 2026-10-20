package com.nexus.commerce.dto;

import java.util.List;

/**
 * Página del listado de usuarios del panel (Tarea 7.5, R1). Mismo shape que
 * {@link AdminOrderPageResponse} con el campo renombrado: la página existe
 * aunque venga vacía — sin resultados es {@code 200} con {@code users: []},
 * nunca un 404 (R1).
 */
public record AdminUserPageResponse(
        List<AdminUserResponse> users,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
