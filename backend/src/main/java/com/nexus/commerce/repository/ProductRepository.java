package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Product;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    // Resuelve el problema N+1 cargando las variantes (skus) en una sola consulta JOIN
    @EntityGraph(attributePaths = {"skus"})
    Optional<Product> findByReferenceCode(String referenceCode);

    @EntityGraph(attributePaths = {"skus"})
    List<Product> findAll();
}