package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.UserRepository;
import com.nexus.commerce.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("Debe registrar un usuario y enviar email de verificación")
    void shouldRegisterUserAndSendVerificationEmail() {
        // GIVEN
        RegisterRequest request = new RegisterRequest(
                "test@example.com",
                "password123",
                "Juan",
                "García",
                "612345678",
                LocalDate.of(1990, 1, 1),
                Gender.MALE,
                175.0,
                70.0
        );

        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashedPassword");

        // WHEN
        authService.register(request);

        // THEN
        verify(userRepository).save(any(User.class));
        verify(emailService).sendVerificationEmail(eq("test@example.com"), anyString());
    }

    @Test
    @DisplayName("Debe lanzar excepción si el email ya está registrado")
    void shouldThrowExceptionWhenEmailAlreadyExists() {
        // GIVEN
        RegisterRequest request = new RegisterRequest(
                "test@example.com",
                "password123",
                "Juan",
                "García",
                null,
                LocalDate.of(1990, 1, 1),
                Gender.MALE,
                null,
                null
        );

        when(userRepository.existsByEmail("test@example.com")).thenReturn(true);

        // WHEN & THEN
        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("email ya está registrado");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Debe verificar email con código correcto")
    void shouldVerifyEmailWithCorrectCode() {
        // GIVEN
        User user = User.builder()
                .email("test@example.com")
                .verificationCode("123456")
                .emailVerified(false)
                .build();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));

        // WHEN
        authService.verifyEmail("test@example.com", "123456");

        // THEN
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getVerificationCode()).isNull();
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("Debe lanzar excepción si el código de verificación es incorrecto")
    void shouldThrowExceptionWhenVerificationCodeIsIncorrect() {
        // GIVEN
        User user = User.builder()
                .email("test@example.com")
                .verificationCode("123456")
                .emailVerified(false)
                .build();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));

        // WHEN & THEN
        assertThatThrownBy(() -> authService.verifyEmail("test@example.com", "999999"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Código de verificación inválido");
    }

    @Test
    @DisplayName("Debe hacer login con credenciales correctas")
    void shouldLoginWithCorrectCredentials() {
        // GIVEN
        LoginRequest request = new LoginRequest("test@example.com", "password123");

        User user = User.builder()
                .id(1L)
                .email("test@example.com")
                .passwordHash("hashedPassword")
                .firstName("Juan")
                .lastName("García")
                .emailVerified(true)
                .build();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "hashedPassword")).thenReturn(true);
        when(jwtService.generateToken(1L, "test@example.com")).thenReturn("access-token");
        when(jwtService.generateRefreshToken(1L, "test@example.com")).thenReturn("refresh-token");

        // WHEN
        AuthResponse response = authService.login(request);

        // THEN
        assertThat(response.token()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
        assertThat(response.user().email()).isEqualTo("test@example.com");
    }

    @Test
    @DisplayName("Debe lanzar excepción si las credenciales son incorrectas")
    void shouldThrowExceptionWhenCredentialsAreIncorrect() {
        // GIVEN
        LoginRequest request = new LoginRequest("test@example.com", "wrongpassword");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.empty());

        // WHEN & THEN
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Credenciales inválidas");
    }

    @Test
    @DisplayName("Debe lanzar excepción si el email no está verificado")
    void shouldThrowExceptionWhenEmailIsNotVerified() {
        // GIVEN
        LoginRequest request = new LoginRequest("test@example.com", "password123");

        User user = User.builder()
                .email("test@example.com")
                .passwordHash("hashedPassword")
                .emailVerified(false)
                .build();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "hashedPassword")).thenReturn(true);

        // WHEN & THEN
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Email no verificado");
    }

    @Test
    @DisplayName("Debe recuperar contraseña y enviar email")
    void shouldForgotPasswordAndSendEmail() {
        // GIVEN
        User user = User.builder()
                .email("test@example.com")
                .build();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));

        // WHEN
        authService.forgotPassword("test@example.com");

        // THEN
        verify(userRepository).save(user);
        verify(emailService).sendPasswordResetEmail(eq("test@example.com"), anyString());
    }

    @Test
    @DisplayName("Debe resetear contraseña con código correcto")
    void shouldResetPasswordWithCorrectCode() {
        // GIVEN
        User user = User.builder()
                .email("test@example.com")
                .passwordHash("oldPassword")
                .verificationCode("123456")
                .build();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newPassword")).thenReturn("newHashedPassword");

        // WHEN
        authService.resetPassword("test@example.com", "123456", "newPassword");

        // THEN
        assertThat(user.getPasswordHash()).isEqualTo("newHashedPassword");
        assertThat(user.getVerificationCode()).isNull();
        verify(userRepository).save(user);
    }
}
