package com.nexus.commerce.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public void sendVerificationEmail(String to, String code) {
        if (isMailConfigured()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromEmail);
                message.setTo(to);
                message.setSubject("Verifica tu email - Nexus Core");
                message.setText("Tu código de verificación es: " + code + "\n\n" +
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
            log.info("==================================================");
        }
    }

    private boolean isMailConfigured() {
        return fromEmail != null && !fromEmail.isEmpty();
    }
}
