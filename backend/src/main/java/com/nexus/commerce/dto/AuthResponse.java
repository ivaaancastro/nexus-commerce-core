package com.nexus.commerce.dto;

public record AuthResponse(
        String token,
        String refreshToken,
        UserResponse user
) {}
