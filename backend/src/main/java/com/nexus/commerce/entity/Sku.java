package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.OffsetDateTime;

/**
 * El historial paginado no puede llevar {@code @EntityGraph} (truncaría los
 * items en el corte de página), así que cada {@code sku} se resolvía con una
 * query por línea al leer {@code skuCode} — un N+1 <strong>preexistente</strong>.
 *
 * <p>El {@code @BatchSize} va a nivel de <strong>clase</strong>, no en el campo:
 * Hibernate lo rechaza en {@code @ManyToOne} (<em>«Property 'sku' may not be
 * annotated '@BatchSize'»</em>). Aplicado aquí agrupa la carga de los proxies
 * <em>de esta clase</em>, o sea la referencia {@code OrderItem → Sku}
 * (Tarea 5.5, plan §5.9).</p>
 */
@Entity
@Table(name = "skus")
@BatchSize(size = 20)
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