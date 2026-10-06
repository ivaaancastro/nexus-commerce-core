package com.nexus.commerce.dto;

/**
 * Familia textil con el número de productos que la componen (Tarea 3.1, R1).
 *
 * <p>Es la única fuente de verdad de la taxonomía que pinta el frontend: la
 * portada y el menú del catálogo se pintan <strong>exclusivamente</strong> de
 * esta respuesta, nunca reduciendo la lista de productos en cliente. La familia
 * en la base de datos es texto libre ({@code products.family}, sin tabla
 * {@code families}), así que este endpoint la agrupa con {@code GROUP BY} y
 * añade el índice {@code idx_products_family} (V12) para que no escanee tabla.</p>
 *
 * <p>La entidad JPA nunca sale al exterior (regla 6 de AGENTS.md).</p>
 *
 * @param family       nombre de la familia, p. ej. {@code "OUTERWEAR"}
 * @param productCount número de <strong>productos</strong> — no de SKUs
 */
public record FamilyResponse(
        String family,
        int productCount
) {}
