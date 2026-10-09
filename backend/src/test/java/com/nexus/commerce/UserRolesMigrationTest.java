package com.nexus.commerce;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tarea 7.1 (spec specs/admin-roles/, R1 · CA 1-4): la migración {@code V13}
 * clasifica a los existentes con el DEFAULT, siembra un único admin verificado
 * y es reejecutable sin fallar ni duplicar.
 *
 * <p>Los {@code @SpringBootTest} arrancan con Flyway real sobre el PostgreSQL
 * del entorno, así que {@code V13} ya está aplicada: este test comprueba el
 * estado que dejó y reejecuta el contenido del fichero a mano.</p>
 */
@SpringBootTest
class UserRolesMigrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("El DEFAULT 'USER' clasifica a los existentes y nadie queda sin rol")
    void columnaRoleConDefaultUserYNuloImposible() {
        // WHEN — cómo quedó la columna tras Flyway
        String columnDefault = jdbcTemplate.queryForObject(
                "SELECT column_default FROM information_schema.columns "
                        + "WHERE table_name = 'users' AND column_name = 'role'",
                String.class);
        long sinRol = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE role IS NULL", Long.class);

        // THEN — el DEFAULT hace de backfill: un valor distinto exige UPDATE manual
        assertThat(columnDefault).contains("USER");
        // NOT NULL: imposible quedarse «sin rol»
        assertThat(sinRol).isZero();
    }

    @Test
    @DisplayName("La semilla admin existe exactamente una vez, verificada y con rol ADMIN")
    void semillaAdminUnicaYVerificada() {
        // WHEN
        long filas = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE email = 'admin@nexus.dev'", Long.class);
        String rol = jdbcTemplate.queryForObject(
                "SELECT role FROM users WHERE email = 'admin@nexus.dev'", String.class);
        boolean verificado = jdbcTemplate.queryForObject(
                "SELECT email_verified FROM users WHERE email = 'admin@nexus.dev'", Boolean.class);

        // THEN — sin esto, /api/v1/admin/** no tendría a nadie que pudiera llamarlo
        assertThat(filas).isEqualTo(1);
        assertThat(rol).isEqualTo("ADMIN");
        // el login exige el email verificado: sin esto el admin no podría entrar
        assertThat(verificado).isTrue();
    }

    @Test
    @DisplayName("Reejecutar el contenido de V13 dos veces no falla ni duplica (CA de R1)")
    void v13ReejecutableSinDuplicar() throws Exception {
        // GIVEN — el fichero real, tal y como lo ejecutó Flyway
        String sql = new String(getClass()
                .getResourceAsStream("/db/migration/V13__user_roles.sql")
                .readAllBytes(), StandardCharsets.UTF_8);

        // WHEN — dos ejecuciones seguidas (IF NOT EXISTS + ON CONFLICT DO NOTHING)
        jdbcTemplate.execute(sql);
        jdbcTemplate.execute(sql);

        // THEN — ni excepción ni filas duplicadas
        long admins = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE email = 'admin@nexus.dev'", Long.class);
        assertThat(admins).isEqualTo(1);
    }
}
