package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Wishlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface WishlistRepository extends JpaRepository<Wishlist, Long> {

    /**
     * La lista de un usuario con items y producto ya cargados: un único
     * {@code SELECT} con {@code JOIN FETCH} — sin N+1 en el mapeo de la
     * respuesta (convención §5.1). {@code LEFT}: un usuario sin lista o sin
     * artículos no debe perderse por el join.
     */
    @Query("""
            SELECT w FROM Wishlist w
            LEFT JOIN FETCH w.items i
            LEFT JOIN FETCH i.product
            WHERE w.user.id = :userId
            """)
    Optional<Wishlist> findByUserIdWithItems(@Param("userId") Long userId);
}
