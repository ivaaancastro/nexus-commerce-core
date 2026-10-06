package com.nexus.commerce.dto;

/**
 * Petición de búsqueda semántica (Tarea 3.1, R9).
 *
 * <p>El parámetro de precio máximo desapareció en la Tarea 3.1: se recibía en el
 * controller y el servicio lo descartaba sin usar, así que prometía en la
 * documentación OpenAPI algo que el código no hacía. Un parámetro que se recibe
 * y se ignora es peor que ausente. El filtro por precio queda fuera de alcance
 * de la tarea a propósito — el de familias, en cambio, sí se implementa.</p>
 *
 * @param query  texto de la búsqueda
 * @param family familia exacta opcional; desconocida o vacía no filtra
 * @param limit  número máximo de resultados (por defecto 10)
 */
public record ProductSearchRequest(
        String query,
        String family,
        Integer limit
) {
    public ProductSearchRequest {
        if (limit == null || limit <= 0) {
            limit = 10;
        }
    }
}
