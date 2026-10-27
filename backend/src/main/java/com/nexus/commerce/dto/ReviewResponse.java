package com.nexus.commerce.dto;

import java.time.ZonedDateTime;

// DTO para la respuesta de una reseña individual
public record ReviewResponse(
        Long id,
        Long productId,
        String userEmail,
        Integer rating,
        String title,
        String comment,
        ZonedDateTime createdAt
) {}
