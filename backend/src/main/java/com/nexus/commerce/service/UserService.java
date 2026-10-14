package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProfileUpdateRequest;
import com.nexus.commerce.dto.UserResponse;
import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Lectura y actualización del perfil del usuario autenticado.
 * El email nunca se modifica desde este servicio: es el identificador de la cuenta.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private static final LocalDate MIN_BIRTH_DATE = LocalDate.of(1900, 1, 1);

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public UserResponse getProfile(String email) {
        return toResponse(findUser(email));
    }

    @Transactional
    public UserResponse updateProfile(String email, ProfileUpdateRequest request) {
        User user = findUser(email);

        if (request.firstName() != null && !request.firstName().isBlank()) {
            user.setFirstName(request.firstName().trim());
        }
        if (request.lastName() != null && !request.lastName().isBlank()) {
            user.setLastName(request.lastName().trim());
        }
        if (request.phone() != null) {
            user.setPhone(request.phone().isBlank() ? null : request.phone().trim());
        }
        if (request.birthDate() != null) {
            validateBirthDate(request.birthDate());
            user.setBirthDate(request.birthDate());
        }
        if (request.gender() != null) {
            user.setGender(request.gender());
        }
        if (request.height() != null) {
            validateHeight(request.height());
            user.setHeight(request.height());
        }
        if (request.weight() != null) {
            validateWeight(request.weight());
            user.setWeight(request.weight());
        }

        User saved = userRepository.save(user);
        log.info("Perfil actualizado para usuario id={}", saved.getId());
        return toResponse(saved);
    }

    /**
     * Carga el usuario autenticado a partir de su email.
     */
    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
    }

    private void validateBirthDate(LocalDate birthDate) {
        if (birthDate.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha de nacimiento no puede ser futura");
        }
        if (birthDate.isBefore(MIN_BIRTH_DATE)) {
            throw new IllegalArgumentException("La fecha de nacimiento no puede ser anterior a 1900");
        }
    }

    private void validateHeight(double height) {
        if (height < 100 || height > 250) {
            throw new IllegalArgumentException("La altura debe estar entre 100 y 250 cm");
        }
    }

    private void validateWeight(double weight) {
        if (weight < 30 || weight > 250) {
            throw new IllegalArgumentException("El peso debe estar entre 30 y 250 kg");
        }
    }

    private UserResponse toResponse(User user) {
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
                user.isEmailVerified(),
                user.getRole()
        );
    }
}
