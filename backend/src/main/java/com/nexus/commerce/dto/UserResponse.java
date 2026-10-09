package com.nexus.commerce.dto;

import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.Role;

import java.time.LocalDate;

public record UserResponse(
        Long id,
        String email,
        String firstName,
        String lastName,
        String phone,
        LocalDate birthDate,
        Gender gender,
        Double height,
        Double weight,
        boolean emailVerified,
        Role role
) {}
