package com.nexus.commerce.dto;

import java.util.List;

public record ProductEnrichmentResponse(
        String normalizedCategory,
        String targetOccasion,
        String targetSeason,
        String styleSummary,
        List<String> searchTags
) {}