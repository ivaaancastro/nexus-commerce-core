package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @EntityGraph(attributePaths = {"items", "items.sku"})
    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = {"items", "items.sku"})
    Optional<Order> findByOrderNumber(String orderNumber);

    /**
     * Detalle de un pedido comprobando la propiedad en la propia consulta.
     * Devolver vacío cubre a la vez «no existe» y «es de otro usuario» → 404.
     * Sin paginación, así que el EntityGraph no trunca la colección.
     */
    @EntityGraph(attributePaths = {"items", "items.sku"})
    Optional<Order> findByUserIdAndOrderNumber(Long userId, String orderNumber);

    /**
     * Historial paginado. <strong>Sin</strong> EntityGraph: hacer fetch de una
     * colección junto a una paginación truncaría los items en el corte de página.
     * Los items se cargan en lote por {@code @BatchSize} al mapear el DTO.
     */
    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
