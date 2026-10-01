package com.nexus.commerce.dto;

/**
 * @param recommendedSize talla sugerida entre las disponibles del producto
 * @param reason          explicación legible de por qué se sugiere esa talla
 * @param confidence      Alta / Media / Baja según lo ajustadas que estén las medidas
 */
public record SizeRecommendationResponse(
        String recommendedSize,
        String reason,
        String confidence
) {}
