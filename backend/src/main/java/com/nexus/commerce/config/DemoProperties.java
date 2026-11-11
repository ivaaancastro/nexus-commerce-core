package com.nexus.commerce.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Modo demo (Fase 10, R5/R6 · D6). {@code false} por defecto: solo el
 * despliegue público lo activa (perfil {@code demo} o {@code APP_DEMO_ENABLED}).
 * Regla única que leen {@link com.nexus.commerce.security.DemoModeFilter}
 * (por su condición de registro) y {@code GET /payments/config}.
 */
@Component
public class DemoProperties {

    private final boolean enabled;

    public DemoProperties(@Value("${app.demo.enabled:false}") boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }
}
