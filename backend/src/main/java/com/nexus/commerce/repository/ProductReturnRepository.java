package com.nexus.commerce.repository;

import com.nexus.commerce.entity.ProductReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ProductReturnRepository extends JpaRepository<ProductReturn, Long> {

    /**
     * R3: cada línea admite como mucho una devolución, sea cual sea su estado.
     * Es la comprobación de aplicación; el {@code UNIQUE (order_item_id)} de la
     * migración V9 es la última línea de defensa.
     */
    boolean existsByOrderItemId(Long orderItemId);

    /**
     * Devoluciones de un pedido. La pertenencia al usuario ya se ha comprobado
     * antes al resolver el pedido con {@code findByUserIdAndOrderNumber} (R10).
     */
    List<ProductReturn> findByOrderItemOrderId(Long orderId);

    /**
     * Identificadores de línea que ya tienen devolución, de golpe, para pintar el
     * badge «Devolución solicitada» en el historial (Tarea 5.5, R10).
     *
     * <p>Se hace <strong>una consulta por página</strong> en lugar de llamar a
     * {@link #existsByOrderItemId(Long)} por línea: con 20 pedidos de 2 artículos
     * eso serían 40 queries donde con una basta. El campo proyectado es el
     * identificador, no la entidad, así que no se materializa ningún objeto.</p>
     */
    @Query("SELECT r.orderItem.id FROM ProductReturn r WHERE r.orderItem.id IN :itemIds")
    List<Long> findOrderItemIdIn(@Param("itemIds") Collection<Long> itemIds);
}
