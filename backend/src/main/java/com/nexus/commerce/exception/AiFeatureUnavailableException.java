package com.nexus.commerce.exception;

/**
 * Una funcionalidad de IA no puede ejecutarse porque no hay una clave de
 * OpenAI utilizable (Tarea 6.2, R2).
 *
 * <p>Se traduce a {@code 503 Service Unavailable} en
 * {@link GlobalExceptionHandler}. Lleva un {@code code} propio
 * ({@code SEMANTIC_SEARCH_UNAVAILABLE} o {@code ENRICHMENT_UNAVAILABLE})
 * porque son dos funcionalidades distintas que comparten la misma causa: el
 * cliente debe poder saber cuál de las dos se ha caído sin tener que
 * interpretar el mensaje.</p>
 */
public class AiFeatureUnavailableException extends RuntimeException {

    private final String code;

    public AiFeatureUnavailableException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
