package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "markets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Market {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 5)
    private String code;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal taxRate;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}