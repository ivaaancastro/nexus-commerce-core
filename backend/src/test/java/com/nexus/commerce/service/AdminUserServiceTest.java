package com.nexus.commerce.service;

import com.nexus.commerce.dto.AdminUserPageResponse;
import com.nexus.commerce.dto.AdminUserResponse;
import com.nexus.commerce.dto.AdminUserRoleRequest;
import com.nexus.commerce.dto.AdminUserSuspensionRequest;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.exception.UserConflictException;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tarea 7.5 (spec specs/admin-users/, R1–R3) — la lógica de las <strong>guardas
 * de bloqueo</strong> (plan D4) y del recorte de búsqueda, con el repositorio
 * mockeado: aquí sólo importa qué se decide y si se llega a escribir.
 *
 * <p>Las pruebas de «BD intacta» se expresan como {@code verify(save, never())}
 * — el intento fallido no puede haber persistido nada. La integración con
 * PostgreSQL real vive en {@code AdminUserControllerTest}.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Tarea 7.5 - AdminUserService: listado, guardas de rol y suspensión")
class AdminUserServiceTest {

    private static final String EMAIL_ADMIN = "admin@nexus.dev";
    private static final String OPERADOR = "operador@nexus.dev";

    @Mock private UserRepository userRepository;

    @InjectMocks private AdminUserService service;

    // ── C.1: listado ───────────────────────────────────────────────────────

    @Test
    @DisplayName("C.1 - recorta el término, pagina y deriva suspended de suspendedAt")
    void listadoRecortaTerminoYDevuelveLaPagina() {
        User activa = usuario(1L, "ana@nexus.dev", Role.USER, null);
        User suspendida = usuario(2L, "lola@nexus.dev", Role.USER, Instant.parse("2026-10-10T10:00:00Z"));
        when(userRepository.findAllForAdmin(eq("ana"), eq(PageRequest.of(1, 5))))
                .thenReturn(new PageImpl<>(List.of(activa, suspendida), PageRequest.of(1, 5), 7));

        AdminUserPageResponse respuesta = service.listar(1, 5, "   ana   ");

        verify(userRepository).findAllForAdmin("ana", PageRequest.of(1, 5));
        assertThat(respuesta.page()).isEqualTo(1);
        assertThat(respuesta.size()).isEqualTo(5);
        assertThat(respuesta.totalElements()).isEqualTo(7);
        assertThat(respuesta.totalPages()).isEqualTo(2);
        assertThat(respuesta.users()).hasSize(2);

        AdminUserResponse filaActiva = respuesta.users().getFirst();
        assertThat(filaActiva.suspended()).isFalse();
        assertThat(filaActiva.suspendedAt()).isNull();
        assertThat(filaActiva.role()).isEqualTo(Role.USER);

        AdminUserResponse filaSuspendida = respuesta.users().get(1);
        assertThat(filaSuspendida.suspended())
                .as("suspended se deriva en servidor de suspendedAt != null (plan D5)")
                .isTrue();
        assertThat(filaSuspendida.suspendedAt())
                .isEqualTo(Instant.parse("2026-10-10T10:00:00Z"));
    }

    @Test
    @DisplayName("C.1 - sin término o en blanco pasa null al repositorio (nunca cadena vacía)")
    void listadoSinTerminoONBlancoPasaNull() {
        when(userRepository.findAllForAdmin(isNull(), eq(PageRequest.of(0, 20))))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        service.listar(0, 20, null);
        service.listar(0, 20, "    ");

        verify(userRepository, org.mockito.Mockito.times(2))
                .findAllForAdmin(isNull(), eq(PageRequest.of(0, 20)));
    }

    @Test
    @DisplayName("C.1 - sin resultados: lista vacía con totales en cero (la página existe, R1)")
    void listadoVacioDevuelveListaVacia() {
        when(userRepository.findAllForAdmin(eq("nadie"), eq(PageRequest.of(0, 20))))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        AdminUserPageResponse respuesta = service.listar(0, 20, "nadie");

        assertThat(respuesta.users()).isEmpty();
        assertThat(respuesta.totalElements()).isZero();
        assertThat(respuesta.totalPages()).isZero();
    }

    // ── C.2: rol ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("C.2 - promover USER -> ADMIN devuelve el usuario actualizado")
    void promueveAAdmin() {
        User user = usuario(10L, "nuevo@nexus.dev", Role.USER, null);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        AdminUserResponse respuesta = service.cambiarRol(10L, new AdminUserRoleRequest(Role.ADMIN));

        assertThat(respuesta.role()).isEqualTo(Role.ADMIN);
        assertThat(respuesta.email()).isEqualTo("nuevo@nexus.dev");
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("C.2 - degradar con otro admin activo permitido (auto-degradación incluida, plan D4)")
    void degradaConOtroAdminActivo() {
        User unAdmin = usuario(11L, "otro@nexus.dev", Role.ADMIN, null);
        when(userRepository.findById(11L)).thenReturn(Optional.of(unAdmin));
        when(userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN)).thenReturn(2L);
        when(userRepository.save(unAdmin)).thenReturn(unAdmin);

        AdminUserResponse respuesta = service.cambiarRol(11L, new AdminUserRoleRequest(Role.USER));

        assertThat(respuesta.role()).isEqualTo(Role.USER);
        verify(userRepository).save(unAdmin);
    }

    @Test
    @DisplayName("C.2 - degradar al único admin activo -> 409 y la BD no cambia")
    void degradarAlUnicoAdminActivo409SinEscribir() {
        User ultimoAdmin = usuario(12L, EMAIL_ADMIN, Role.ADMIN, null);
        when(userRepository.findById(12L)).thenReturn(Optional.of(ultimoAdmin));
        when(userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service.cambiarRol(12L, new AdminUserRoleRequest(Role.USER)))
                .isInstanceOf(UserConflictException.class)
                .hasMessageContaining("único administrador");

        verify(userRepository, never()).save(any());
        assertThat(ultimoAdmin.getRole())
                .as("la guarda es previa a la escritura: el rol no se movió")
                .isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("C.2 - usuario inexistente -> 404")
    void rolUsuarioInexistente404() {
        when(userRepository.findById(999_999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cambiarRol(999_999L, new AdminUserRoleRequest(Role.ADMIN)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Usuario no encontrado");
    }

    // ── C.3: suspensión ────────────────────────────────────────────────────

    @Test
    @DisplayName("C.3 - suspender fija el instante y devuelve suspended true")
    void suspenderFijaInstante() {
        User user = usuario(20L, "cuenta@nexus.dev", Role.USER, null);
        when(userRepository.findById(20L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        AdminUserResponse respuesta = service.cambiarSuspension(20L,
                new AdminUserSuspensionRequest(true), OPERADOR);

        assertThat(respuesta.suspended()).isTrue();
        assertThat(respuesta.suspendedAt()).isNotNull();
        assertThat(user.getSuspendedAt()).isNotNull();
    }

    @Test
    @DisplayName("C.3 - restaurar limpia el instante conservando el rol")
    void restaurarConservaElRol() {
        User user = usuario(21L, "cuenta@nexus.dev", Role.ADMIN, Instant.parse("2026-10-01T08:00:00Z"));
        when(userRepository.findById(21L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        AdminUserResponse respuesta = service.cambiarSuspension(21L,
                new AdminUserSuspensionRequest(false), OPERADOR);

        assertThat(respuesta.suspended()).isFalse();
        assertThat(respuesta.suspendedAt()).isNull();
        assertThat(respuesta.role())
                .as("restaurar no toca el rol (R3)")
                .isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("C.3 - suspender una cuenta ya suspendida conserva el instante original")
    void suspensionIdempotenteConservaElInstante() {
        Instant original = Instant.parse("2026-09-30T12:00:00Z");
        User user = usuario(22L, "cuenta@nexus.dev", Role.USER, original);
        when(userRepository.findById(22L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        AdminUserResponse respuesta = service.cambiarSuspension(22L,
                new AdminUserSuspensionRequest(true), OPERADOR);

        assertThat(respuesta.suspendedAt())
                .as("no se pisa la fecha de la primera suspensión (R3)")
                .isEqualTo(original);
    }

    @Test
    @DisplayName("C.3 - restaurar una cuenta activa es un no-op sin errores")
    void restaurarYaActivaEsNoOp() {
        User user = usuario(23L, "cuenta@nexus.dev", Role.USER, null);
        when(userRepository.findById(23L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        AdminUserResponse respuesta = service.cambiarSuspension(23L,
                new AdminUserSuspensionRequest(false), OPERADOR);

        assertThat(respuesta.suspended()).isFalse();
        assertThat(respuesta.suspendedAt()).isNull();
    }

    @Test
    @DisplayName("C.3 - auto-suspensión -> 409 y la BD no cambia (plan D4)")
    void autoSuspension409SinEscribir() {
        User user = usuario(24L, OPERADOR, Role.ADMIN, null);
        when(userRepository.findById(24L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.cambiarSuspension(24L,
                new AdminUserSuspensionRequest(true), OPERADOR))
                .isInstanceOf(UserConflictException.class)
                .hasMessageContaining("No puedes suspenderte a ti mismo");

        verify(userRepository, never()).save(any());
        assertThat(user.getSuspendedAt()).isNull();
    }

    @Test
    @DisplayName("C.3 - suspender al único admin activo -> 409 y la BD no cambia (plan D4)")
    void suspenderAlUnicoAdminActivo409SinEscribir() {
        User ultimoAdmin = usuario(25L, EMAIL_ADMIN, Role.ADMIN, null);
        when(userRepository.findById(25L)).thenReturn(Optional.of(ultimoAdmin));
        when(userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service.cambiarSuspension(25L,
                new AdminUserSuspensionRequest(true), OPERADOR))
                .isInstanceOf(UserConflictException.class)
                .hasMessageContaining("único administrador");

        verify(userRepository, never()).save(any());
        assertThat(ultimoAdmin.getSuspendedAt())
                .as("la guarda es previa a la escritura: sigue activo")
                .isNull();
    }

    @Test
    @DisplayName("C.3 - suspender con cuenta inexistente -> 404")
    void suspensionUsuarioInexistente404() {
        when(userRepository.findById(999_999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cambiarSuspension(999_999L,
                new AdminUserSuspensionRequest(true), OPERADOR))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("C.3 - suspendido true sólo se evalúa en la rama de suspensión (restaurar no consulta el recuento)")
    void restaurarNoConsultaElRecuentoDeAdmins() {
        User user = usuario(26L, EMAIL_ADMIN, Role.ADMIN, Instant.parse("2026-10-01T08:00:00Z"));
        when(userRepository.findById(26L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        service.cambiarSuspension(26L, new AdminUserSuspensionRequest(false), OPERADOR);

        verify(userRepository, never()).countByRoleAndSuspendedAtIsNull(any());
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static User usuario(Long id, String email, Role role, Instant suspendido) {
        return User.builder()
                .id(id)
                .email(email)
                .passwordHash("$2a$12$hash")
                .firstName("Nombre")
                .lastName("Apellido")
                .role(role)
                .suspendedAt(suspendido)
                .build();
    }
}
