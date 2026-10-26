package com.nexus.commerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * Un producto guardado en la lista de favoritos (spec V3 wishlist, plan D2).
 *
 * <p>Apunta al <strong>producto</strong>, nunca a un SKU: tallas, colores y
 * stock cambian, y la PDP resuelve la variante al añadir a la bolsa. La
 * unicidad {@code (wishlist_id, product_id)} vive en la BD (V18).</p>
 */
@Entity
@Table(name = "wishlist_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WishlistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wishlist_id", nullable = false)
    private Wishlist wishlist;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /**
     * Orden de la lista: lo más reciente primero (R3.1).
     *
     * <p>Lo pone el <strong>servicio en Java</strong>: la respuesta del
     * {@code POST} necesita el instante sin relectura (el patrón
     * {@code insertable = false} de la casa deja el campo a {@code null} en
     * la respuesta inmediata — en las órdenes se toleró, aquí no hace
     * falta). El {@code DEFAULT NOW()} de la V18 es la red de seguridad para
     * inserts directos a SQL.</p>
     */
    @Column(name = "added_at")
    private OffsetDateTime addedAt;
}
