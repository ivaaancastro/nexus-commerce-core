package com.nexus.commerce.repository;

import com.nexus.commerce.entity.ProductReturn;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
