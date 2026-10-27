package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Table(name = "product_reviews", uniqueConstraints = {
    @UniqueConstraint(name = "uk_product_user_review", columnNames = {"product_id", "user_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProductReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Integer rating;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(nullable = false)
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();
}
