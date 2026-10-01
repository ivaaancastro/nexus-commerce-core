package com.nexus.commerce.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Tests del fix F1-F3: los emails deben llevar enlace al punto de entrada
 * donde se introduce el código, sin que el usuario tenga que adivinarlo.
 */
@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(emailService, "fromEmail", "no-reply@nexus.com");
        ReflectionTestUtils.setField(emailService, "baseUrl", "http://localhost:3000");
    }

    private SimpleMailMessage capturarEmailEnviado() {
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("El email de verificación debe incluir enlace a /verify-email con el email precargado")
    void debeIncluirEnlaceDeVerificacion() {
        // WHEN
        emailService.sendVerificationEmail("ivan@example.com", "123456");

        // THEN
        SimpleMailMessage mensaje = capturarEmailEnviado();
        assertThat(mensaje.getText())
                .contains("http://localhost:3000/verify-email?email=ivan%40example.com")
                .contains("123456");
    }

    @Test
    @DisplayName("El email de recuperación debe incluir enlace a /forgot-password con el email precargado")
    void debeIncluirEnlaceDeRecuperacion() {
        // WHEN
        emailService.sendPasswordResetEmail("ivan@example.com", "654321");

        // THEN
        SimpleMailMessage mensaje = capturarEmailEnviado();
        assertThat(mensaje.getText())
                .contains("http://localhost:3000/forgot-password?email=ivan%40example.com")
                .contains("654321");
    }

    @Test
    @DisplayName("El enlace debe respetar la URL base configurable app.base-url")
    void debeRespetarUrlBaseConfigurable() {
        // GIVEN
        ReflectionTestUtils.setField(emailService, "baseUrl", "https://nexus.example.com");

        // WHEN
        emailService.sendVerificationEmail("ivan@example.com", "123456");

        // THEN
        assertThat(capturarEmailEnviado().getText())
                .startsWith("Tu código de verificación es: 123456")
                .contains("https://nexus.example.com/verify-email?email=ivan%40example.com");
    }

    @Test
    @DisplayName("Sin correo configurado debe loguear el enlace en vez de enviar (modo desarrollo)")
    void debeLoguearEnlaceEnModoDesarrolloDeVerificacion() {
        // GIVEN
        ReflectionTestUtils.setField(emailService, "fromEmail", "");

        // WHEN
        emailService.sendVerificationEmail("ivan@example.com", "123456");

        // THEN
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("Sin correo configurado debe loguear el enlace de recuperación en vez de enviar")
    void debeLoguearEnlaceEnModoDesarrolloDeRecuperacion() {
        // GIVEN
        ReflectionTestUtils.setField(emailService, "fromEmail", null);

        // WHEN
        emailService.sendPasswordResetEmail("ivan@example.com", "654321");

        // THEN
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("Si el envío del correo falla no debe propagar la excepción")
    void noDebePropagarExcepcionSiElEnvioFalla() {
        // GIVEN
        doThrow(new RuntimeException("SMTP caído"))
                .when(mailSender).send(any(SimpleMailMessage.class));

        // WHEN - THEN
        assertThatCode(() -> emailService.sendVerificationEmail("ivan@example.com", "123456"))
                .doesNotThrowAnyException();
        assertThatCode(() -> emailService.sendPasswordResetEmail("ivan@example.com", "654321"))
                .doesNotThrowAnyException();
    }
}
