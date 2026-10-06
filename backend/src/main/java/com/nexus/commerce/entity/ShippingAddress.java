package com.nexus.commerce.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Snapshot inmutable de la dirección de envío usada en un pedido (Tarea 5.5, R1).
 *
 * <p>Se copia de {@link Address} <b>al momento del hacer checkout</b> y no se
 * vuelve a leer de origen: si el usuario edita o borra su dirección después,
 * el pedido sigue mostrando la que se usó. Por eso viven aquí los valores en
 * lugar de una referencia a la fila original.</p>
 *
 * <p>Las columnas son <b>nullable</b> porque las órdenes anteriores a la
 * migración {@code V10} no tienen snapshot: en ese caso el objeto entero es
 * {@code null} y el frontend no pinta la sección.</p>
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShippingAddress {

    @Column(name = "shipping_full_name", length = 100)
    private String fullName;

    @Column(name = "shipping_street", length = 255)
    private String street;

    @Column(name = "shipping_city", length = 100)
    private String city;

    @Column(name = "shipping_postal_code", length = 20)
    private String postalCode;

    @Column(name = "shipping_country_code", length = 5)
    private String countryCode;
}
