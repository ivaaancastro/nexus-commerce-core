package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.UserRepository;
import com.nexus.commerce.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;

    private static final int VERIFICATION_CODE_LENGTH = 6;
    private static final int VERIFICATION_CODE_EXPIRY_MINUTES = 15;

    public void register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("El email ya está registrado");
        }

        String verificationCode = generateVerificationCode();

        User user = User.builder()
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .firstName(request.firstName())
                .lastName(request.lastName())
                .phone(request.phone())
                .birthDate(request.birthDate())
                .gender(request.gender())
                .height(request.height())
                .weight(request.weight())
                .emailVerified(false)
                .verificationCode(verificationCode)
                .build();

        userRepository.save(user);
        emailService.sendVerificationEmail(user.getEmail(), verificationCode);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalArgumentException("Credenciales inválidas"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Credenciales inválidas");
        }

        if (!user.isEmailVerified()) {
            throw new IllegalStateException("Email no verificado");
        }

        return buildAuthResponse(user);
    }

    public void verifyEmail(String email, String code) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (user.isEmailVerified()) {
            throw new IllegalStateException("El email ya está verificado");
        }

        if (!code.equals(user.getVerificationCode())) {
            throw new IllegalArgumentException("Código de verificación inválido");
        }

        user.setEmailVerified(true);
        user.setVerificationCode(null);
        userRepository.save(user);
    }

    public void resendVerificationCode(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (user.isEmailVerified()) {
            throw new IllegalStateException("El email ya está verificado");
        }

        String newCode = generateVerificationCode();
        user.setVerificationCode(newCode);
        userRepository.save(user);
        emailService.sendVerificationEmail(user.getEmail(), newCode);
    }

    public void forgotPassword(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        String resetCode = generateVerificationCode();
        user.setVerificationCode(resetCode);
        userRepository.save(user);
        emailService.sendPasswordResetEmail(user.getEmail(), resetCode);
    }

    public void resetPassword(String email, String code, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        if (!code.equals(user.getVerificationCode())) {
            throw new IllegalArgumentException("Código de recuperación inválido");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setVerificationCode(null);
        userRepository.save(user);
    }

    public AuthResponse refreshToken(String refreshToken) {
        String email = jwtService.extractEmail(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        return buildAuthResponse(user);
    }

    public UserResponse getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        return mapToUserResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = jwtService.generateToken(user.getId(), user.getEmail());
        String refreshToken = jwtService.generateRefreshToken(user.getId(), user.getEmail());
        return new AuthResponse(token, refreshToken, mapToUserResponse(user));
    }

    private UserResponse mapToUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhone(),
                user.getBirthDate(),
                user.getGender(),
                user.getHeight(),
                user.getWeight(),
                user.isEmailVerified()
        );
    }

    private String generateVerificationCode() {
        Random random = new SecureRandom();
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < VERIFICATION_CODE_LENGTH; i++) {
            code.append(random.nextInt(10));
        }
        return code.toString();
    }
}
