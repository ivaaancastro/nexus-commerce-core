package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Iterator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 7.6 (spec specs/admin-dashboard/, R1–R5) — {@code GET /api/v1/admin/dashboard}
 * con <strong>backend real</strong>: PostgreSQL + Flyway + Spring Security.
 *
 * <p><strong>El endpoint es de sólo lectura</strong> (plan D2): no escribe nada,
 * así que aquí no hay usuario de prueba ni limpieza — no hay nada que restituir
 * (a diferencia de la 7.4/7.5, no hay efectos de stock ni filas propias).</p>
 *
 * <p><strong>Los números exactos viven en {@code AdminDashboardServiceTest}</strong>
 * (mocks): contra la BD compartida los globales cambian con cada corrida (lección
 * 4.2/D5), así que aquí sólo se gatea <strong>consistencia</strong>: 5 claves en
 * {@code byStatus}, {@code orderCount} = suma de no cancelados, ticket medio
 * ≈ total/pedidos por moneda y rangos de foto.</p>
 *
 * <p>Los tokens son de sólo-token (patrón 7.4/7.5): el endpoint no lee el
 * principio más allá de la autoría ADMIN/USER del JWT.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Tarea 7.6 - Dashboard en la zona admin")
class AdminDashboardControllerTest {

    private static final String BASE = "/api/v1/admin/dashboard";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;

    private String adminToken;
    private String userToken;

    @BeforeEach
    void preparar() {
        adminToken = jwtService.generateToken(999L, "admin-7600@nexus.test", Role.ADMIN);
        userToken = jwtService.generateToken(998L, "user-7600@nexus.test", Role.USER);
    }

    // ── R1: shape completo ─────────────────────────────────────────────────

    @Test
    @DisplayName("R1 - 200 ADMIN con los 4 bloques y el shape completo por defecto")
    void shapeCompletoPorDefecto() throws Exception {
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.range.days").value(30))
                .andExpect(jsonPath("$.range.from").exists())
                .andExpect(jsonPath("$.sales.orderCount").isNumber())
                .andExpect(jsonPath("$.sales.byStatus").isMap())
                .andExpect(jsonPath("$.sales.revenue").isArray())
                .andExpect(jsonPath("$.products.total").isNumber())
                .andExpect(jsonPath("$.products.skus").isNumber())
                .andExpect(jsonPath("$.products.families").isNumber())
                .andExpect(jsonPath("$.users.total").isNumber())
                .andExpect(jsonPath("$.users.admins").isNumber())
                .andExpect(jsonPath("$.users.suspended").isNumber())
                .andExpect(jsonPath("$.users.newInPeriod").isNumber());
    }

    @Test
    @DisplayName("R1 - byStatus trae SIEMPRE las 5 claves, aunque el periodo esté vacío")
    void byStatusCincoClavesSiempre() throws Exception {
        MvcResult resultado = mockMvc.perform(get(BASE)
                        .param("days", "7")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode porEstado = leer(resultado).path("sales").path("byStatus");
        for (OrderStatus estado : OrderStatus.values()) {
            assertThat(porEstado.has(estado.name()))
                    .as("byStatus.%s presente (aunque sea 0)", estado)
                    .isTrue();
            assertThat(porEstado.get(estado.name()).asLong())
                    .as("byStatus.%s ≥ 0", estado)
                    .isGreaterThanOrEqualTo(0);
        }
    }

    @Test
    @DisplayName("R1 - range.echo del days explícito y from ≈ now − days")
    void rangeReflejaDaysExplicito() throws Exception {
        MvcResult resultado = mockMvc.perform(get(BASE)
                        .param("days", "14")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.range.days").value(14))
                .andReturn();

        JsonNode range = leer(resultado).path("range");
        Instant from = Instant.parse(range.path("from").asText());
        Instant esperado = Instant.now().minus(14, ChronoUnit.DAYS);
        // tolerancia amplia: ahora mismo corre Spring Boot + BD en el mismo proceso
        assertThat(from).isBetween(esperado.minusSeconds(120), esperado.plusSeconds(120));
    }

    // ── R2/R4: consistencia (no globales exactos) ──────────────────────────

    @Test
    @DisplayName("R2 - orderCount cuadra con byStatus sin cancelados en la BD real")
    void orderCountConsistenteConByStatus() throws Exception {
        JsonNode venta = leer(mockMvc.perform(get(BASE)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn());

        long orderCount = venta.path("sales").path("orderCount").asLong();
        long sumaTodos = 0;
        long cancelados = 0;
        Iterator<String> estados = venta.path("sales").path("byStatus").fieldNames();
        while (estados.hasNext()) {
            String estado = estados.next();
            long n = venta.path("sales").path("byStatus").path(estado).asLong();
            sumaTodos += n;
            if (estado.equals(OrderStatus.CANCELLED.name())) {
                cancelados += n;
            }
        }
        assertThat(orderCount)
                .as("orderCount = sum(byStatus) − CANCELLED")
                .isEqualTo(sumaTodos - cancelados);
        assertThat(orderCount).isLessThanOrEqualTo(sumaTodos);
    }

    @Test
    @DisplayName("R2 - cada fila de revenue es autoconsistente y nunca cruza monedas")
    void revenueCoherentePorMoneda() throws Exception {
        JsonNode venta = leer(mockMvc.perform(get(BASE)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn());

        JsonNode revenue = venta.path("sales").path("revenue");
        assertThat(revenue.isArray()).isTrue();
        java.util.Set<String> monedas = new java.util.HashSet<>();
        for (JsonNode fila : revenue) {
            assertThat(fila.path("currency").asText()).hasSize(3);
            assertThat(monedas.add(fila.path("currency").asText()))
                    .as("una fila por moneda, sin duplicados")
                    .isTrue();
            long pedidos = fila.path("orderCount").asLong();
            assertThat(pedidos).isGreaterThanOrEqualTo(1);
            assertThat(fila.path("total").decimalValue()).isPositive();
            // ticket medio ≈ total/pedidos (la diferencia sólo puede ser el redondeo HALF_UP a 2)
            double esperado = fila.path("total").decimalValue()
                    .divide(new java.math.BigDecimal(pedidos), 2, java.math.RoundingMode.HALF_UP)
                    .doubleValue();
            assertThat(fila.path("avgTicket").decimalValue().doubleValue())
                    .as("avgTicket = total/pedidos con HALF_UP escala 2")
                    .isEqualTo(esperado);
        }
    }

    @Test
    @DisplayName("R3 - usuarios: los derivados nunca superan el total (foto coherente)")
    void usuariosCoherentes() throws Exception {
        JsonNode usuarios = leer(mockMvc.perform(get(BASE)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn()).path("users");

        long total = usuarios.path("total").asLong();
        long admins = usuarios.path("admins").asLong();
        long suspendidos = usuarios.path("suspended").asLong();
        long nuevas = usuarios.path("newInPeriod").asLong();
        // V13 siembra al menos un admin: total ≥ 1 en cualquier BD saneada
        assertThat(total).isGreaterThanOrEqualTo(1);
        assertThat(admins).isBetween(0L, total);
        assertThat(suspendidos).isBetween(0L, total);
        assertThat(nuevas).isBetween(0L, total);
    }

    // ── R4: validación de days ─────────────────────────────────────────────

    @Test
    @DisplayName("R4 - days = 0 → 400 con message (handler existente, sin handlers nuevos)")
    void daysCeroDevuelve400ConMessage() throws Exception {
        mockMvc.perform(get(BASE)
                        .param("days", "0")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("R4 - days = 999 (fuera de 365) → 400 con message")
    void daysFueraDeRangoDevuelve400() throws Exception {
        mockMvc.perform(get(BASE)
                        .param("days", "999")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    @DisplayName("R4 - days = «abc» → 400 de conversión de tipo (Spring, message no exigido)")
    void daysNoNumericoDevuelve400() throws Exception {
        mockMvc.perform(get(BASE)
                        .param("days", "abc")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ── R5: seguridad ──────────────────────────────────────────────────────

    @Test
    @DisplayName("R5 - 401 sin token")
    void sinTokenDevuelve401() throws Exception {
        mockMvc.perform(get(BASE))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("R5 - 403 con token USER (hereda hasRole(ADMIN) de la 7.1)")
    void tokenUserDevuelve403() throws Exception {
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("R5 - 200 con token ADMIN")
    void tokenAdminDevuelve200() throws Exception {
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users.admins").isNumber());
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    private JsonNode leer(MvcResult resultado) throws Exception {
        return objectMapper.readTree(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
