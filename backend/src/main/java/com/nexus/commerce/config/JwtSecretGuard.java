package com.nexus.commerce.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Guarda del secreto JWT en producción (Fase 10, R3 · D3).
 *
 * <p>El {@code application.properties} trae un secreto de ejemplo
 * <strong>público</strong> (está en el repositorio). En un despliegue real eso
 * permitiría a cualquiera forjar un token con {@code role=ADMIN}. Con el perfil
 * {@code prod} el arranque <strong>falla</strong> si el secreto es ese o si
 * tiene menos de 32 bytes (mínimo de HS256) — mismo patrón que la guarda de
 * {@code sk_live_} de {@link PaymentsProperties}: el olvido se convierte en un
 * error en voz alta, nunca en un agujero silencioso.</p>
 *
 * <p>Sin el perfil {@code prod} el bean no existe: dev, tests y CI no cambian.</p>
 *
 * <p><strong>Por qué es un {@link FlywayConfigurationCustomizer}</strong>: la
 * autoconfiguración de Flyway instancia sus customizers <em>antes</em> de
 * migrar, así que la guarda falla antes de tocar la base de datos. Como
 * {@code @Component} suelto se medía que Flyway ya había migrado una base vacía
 * cuando el arranque abortaba (spec fase10, D.2).</p>
 */
@Slf4j
@Component
@Profile("prod")
public class JwtSecretGuard implements FlywayConfigurationCustomizer {

    /** El valor por defecto versionado en {@code application.properties}. */
    static final String SECRETO_DEL_REPO = "my-super-secret-key-that-is-at-least-32-bytes-long-for-hs256";
    static final int MINIMO_BYTES = 32;

    private final String secret;

    public JwtSecretGuard(@Value("${jwt.secret:}") String secret) {
        this.secret = secret == null ? "" : secret;
    }

    @PostConstruct
    void validar() {
        if (SECRETO_DEL_REPO.equals(secret)) {
            throw new IllegalStateException(
                    "JWT_SECRET es el valor de ejemplo del repositorio: define un secreto propio en producción.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MINIMO_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET debe tener al menos " + MINIMO_BYTES + " bytes (HS256).");
        }
        log.info("JWT: secreto de producción validado.");
    }

    /** No cambia nada de Flyway: solo garantiza que la guarda corre antes de migrar. */
    @Override
    public void customize(FluentConfiguration configuration) {
        // Intencionadamente vacío.
    }
}
