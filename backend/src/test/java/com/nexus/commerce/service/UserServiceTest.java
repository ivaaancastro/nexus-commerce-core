package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProfileUpdateRequest;
import com.nexus.commerce.dto.UserResponse;
import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final String EMAIL = "ana@example.com";

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    private User sampleUser() {
        return User.builder()
                .id(1L)
                .email(EMAIL)
                .firstName("Ana")
                .lastName("García")
                .phone("612345678")
                .birthDate(LocalDate.of(1990, 5, 20))
                .gender(Gender.FEMALE)
                .height(170.0)
                .weight(65.0)
                .emailVerified(true)
                .build();
    }

    // ── R1: consultar perfil ────────────────────────────────────────────────

    @Test
    @DisplayName("R1: debe devolver el perfil completo del usuario")
    void shouldReturnProfile() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(sampleUser()));

        // WHEN
        UserResponse response = userService.getProfile(EMAIL);

        // THEN
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.email()).isEqualTo(EMAIL);
        assertThat(response.firstName()).isEqualTo("Ana");
        assertThat(response.height()).isEqualTo(170.0);
        assertThat(response.weight()).isEqualTo(65.0);
    }

    @Test
    @DisplayName("R1: debe lanzar excepción si el usuario no existe")
    void shouldThrowWhenUserNotFound() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        // WHEN / THEN
        assertThatThrownBy(() -> userService.getProfile(EMAIL))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Usuario no encontrado");
    }

    // ── R2: actualizar perfil ───────────────────────────────────────────────

    @Test
    @DisplayName("R2: debe actualizar los datos modificados y persistirlos")
    void shouldUpdateProfile() {
        // GIVEN
        User user = sampleUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileUpdateRequest request = new ProfileUpdateRequest(
                "Ana María", "López", "699999999",
                LocalDate.of(1991, 3, 10), Gender.OTHER, 172.0, 68.0);

        // WHEN
        UserResponse response = userService.updateProfile(EMAIL, request);

        // THEN
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getFirstName()).isEqualTo("Ana María");
        assertThat(saved.getLastName()).isEqualTo("López");
        assertThat(saved.getPhone()).isEqualTo("699999999");
        assertThat(saved.getHeight()).isEqualTo(172.0);
        assertThat(saved.getWeight()).isEqualTo(68.0);
        assertThat(response.firstName()).isEqualTo("Ana María");
    }

    @Test
    @DisplayName("R2: el email nunca se modifica aunque venga en la petición")
    void shouldNeverChangeEmail() {
        // GIVEN
        User user = sampleUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileUpdateRequest request = new ProfileUpdateRequest(
                "Ana", "García", null, null, null, null, null);

        // WHEN
        userService.updateProfile(EMAIL, request);

        // THEN
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo(EMAIL);
    }

    @Test
    @DisplayName("R2: los campos nulos se ignoran (actualización parcial)")
    void shouldIgnoreNullFields() {
        // GIVEN
        User user = sampleUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileUpdateRequest request = new ProfileUpdateRequest(
                "Ana", null, null, null, null, null, null);

        // WHEN
        userService.updateProfile(EMAIL, request);

        // THEN
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getLastName()).isEqualTo("García");
        assertThat(captor.getValue().getHeight()).isEqualTo(170.0);
    }

    // ── R4: validación de medidas ───────────────────────────────────────────

    @Test
    @DisplayName("R4: debe rechazar una altura por debajo del rango (100 cm)")
    void shouldRejectHeightBelowRange() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(sampleUser()));
        ProfileUpdateRequest request = new ProfileUpdateRequest(
                null, null, null, null, null, 99.0, null);

        // WHEN / THEN
        assertThatThrownBy(() -> userService.updateProfile(EMAIL, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("altura debe estar entre 100 y 250 cm");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("R4: debe rechazar una altura por encima del rango (250 cm)")
    void shouldRejectHeightAboveRange() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(sampleUser()));
        ProfileUpdateRequest request = new ProfileUpdateRequest(
                null, null, null, null, null, 251.0, null);

        // WHEN / THEN
        assertThatThrownBy(() -> userService.updateProfile(EMAIL, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("altura debe estar entre 100 y 250 cm");
    }

    @Test
    @DisplayName("R4: debe rechazar un peso fuera del rango (30-250 kg)")
    void shouldRejectWeightOutsideRange() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(sampleUser()));
        ProfileUpdateRequest low = new ProfileUpdateRequest(
                null, null, null, null, null, null, 29.0);
        ProfileUpdateRequest high = new ProfileUpdateRequest(
                null, null, null, null, null, null, 251.0);

        // WHEN / THEN
        assertThatThrownBy(() -> userService.updateProfile(EMAIL, low))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("peso debe estar entre 30 y 250 kg");

        assertThatThrownBy(() -> userService.updateProfile(EMAIL, high))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("peso debe estar entre 30 y 250 kg");
    }

    @Test
    @DisplayName("R4: acepta los valores límite exactos del rango")
    void shouldAcceptBoundaryValues() {
        // GIVEN
        User user = sampleUser();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        ProfileUpdateRequest request = new ProfileUpdateRequest(
                null, null, null, null, null, 100.0, 30.0);

        // WHEN
        UserResponse response = userService.updateProfile(EMAIL, request);

        // THEN
        assertThat(response.height()).isEqualTo(100.0);
        assertThat(response.weight()).isEqualTo(30.0);
    }

    // ── Validación de fecha de nacimiento (regla frontend #10) ──────────────

    @Test
    @DisplayName("Debe rechazar una fecha de nacimiento futura")
    void shouldRejectFutureBirthDate() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(sampleUser()));
        ProfileUpdateRequest request = new ProfileUpdateRequest(
                null, null, null, LocalDate.now().plusDays(1), null, null, null);

        // WHEN / THEN
        assertThatThrownBy(() -> userService.updateProfile(EMAIL, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no puede ser futura");
    }

    @Test
    @DisplayName("Debe rechazar una fecha de nacimiento anterior a 1900")
    void shouldRejectBirthDateBefore1900() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(sampleUser()));
        ProfileUpdateRequest request = new ProfileUpdateRequest(
                null, null, null, LocalDate.of(1899, 12, 31), null, null, null);

        // WHEN / THEN
        assertThatThrownBy(() -> userService.updateProfile(EMAIL, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("anterior a 1900");
    }
}
