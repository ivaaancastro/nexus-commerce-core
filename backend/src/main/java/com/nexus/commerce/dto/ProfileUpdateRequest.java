package com.nexus.commerce.dto;

import com.nexus.commerce.entity.Gender;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PastOrPresent;

import java.time.LocalDate;

/**
 * Datos editables del perfil. El email queda fuera a propósito:
 * es el identificador de la cuenta y no debe modificarse desde aquí.
 */
public record ProfileUpdateRequest(
        String firstName,

        String lastName,

        String phone,

        @PastOrPresent(message = "La fecha de nacimiento no puede ser futura")
        LocalDate birthDate,

        Gender gender,

        @Min(value = 100, message = "La altura debe estar entre 100 y 250 cm")
        @Max(value = 250, message = "La altura debe estar entre 100 y 250 cm")
        Double height,

        @Min(value = 30, message = "El peso debe estar entre 30 y 250 kg")
        @Max(value = 250, message = "El peso debe estar entre 30 y 250 kg")
        Double weight
) {}
