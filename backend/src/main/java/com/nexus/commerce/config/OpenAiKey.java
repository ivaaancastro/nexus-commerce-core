package com.nexus.commerce.config;

/**
 * Regla única para saber si la clave de OpenAI está realmente disponible
 * (Tarea 6.2, R2/D3).
 *
 * <p>La propiedad {@code spring.ai.openai.api-key} se inyecta con {@code @Value}
 * en cada servicio que la necesita; esta clase concentra la decisión para que
 * «sin clave» signifique exactamente lo mismo en la búsqueda semántica y en el
 * enriquecimiento. Aceptar el literal {@code mock-key} como «sin clave» es
 * deliberado: es el valor por defecto de {@code application.properties}, así
 * que un despliegue sin la variable de entorno cae en el modo de texto en vez
 * de intentar llamadas a OpenAI que devolverían un 401.</p>
 */
public final class OpenAiKey {

    /** Valor por defecto de {@code application.properties} cuando no hay clave real. */
    public static final String MOCK_KEY = "mock-key";

    private OpenAiKey() {
    }

    /**
     * @param key valor de la propiedad, o {@code null} si nadie la ha inyectado
     * @return {@code true} si hay una clave real (no vacía y distinta de {@link #MOCK_KEY})
     */
    public static boolean isUsable(String key) {
        if (key == null) {
            // Sólo posible fuera del contenedor Spring (tests unitarios sin
            // contexto): @Value siempre resuelve porque la propiedad lleva
            // valor por defecto. En ese caso no se bloquea el camino semántico.
            return true;
        }
        String normalized = key.trim();
        return !normalized.isEmpty() && !MOCK_KEY.equals(normalized);
    }
}
