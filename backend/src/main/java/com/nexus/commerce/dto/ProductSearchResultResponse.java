package com.nexus.commerce.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Resultado de la búsqueda sobre el catálogo (Tarea 3.1, ampliada en 6.2 y 6.3).
 *
 * <p>{@code @JsonInclude(NON_NULL)} (Tarea 6.2): la búsqueda por texto de
 * respaldo no tiene {@code similarityScore}, y serializarlo como {@code null}
 * haría que la UI pintara un «Match 0 %» falso. Con esta anotación el campo
 * simplemente no viaja cuando no existe, y el componente que lo muestra ya
 * comprueba su ausencia.</p>
 *
 * <p>{@code searchMode} (Tarea 6.3, R3) declara <strong>cómo</strong> se
 * resolvió la búsqueda: {@code "SEMANTIC"} (proximidad vectorial con clave de
 * OpenAI) o {@code "TEXT"} (fallback {@code ILIKE} sin clave). Es aditivo y
 * siempre viaja, para que quien reciba la respuesta no tenga que adivinarlo
 * ni la UI mienta sobre el método empleado.</p>
 *
 * @param searchMode {@code "SEMANTIC"} o {@code "TEXT"}
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductSearchResultResponse(
        Long productId,
        String referenceCode,
        String name,
        String family,
        String description,
        Double similarityScore,
        List<String> tags,
        String searchMode
) {}
