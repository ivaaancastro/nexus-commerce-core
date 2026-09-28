package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Order;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @EntityGraph(attributePaths = {"items", "items.sku"})
    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = {"items", "items.sku"})
    Optional<Order> findByOrderNumber(String orderNumber);
}