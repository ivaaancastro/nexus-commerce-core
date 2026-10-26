package com.nexus.commerce.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Payload de {@code POST /api/v1/wishlist/items} (spec V3 wishlist, R3.2).
 *
 * <p>Sólo el producto: un favorito guarda la referencia comercial, nunca una
 * variante ni un importe (plan D2/D13).</p>
 */
public record WishlistAddRequest(
        @NotNull(message = "productId es obligatorio")
        Long productId
) {}
