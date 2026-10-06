package com.nexus.commerce.dto;

/**
 * Snapshot de la dirección de envío usada en el pedido (Tarea 5.5, R1).
 *
 * @param fullName    nombre del destinatario
 * @param street      calle y número
 * @param city        ciudad
 * @param postalCode  código postal
 * @param countryCode país (ISO-3166 alpha-2)
 */
public record ShippingAddressResponse(
        String fullName,
        String street,
        String city,
        String postalCode,
        String countryCode
) {}
