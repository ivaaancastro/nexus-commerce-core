package com.nexus.commerce.service;

import jakarta.mail.BodyPart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Tests del fix F1-F3: los emails deben llevar enlace al punto de entrada
 * donde se introduce el código, sin que el usuario tenga que adivinarlo.
 *
 * <p><strong>R8.3 (V1 order-status-emails)</strong>: al pasar de
 * {@code SimpleMailMessage} a <strong>{@code MimeMessage} multipart</strong>
 * (RT3), la captura se adapta a {@code MimeMessage} — <strong>las aserciones
 * son las mismas</strong>: asunto, código y enlace con el email precargado. Se
 * <em>añade</em> cobertura de las partes HTML y del método de pedidos.</p>
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
        // El sender real crea el MimeMessage sin red; aquí basta uno de fábrica.
        lenient().when(mailSender.createMimeMessage())
                .thenAnswer(invoco -> new MimeMessage(Session.getInstance(new Properties())));
    }

    private MimeMessage capturarEmailEnviado() {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        return captor.getValue();
    }

    /** Parte de texto plano o HTML del multipart/alternative, sea cual sea el anidado. */
    private static String cuerpo(MimeMessage mensaje, boolean html) throws Exception {
        // JavaMail sólo escribe los Content-Type reales al serializar: sin
        // saveChanges(), todas las partes reportan text/plain (en producción
        // lo hace el propio sender antes de transmitir).
        mensaje.saveChanges();
        List<String> encontrados = new ArrayList<>();
        Object raiz = mensaje.getContent();
        if (raiz instanceof MimeMultipart multipart) {
            recopilar(multipart, html, encontrados);
        } else if (raiz instanceof String texto && esHtml(mensaje.getContentType()) == html) {
            encontrados.add(texto);
        }
        assertThat(encontrados)
                .as("parte %s del multipart", html ? "HTML" : "texto plano")
                .isNotEmpty();
        return encontrados.get(0);
    }

    private static void recopilar(MimeMultipart multipart, boolean html, List<String> salida) throws Exception {
        for (int i = 0; i < multipart.getCount(); i++) {
            BodyPart parte = multipart.getBodyPart(i);
            Object contenido = parte.getContent();
            if (contenido instanceof MimeMultipart anidada) {
                recopilar(anidada, html, salida);
            } else if (contenido instanceof String texto && esHtml(parte.getContentType()) == html) {
                salida.add(texto);
            }
        }
    }

    private static boolean esHtml(String contentType) {
        return contentType != null && contentType.toLowerCase().contains("html");
    }

    // ── F1-F3: mismo enlace, mismo código, misma aserción ───────────────────

    @Test
    @DisplayName("El email de verificación debe incluir enlace a /verify-email con el email precargado")
    void debeIncluirEnlaceDeVerificacion() throws Exception {
        // WHEN
        emailService.sendVerificationEmail("ivan@example.com", "123456");

        // THEN
        MimeMessage mensaje = capturarEmailEnviado();
        assertThat(mensaje.getSubject()).isEqualTo("Verifica tu email - Nexus Core");
        assertThat(cuerpo(mensaje, false))
                .contains("http://localhost:3000/verify-email?email=ivan%40example.com")
                .contains("123456");
        // V1: el mismo enlace viaja en la parte HTML (multipart/alternative)
        assertThat(cuerpo(mensaje, true))
                .contains("http://localhost:3000/verify-email?email=ivan%40example.com");
    }

    @Test
    @DisplayName("El email de recuperación debe incluir enlace a /forgot-password con el email precargado")
    void debeIncluirEnlaceDeRecuperacion() throws Exception {
        // WHEN
        emailService.sendPasswordResetEmail("ivan@example.com", "654321");

        // THEN
        MimeMessage mensaje = capturarEmailEnviado();
        assertThat(mensaje.getSubject()).isEqualTo("Recuperación de contraseña - Nexus Core");
        assertThat(cuerpo(mensaje, false))
                .contains("http://localhost:3000/forgot-password?email=ivan%40example.com")
                .contains("654321");
        assertThat(cuerpo(mensaje, true))
                .contains("http://localhost:3000/forgot-password?email=ivan%40example.com");
    }

    @Test
    @DisplayName("El enlace debe respetar la URL base configurable app.base-url")
    void debeRespetarUrlBaseConfigurable() throws Exception {
        // GIVEN
        ReflectionTestUtils.setField(emailService, "baseUrl", "https://nexus.example.com");

        // WHEN
        emailService.sendVerificationEmail("ivan@example.com", "123456");

        // THEN
        assertThat(cuerpo(capturarEmailEnviado(), false))
                .startsWith("Tu código de verificación es: 123456")
                .contains("https://nexus.example.com/verify-email?email=ivan%40example.com");
    }

    // ── MODO DESARROLLO y fallos ────────────────────────────────────────────

    @Test
    @DisplayName("Sin correo configurado debe loguear el enlace en vez de enviar (modo desarrollo)")
    void debeLoguearEnlaceEnModoDesarrolloDeVerificacion() {
        // GIVEN
        ReflectionTestUtils.setField(emailService, "fromEmail", "");

        // WHEN
        emailService.sendVerificationEmail("ivan@example.com", "123456");

        // THEN
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    @DisplayName("Sin correo configurado debe loguear el enlace de recuperación en vez de enviar")
    void debeLoguearEnlaceEnModoDesarrolloDeRecuperacion() {
        // GIVEN
        ReflectionTestUtils.setField(emailService, "fromEmail", null);

        // WHEN
        emailService.sendPasswordResetEmail("ivan@example.com", "654321");

        // THEN
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    @DisplayName("Si el envío del correo falla no debe propagar la excepción")
    void noDebePropagarExcepcionSiElEnvioFalla() {
        // GIVEN
        doThrow(new RuntimeException("SMTP caído"))
                .when(mailSender).send(any(MimeMessage.class));

        // WHEN - THEN
        assertThatCode(() -> emailService.sendVerificationEmail("ivan@example.com", "123456"))
                .doesNotThrowAnyException();
        assertThatCode(() -> emailService.sendPasswordResetEmail("ivan@example.com", "654321"))
                .doesNotThrowAnyException();
    }

    // ── V1: email de pedido ─────────────────────────────────────────────────

    @Test
    @DisplayName("El email de pedido debe llevar asunto, destinatario y multipart HTML+texto (RT3)")
    void debeEnviarPedidoConAsuntoYMultipart() throws Exception {
        // GIVEN
        EmailHtmlTemplates.Mensaje mensaje =
                new EmailHtmlTemplates.Mensaje("Nexus · Pedido NEX-1 — Enviado", "<p>HTML</p>", "Enviado\n\nVer tu pedido");

        // WHEN — el poller del outbox es el único caller (D3)
        emailService.enviarPedido("ivan@example.com", mensaje);

        // THEN
        MimeMessage enviado = capturarEmailEnviado();
        assertThat(enviado.getSubject()).isEqualTo("Nexus · Pedido NEX-1 — Enviado");
        assertThat(enviado.getAllRecipients()[0].toString()).isEqualTo("ivan@example.com");
        assertThat(cuerpo(enviado, true)).isEqualTo("<p>HTML</p>");
        assertThat(cuerpo(enviado, false)).isEqualTo("Enviado\n\nVer tu pedido");
    }

    @Test
    @DisplayName("El email de pedido sin credenciales se loguea y no toca red (R6/D11)")
    void noDebeTocarRedElPedidoEnModoDesarrollo() {
        // GIVEN
        ReflectionTestUtils.setField(emailService, "fromEmail", "");
        EmailHtmlTemplates.Mensaje mensaje =
                new EmailHtmlTemplates.Mensaje("Asunto", "<p>HTML</p>", "Texto");

        // WHEN - THEN
        assertThatCode(() -> emailService.enviarPedido("ivan@example.com", mensaje))
                .doesNotThrowAnyException();
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    @DisplayName("El email de pedido sí propaga el fallo: el poller decide reintentos (D3/RT5)")
    void elPedidoPropagaElFalloParaElPoller() {
        // GIVEN
        doThrow(new RuntimeException("SMTP caído"))
                .when(mailSender).send(any(MimeMessage.class));
        EmailHtmlTemplates.Mensaje mensaje = new EmailHtmlTemplates.Mensaje("Asunto", "<p>HTML</p>", "Texto");

        // WHEN - THEN — a diferencia de verificación/reset, aquí manda el outbox
        assertThatCode(() -> emailService.enviarPedido("ivan@example.com", mensaje))
                .hasMessageContaining("SMTP caído");
        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    @DisplayName("Los emails de cuenta comparten el envoltorio NEXUS con la pila Geist (R7)")
    void losTiposDeCuentaCompartenEnvoltorio() throws Exception {
        // WHEN
        emailService.sendVerificationEmail("ivan@example.com", "123456");
        String verificacion = cuerpo(capturarEmailEnviado(), true);

        org.mockito.Mockito.clearInvocations(mailSender);
        emailService.sendPasswordResetEmail("ivan@example.com", "654321");
        String recuperacion = cuerpo(capturarEmailEnviado(), true);

        // THEN — el de pedido lo compone OrderEmailNotifierTest (su propio test)
        assertThat(verificacion).contains("NEXUS").contains("Geist");
        assertThat(recuperacion).contains("NEXUS").contains("Geist");
    }
}
