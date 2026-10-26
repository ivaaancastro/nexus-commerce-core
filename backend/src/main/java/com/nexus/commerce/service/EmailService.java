package com.nexus.commerce.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Envío de emails de la cuenta y de los pedidos.
 *
 * <p><strong>V1 {@code order-status-emails}</strong>: los tres tipos de email
 * pasan a compartir la plantilla HTML de {@link EmailHtmlTemplates} y el envío
 * usa <strong>{@code MimeMessageHelper} multipart</strong> con
 * {@code multipart/alternative} — HTML + texto plano de respaldo (RT3/D6).</p>
 *
 * <p>El guard {@code isMailConfigured()} <strong>no cambia</strong>: sin
 * credenciales (<code>spring.mail.username</code> vacío) corre el <strong>MODO
 * DESARROLLO</strong>, que <em>loguea</em> el contenido completo — así local y
 * CI nunca abren red (D11/R6).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    /** URL base del frontend para los enlaces que viajan en los emails. */
    @Value("${app.base-url:http://localhost:3000}")
    private String baseUrl;

    // ── Verificación de cuenta ─────────────────────────────────────────────

    public void sendVerificationEmail(String to, String code) {
        EmailHtmlTemplates.Mensaje mensaje = contenidoVerificacion(to, code);
        if (isMailConfigured()) {
            try {
                enviarMultipart(to, mensaje);
                log.info("Email de verificación enviado a: {}", to);
            } catch (Exception e) {
                log.error("Error enviando email de verificación: {}", e.getMessage());
            }
        } else {
            loguearModoDesarrollo("Email de verificación", to, mensaje);
        }
    }

    public void sendPasswordResetEmail(String to, String code) {
        EmailHtmlTemplates.Mensaje mensaje = contenidoRecuperacion(to, code);
        if (isMailConfigured()) {
            try {
                enviarMultipart(to, mensaje);
                log.info("Email de recuperación enviado a: {}", to);
            } catch (Exception e) {
                log.error("Error enviando email de recuperación: {}", e.getMessage());
            }
        } else {
            loguearModoDesarrollo("Recuperación de contraseña", to, mensaje);
        }
    }

    // ── Pedidos (lo consume el poller del outbox) ──────────────────────────

    /**
     * Envía un email de pedido ya compuesto (R3).
     *
     * <p><strong>A diferencia de los otros dos, aquí el aislamiento de errores
     * no vive en el servicio sino en el poller del outbox</strong> (D3/RT5):
     * él es quien decide si reintentar y si marcar la fila {@code FAILED}, así
     * que cualquier fallo <em>propaga</em> para que la fila conserve el motivo
     * en {@code last_error}. Nadie más llama a este método.</p>
     */
    public void enviarPedido(String to, EmailHtmlTemplates.Mensaje mensaje) throws Exception {
        if (isMailConfigured()) {
            enviarMultipart(to, mensaje);
        } else {
            loguearModoDesarrollo("Pedido", to, mensaje);
        }
    }

    // ── Composiciones (visibles para el preview y los tests) ───────────────

    /**
     * Cuerpo del email de verificación (D5: copy escrito una sola vez, aquí,
     * y el preview de E1 lo reutiliza tal cual). El enlace se construye con el
     * <strong>email precargado</strong> — lo exigen los tests F1/F3 y lo
     * espera la web ({@code /verify-email?email=...}).
     */
    EmailHtmlTemplates.Mensaje contenidoVerificacion(String email, String code) {
        String enlace = buildLink("/verify-email", email);
        String texto = "Tu código de verificación es: " + code + "\n\n" +
                "Introdúcelo aquí: " + enlace + "\n\n" +
                "Este código expira en 15 minutos.";
        String html = EmailHtmlTemplates.envoltorio("Verifica tu email",
                EmailHtmlTemplates.parrafo(
                        "Tu código de verificación es el siguiente. Introdúcelo en la web para confirmar tu cuenta.")
                        + "\n" + EmailHtmlTemplates.codigo(code) + "\n"
                        + EmailHtmlTemplates.boton(enlace, "Introducir código") + "\n"
                        + EmailHtmlTemplates.parrafo("Este código expira en 15 minutos."));
        return new EmailHtmlTemplates.Mensaje("Verifica tu email - Nexus Core", html, texto);
    }

    /** Cuerpo del email de recuperación de contraseña (enlace con el email precargado). */
    EmailHtmlTemplates.Mensaje contenidoRecuperacion(String email, String code) {
        String enlace = buildLink("/forgot-password", email);
        String texto = "Tu código de recuperación es: " + code + "\n\n" +
                "Introdúcelo aquí: " + enlace + "\n\n" +
                "Este código expira en 15 minutos.";
        String html = EmailHtmlTemplates.envoltorio("Recupera tu contraseña",
                EmailHtmlTemplates.parrafo(
                        "Hemos recibido una solicitud para recuperar tu contraseña. Introduce este código en la web:")
                        + "\n" + EmailHtmlTemplates.codigo(code) + "\n"
                        + EmailHtmlTemplates.boton(enlace, "Recuperar contraseña") + "\n"
                        + EmailHtmlTemplates.parrafo(
                                "Este código expira en 15 minutos. Si no has sido tú, ignora este correo."));
        return new EmailHtmlTemplates.Mensaje("Recuperación de contraseña - Nexus Core", html, texto);
    }

    // ── Internos ───────────────────────────────────────────────────────────

    /**
     * Envío multipart real: HTML + texto plano ({@code multipart/alternative}),
     * UTF-8. Lanza excepción al fallar — el caller decide el aislamiento.
     */
    private void enviarMultipart(String to, EmailHtmlTemplates.Mensaje mensaje) throws Exception {
        MimeMessage mimeMessage = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, StandardCharsets.UTF_8.name());
        helper.setFrom(fromEmail);
        helper.setTo(to);
        helper.setSubject(mensaje.asunto());
        helper.setText(mensaje.texto(), mensaje.html());
        mailSender.send(mimeMessage);
    }

    /** MODO DESARROLLO (D11): sin credenciales se loguea TODO, incluido el HTML. */
    private void loguearModoDesarrollo(String tipo, String to, EmailHtmlTemplates.Mensaje mensaje) {
        log.info("=== MODO DESARROLLO - {} ===", tipo);
        log.info("Para: {}", to);
        log.info("Asunto: {}", mensaje.asunto());
        log.info("Texto: {}", mensaje.texto());
        log.info("HTML:\n{}", mensaje.html());
        log.info("==============================================");
    }

    /**
     * Construye un enlace absoluto al frontend.
     * <p>
     * NOTA (V1): el email de verificación/recuperación <strong>conserva su
     * enlace histórico</strong> con el parámetro {@code ?email=} precargado —
     * los tests F1-F3 lo verifican y la web lo espera.
     */
    String buildLink(String path, String email) {
        String enlace = baseUrl + path;
        if (email != null && !email.isEmpty()) {
            enlace += "?email=" + URLEncoder.encode(email, StandardCharsets.UTF_8);
        }
        return enlace;
    }

    private boolean isMailConfigured() {
        return fromEmail != null && !fromEmail.isEmpty();
    }
}
