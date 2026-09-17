package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "warehouses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Warehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "country_code", nullable = false, length = 5)
    private String countryCode;

    @Column(name = "warehouse_type", nullable = false, length = 20)
    private String warehouseType;
}