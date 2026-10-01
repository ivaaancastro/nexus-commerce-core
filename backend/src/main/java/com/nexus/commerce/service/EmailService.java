package com.nexus.commerce.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

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

    public void sendVerificationEmail(String to, String code) {
        if (isMailConfigured()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromEmail);
                message.setTo(to);
                message.setSubject("Verifica tu email - Nexus Core");
                message.setText("Tu código de verificación es: " + code + "\n\n" +
                        "Introdúcelo aquí: " + buildLink("/verify-email", to) + "\n\n" +
                        "Este código expira en 15 minutos.");
                mailSender.send(message);
                log.info("Email de verificación enviado a: {}", to);
            } catch (Exception e) {
                log.error("Error enviando email de verificación: {}", e.getMessage());
            }
        } else {
            log.info("=== MODO DESARROLLO - Email de verificación ===");
            log.info("Para: {}", to);
            log.info("Código de verificación: {}", code);
            log.info("Enlace: {}", buildLink("/verify-email", to));
            log.info("==============================================");
        }
    }

    public void sendPasswordResetEmail(String to, String code) {
        if (isMailConfigured()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromEmail);
                message.setTo(to);
                message.setSubject("Recuperación de contraseña - Nexus Core");
                message.setText("Tu código de recuperación es: " + code + "\n\n" +
                        "Introdúcelo aquí: " + buildLink("/forgot-password", to) + "\n\n" +
                        "Este código expira en 15 minutos.");
                mailSender.send(message);
                log.info("Email de recuperación enviado a: {}", to);
            } catch (Exception e) {
                log.error("Error enviando email de recuperación: {}", e.getMessage());
            }
        } else {
            log.info("=== MODO DESARROLLO - Recuperación de contraseña ===");
            log.info("Para: {}", to);
            log.info("Código de recuperación: {}", code);
            log.info("Enlace: {}", buildLink("/forgot-password", to));
            log.info("==================================================");
        }
    }

    /**
     * Construye un enlace absoluto al frontend con el email ya precargado,
     * para que el usuario no tenga que volver a escribirlo.
     */
    private String buildLink(String path, String email) {
        return baseUrl + path + "?email=" + URLEncoder.encode(email, StandardCharsets.UTF_8);
    }

    private boolean isMailConfigured() {
        return fromEmail != null && !fromEmail.isEmpty();
    }
}
