package com.nexus.commerce.dto;

import java.time.OffsetDateTime;

/**
 * Un favorito. Comprime el mismo {@code ProductResponse} de la vitrina
 * (plan D5: una sola definición de la ficha; catálogo pequeño, peso
 * irrelevante) — **sin importes**: los precios se piden frescos a
 * {@code /pricing} con el mercado activo (plan D13, decisión del usuario).
 *
 * @param addedAt instante del guardado; ordena la lista (más reciente primero).
 */
public record WishlistItemResponse(
        Long id,
        OffsetDateTime addedAt,
        ProductResponse product
) {}
