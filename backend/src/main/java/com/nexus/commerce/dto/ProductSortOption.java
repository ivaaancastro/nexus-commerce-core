package com.nexus.commerce.dto;

import java.util.Locale;

/**
 * Orden disponible para el listado de catálogo (Tarea 3.1, R2).
 *
 * <p>Es también el mecanismo de validación del parámetro {@code sort}: la spec
 * dice que un orden desconocido responde <strong>400</strong>, mientras que
 * {@code family}, {@code size} y {@code color} desconocidos responden
 * {@code 200 []}. La distinción es deliberada — <em>los tres primeros son
 * datos</em> y un dato inexistente simplemente no casa; <em>este es una
 * operación</em>, así que un valor inválido es un error del cliente que
 * conviene que salga a la superficie en lugar de ignorarse.</p>
 */
public enum ProductSortOption {

    /** Orden de inserción en base de datos. Es el valor por defecto. */
    DEFAULT,

    /** Nombre del producto ascendente, sin distinguir mayúsculas. */
    NAME_ASC,

    /** Nombre del producto descendente, sin distinguir mayúsculas. */
    NAME_DESC;

    /**
     * Convierte el parámetro de query en la opción correspondiente.
     *
     * <p>Acepta el valor canónico documentado ({@code name-asc}), su equivalente
     * en mayúsculas y con guion bajo ({@code NAME_ASC}) y la versión sin
     * distinguir mayúsculas — se normaliza todo a {@link #DEFAULT} cuando no hay
     * valor, porque es el orden por defecto de la API.</p>
     *
     * @param value valor crudo del query param; puede ser {@code null} o vacío
     * @return la opción pedida, o {@link #DEFAULT} si no viene
     * @throws IllegalArgumentException si el valor no corresponde a ningún orden
     */
    public static ProductSortOption from(String value) {
        if (value == null || value.isBlank()) {
            return DEFAULT;
        }

        String normalizado = value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        try {
            return valueOf(normalizado);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "Orden de catálogo no válido: '" + value + "'. Valores admitidos: default, name-asc, name-desc");
        }
    }
}
