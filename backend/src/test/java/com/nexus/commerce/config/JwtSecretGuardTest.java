package com.nexus.commerce.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Fase 10 - JwtSecretGuard: en prod no arranca con el secreto del repo")
class JwtSecretGuardTest {

    @Test
    @DisplayName("el secreto de ejemplo versionado en application.properties aborta el arranque")
    void secretoDelRepoNoArranca() {
        assertThatThrownBy(() -> new JwtSecretGuard(JwtSecretGuard.SECRETO_DEL_REPO).validar())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("valor de ejemplo");
    }

    @Test
    @DisplayName("un secreto de menos de 32 bytes (o vacío) aborta el arranque")
    void secretoCortoNoArranca() {
        assertThatThrownBy(() -> new JwtSecretGuard("corto").validar())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
        assertThatThrownBy(() -> new JwtSecretGuard(null).validar())
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("un secreto propio de ≥ 32 bytes arranca")
    void secretoPropioArranca() {
        assertThatCode(() -> new JwtSecretGuard("x".repeat(32)).validar()).doesNotThrowAnyException();
    }
}
