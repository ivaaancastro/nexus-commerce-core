package com.nexus.commerce.dto;

import java.util.List;

/**
 * Lista de favoritos del usuario autenticado (spec V3 wishlist, R3.1).
 *
 * <p>Un usuario sin lista devuelve {@code items: []} — el {@code GET} no crea
 * filas (plan D1). Sin id interno: el cliente sólo necesita los artículos.</p>
 */
public record WishlistResponse(
        List<WishlistItemResponse> items
) {}
