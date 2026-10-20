package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.UserRepository;
import com.nexus.commerce.security.JwtService;
import org.junit.jupiter.api.AfterEach;
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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 7.5 (spec specs/admin-users/, R1–R5) — gestión de usuarios bajo
 * {@code /api/v1/admin/users}, con <strong>backend real</strong>: PostgreSQL +
 * Flyway V15 + Spring Security.
 *
 * <p><strong>BD compartida limpia (tasks C.6, plan D10)</strong>: el usuario
 * propio {@code test-7501@nexus.dev} se crea en {@code @BeforeEach} y todo lo
 * que lleve «7501» se borra en {@code @AfterEach}. <strong>Nunca se modifica
 * {@code admin@nexus.dev}</strong> (es el único admin activo: las guardas de
 * 409 se prueban contra él y los intentos fallidos no escriben) <strong>ni
 * {@code e2e@nexus.dev}</strong> (rompería el E2E).</p>
 *
 * <p>Los tokens son de sólo-token (patrón de {@code AdminOrderControllerTest}):
 * la autoría de la auto-suspensión se resuelve con el email del token, así que
 * el token «operador» existe para tener un ADMIN llamante distinto del objetivo
 * en las guardas de «último admin».</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Tarea 7.5 - Gestión de usuarios en la zona admin")
class AdminUserControllerTest {

    private static final String BASE = "/api/v1/admin/users";
    private static final String EMAIL_TEST = "test-7501@nexus.dev";
    private static final String MARCA = "7501";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private UserRepository userRepository;

    private String adminToken;
    private String operadorToken;
    private String userToken;
    private User testUser;
    private Long adminId;

    @BeforeEach
    void preparar() {
        limpiarDatos();
        adminToken = jwtService.generateToken(999L, "admin-7501@nexus.test", Role.ADMIN);
        // ADMIN con email distinto del objetivo: sin él, la guarda de «último
        // admin» dispararía siempre la de auto-suspensión primero.
        operadorToken = jwtService.generateToken(997L, "operador-7501@nexus.test", Role.ADMIN);
        userToken = jwtService.generateToken(998L, "user-7501@nexus.test", Role.USER);

        testUser = guardarUsuario(EMAIL_TEST, "Prueba", "Setenta");
        adminId = userRepository.findByEmail("admin@nexus.dev")
                .orElseThrow(() -> new IllegalStateException("V13 debió sembrar admin@nexus.dev"))
                .getId();
    }

    @AfterEach
    void despuesDeCadaTest() {
        limpiarDatos();
    }

    // ── R1: listado ────────────────────────────────────────────────────────

    @Test
    @DisplayName("R1 - GET devuelve 200 al ADMIN con el shape y las filas sembradas")
    void listado200ConShape() throws Exception {
        MvcResult resultado = mockMvc.perform(get(BASE)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andReturn();

        JsonNode json = leerJson(resultado);
        assertThat(json.get("totalElements").asLong()).isGreaterThanOrEqualTo(2);
        assertThat(json.get("totalPages").asInt()).isGreaterThanOrEqualTo(1);

        JsonNode filaAdmin = filaDe(json, "admin@nexus.dev");
        assertThat(filaAdmin).as("el admin sembrado debe listarse").isNotNull();
        assertThat(filaAdmin.get("role").asText()).isEqualTo("ADMIN");
        assertThat(filaAdmin.get("suspended").asBoolean()).isFalse();
        assertThat(filaAdmin.get("suspendedAt").isNull()).isTrue();
        assertThat(filaAdmin.get("createdAt").asText()).isNotBlank();

        JsonNode filaTest = filaDe(json, EMAIL_TEST);
        assertThat(filaTest).isNotNull();
        assertThat(filaTest.get("role").asText()).isEqualTo("USER");
        assertThat(filaTest.get("suspended").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("R1 - búsqueda q por email (mayúsculas) y por apellido, case-insensitive")
    void busquedaPorEmailYNombre() throws Exception {
        JsonNode porEmail = buscar("TEST-7501@NEXUS");
        assertThat(emailsDe(porEmail)).contains(EMAIL_TEST)
                .doesNotContain("admin@nexus.dev");

        JsonNode porApellido = buscar("setenta");
        assertThat(emailsDe(porApellido)).contains(EMAIL_TEST)
                .doesNotContain("admin@nexus.dev");
    }

    @Test
    @DisplayName("R1 - q vacío o en blanco = sin filtro (no hay que distinguirlo de ausente)")
    void qEnBlancoSinFiltro() throws Exception {
        JsonNode json = leerJson(mockMvc.perform(get(BASE).param("q", "  ")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn());

        assertThat(emailsDe(json)).contains(EMAIL_TEST, "admin@nexus.dev");
    }

    @Test
    @DisplayName("R1 - orden createdAt DESC, id DESC como desempate (estable entre páginas)")
    void ordenCreatedAtDesc() throws Exception {
        guardarUsuario("ord-7501-a@nexus.dev", "Orden", "Primero");
        guardarUsuario("ord-7501-b@nexus.dev", "Orden", "Segundo");

        JsonNode json = buscar("ord-7501");
        List<String> emails = emailsDe(json);

        assertThat(emails).hasSize(2);
        assertThat(emails.get(0))
                .as("el creado después (y con id mayor) va primero")
                .isEqualTo("ord-7501-b@nexus.dev");
        assertThat(emails.get(1)).isEqualTo("ord-7501-a@nexus.dev");
    }

    @Test
    @DisplayName("R1 - sin resultados -> 200 con lista vacía, nunca 404")
    void busquedaSinResultados() throws Exception {
        JsonNode json = buscar("zombie-que-no-existe");

        assertThat(json.get("users").isEmpty()).isTrue();
        assertThat(json.get("totalElements").asLong()).isZero();
        assertThat(json.get("totalPages").asInt()).isZero();
    }

    @Test
    @DisplayName("R1 - paginación: size respeta el límite de página y los totales son globales")
    void paginacionSizeYTotales() throws Exception {
        JsonNode json = leerJson(mockMvc.perform(get(BASE).param("size", "1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1))
                .andReturn());

        assertThat(json.get("users").size()).isEqualTo(1);
        assertThat(json.get("totalElements").asLong()).isGreaterThanOrEqualTo(2);
        assertThat(json.get("totalPages").asInt()).isGreaterThanOrEqualTo(2);
    }

    @Test
    @DisplayName("R1 - page negativo -> 400")
    void pageNegativo400() throws Exception {
        mockMvc.perform(get(BASE).param("page", "-1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    // ── R2: rol ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("R2 - promover y degradar devuelve el usuario actualizado (sin re-fetch en la UI)")
    void rol200PromueveYDegrada() throws Exception {
        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/role")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.email").value(EMAIL_TEST));

        // Queda admin@nexus.dev + el promovido -> la degradación pasa la guarda
        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/role")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"USER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("USER"));

        assertThat(userRepository.findById(testUser.getId()).orElseThrow().getRole())
                .isEqualTo(Role.USER);
    }

    @Test
    @DisplayName("R2 - degradar al único admin activo -> 409 USER_CONFLICT y la BD queda intacta")
    void rol409UnicoAdminYBdIntacta() throws Exception {
        mockMvc.perform(put(BASE + "/" + adminId + "/role")
                        .header("Authorization", "Bearer " + operadorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"USER\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_CONFLICT"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString(
                        "único administrador")));

        assertThat(userRepository.findById(adminId).orElseThrow().getRole())
                .as("el intento fallido no puede haber escrito nada")
                .isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("R2 - id inexistente -> 404")
    void rol404() throws Exception {
        mockMvc.perform(put(BASE + "/123456789/role")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("R2 - rol ausente -> 400 con message; rol desconocido -> 400 con message")
    void rol400Validacion() throws Exception {
        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/role")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());

        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/role")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ZOMBIE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    // ── R3: suspensión ─────────────────────────────────────────────────────

    @Test
    @DisplayName("R3 - suspender fija suspendedAt y restaurar lo limpia conservando el rol")
    void suspension200SuspendeYRestaura() throws Exception {
        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/suspension")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suspended").value(true))
                .andExpect(jsonPath("$.suspendedAt").isNotEmpty())
                .andExpect(jsonPath("$.role").value("USER"));

        User enBd = userRepository.findById(testUser.getId()).orElseThrow();
        assertThat(enBd.getSuspendedAt()).isNotNull();
        assertThat(enBd.getRole()).isEqualTo(Role.USER);

        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/suspension")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suspended").value(false))
                .andExpect(jsonPath("$.suspendedAt").doesNotExist())
                .andExpect(jsonPath("$.role").value("USER"));

        assertThat(userRepository.findById(testUser.getId()).orElseThrow().getSuspendedAt())
                .isNull();
    }

    @Test
    @DisplayName("R3 - idempotente: la segunda suspensión conserva el instante original")
    void suspensionIdempotenteConservaInstante() throws Exception {
        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/suspension")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":true}"))
                .andExpect(status().isOk());

        var instanteOriginal = userRepository.findById(testUser.getId()).orElseThrow().getSuspendedAt();
        assertThat(instanteOriginal).isNotNull();

        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/suspension")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":true}"))
                .andExpect(status().isOk());

        var trasSegunda = userRepository.findById(testUser.getId()).orElseThrow().getSuspendedAt();
        assertThat(trasSegunda)
                .as("no se pisa la fecha de la primera suspensión")
                .isEqualTo(instanteOriginal);
    }

    @Test
    @DisplayName("R3 - auto-suspensión -> 409 USER_CONFLICT con mensaje propio y sin escribir")
    void suspension409AutoSuspension() throws Exception {
        String tokenPropio = jwtService.generateToken(testUser.getId(), EMAIL_TEST, Role.ADMIN);

        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/suspension")
                        .header("Authorization", "Bearer " + tokenPropio)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":true}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_CONFLICT"))
                .andExpect(jsonPath("$.message").value("No puedes suspenderte a ti mismo"));

        assertThat(userRepository.findById(testUser.getId()).orElseThrow().getSuspendedAt())
                .as("la guarda es previa a la escritura")
                .isNull();
    }

    @Test
    @DisplayName("R3 - suspender al único admin activo -> 409 USER_CONFLICT y sigue activo")
    void suspension409UnicoAdmin() throws Exception {
        mockMvc.perform(put(BASE + "/" + adminId + "/suspension")
                        .header("Authorization", "Bearer " + operadorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":true}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_CONFLICT"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString(
                        "único administrador")));

        User admin = userRepository.findById(adminId).orElseThrow();
        assertThat(admin.getSuspendedAt())
                .as("admin@nexus.dev no se toca: ni suspendido ni degradado")
                .isNull();
    }

    @Test
    @DisplayName("R3 - campo ausente -> 400 con message; valor no convertible -> 400 con message")
    void suspension400Validacion() throws Exception {
        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/suspension")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());

        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/suspension")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":\"quizas\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    @DisplayName("R3 - id inexistente -> 404")
    void suspension404() throws Exception {
        mockMvc.perform(put(BASE + "/123456789/suspension")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":true}"))
                .andExpect(status().isNotFound());
    }

    // ── R5: seguridad heredada ─────────────────────────────────────────────

    @Test
    @DisplayName("R5 - 401 sin token, 403 con rol USER, 200 con ADMIN (hereda /admin/** de la 7.1)")
    void seguridadDeLaZonaAdmin() throws Exception {
        mockMvc.perform(get(BASE))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/role")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(BASE + "/" + testUser.getId() + "/suspension")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suspended\":true}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private User guardarUsuario(String email, String nombre, String apellido) {
        return userRepository.saveAndFlush(User.builder()
                .email(email)
                .passwordHash("$2a$12$h3jcGaSiAWFCsNvE6qAyHeOMnTCFOPpdkkw7O0ypSqx4n1Wkhbpjq")
                .firstName(nombre)
                .lastName(apellido)
                .birthDate(LocalDate.of(1990, 1, 1))
                .gender(Gender.OTHER)
                .emailVerified(true)
                .build());
    }

    private JsonNode buscar(String q) throws Exception {
        return leerJson(mockMvc.perform(get(BASE).param("q", q)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn());
    }

    private JsonNode leerJson(MvcResult resultado) throws Exception {
        return objectMapper.readTree(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private JsonNode filaDe(JsonNode lista, String email) {
        for (JsonNode fila : lista.get("users")) {
            if (email.equals(fila.get("email").asText())) {
                return fila;
            }
        }
        return null;
    }

    private List<String> emailsDe(JsonNode lista) {
        List<String> emails = new ArrayList<>();
        for (JsonNode fila : lista.get("users")) {
            emails.add(fila.get("email").asText());
        }
        return emails;
    }

    /**
     * Borra TODO lo propio de este test — cualquier usuario cuyo email lleve la
     * marca «7501». Los sembrados ({@code admin@nexus.dev}, {@code e2e@nexus.dev})
     * no la contienen y jamás se borran ni se modifican (plan D10).
     */
    private void limpiarDatos() {
        List<User> propias = userRepository.findAll().stream()
                .filter(u -> u.getEmail() != null && u.getEmail().contains(MARCA))
                .toList();
        if (!propias.isEmpty()) {
            userRepository.deleteAll(propias);
            userRepository.flush();
        }
    }
}
