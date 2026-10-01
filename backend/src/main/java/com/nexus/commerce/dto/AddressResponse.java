package com.nexus.commerce.dto;

public record AddressResponse(
        Long id,
        String fullName,
        String street,
        String city,
        String postalCode,
        String countryCode,
        boolean defaultAddress
) {}
