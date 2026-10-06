package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /**
     * El historial paginado no puede llevar {@code @EntityGraph} (truncaría los
     * items en el corte de página), así que esta referencia se resolvía con una
     * query por línea al leer {@code skuCode} — un N+1 <strong>preexistente</strong>.
     *
     * <p>El {@code @BatchSize} va a nivel de <strong>clase</strong>: Hibernate
     * lo rechaza en {@code @ManyToOne}. Aplicado sobre {@link Sku} agrupa la
     * carga de los proxies de SKU (plan §5.9).</p>
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sku_id", nullable = false)
    private Sku sku;

    @Column(name = "warehouse_code", nullable = false)
    private String warehouseCode;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal taxRate;

    @Column(name = "tax_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;
}