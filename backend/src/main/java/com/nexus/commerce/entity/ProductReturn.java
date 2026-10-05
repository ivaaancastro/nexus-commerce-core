package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Devolución de una línea de pedido (spec Tarea 5.4).
 *
 * <p>Es un <b>registro contable</b>: guarda el importe que se devolvería, pero no
 * mueve dinero — el proyecto no tiene pasarela de pago.</p>
 *
 * <p>La restricción {@code uq_return_per_item} sobre {@code order_item_id} vive en la
 * migración {@code V9__product_returns.sql} y es la última línea de defensa de R3
 * (una devolución por línea).</p>
 */
@Entity
@Table(name = "product_returns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductReturn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItem orderItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ReturnStatus status;

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundAmount;

    @CreationTimestamp
    @Column(name = "requested_at", nullable = false, updatable = false)
    private Instant requestedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;
}
