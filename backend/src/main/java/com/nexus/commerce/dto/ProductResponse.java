package com.nexus.commerce.dto;

import java.util.List;

/**
 * Ficha de producto para la vitrina (catálogo y detalle).
 *
 * @param careInstructions cuidados de lavado escritos desde el panel (spec
 *         `color-and-care`, R4). Opcional y **posible {@code null}** — el
 *         campo se añade **al final** del record para no mover los
 *         constructores posicionales existentes (plan D5). Se envía en el
 *         listado del catálogo igual que {@code description}: es el mismo
 *         contrato, no una fuente de verdad aparte.
 */
public record ProductResponse(
        Long id,
        String referenceCode,
        String name,
        String description,
        String family,
        List<SkuResponse> skus,
        String careInstructions
) {}
