package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "skus")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sku {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, unique = true, length = 20)
    private String barcode;

    @Column(nullable = false, length = 30)
    private String color;

    @Column(nullable = false, length = 10)
    private String size;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}