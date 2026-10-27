package com.nexus.commerce.repository;

import com.nexus.commerce.entity.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repositorio de ítems de favoritos (spec V3 wishlist).
 *
 * <p>Existe para que {@code WishlistService} persista el ítem <strong>directamente</strong>:
 * guardarlo en cascada desde una wishlist ya persistida hace un {@code merge} que,
 * con un ítem nuevo, crea una <strong>copia</strong> y la instancia original se
 * queda con el id a {@code null} (medido en {@code WishlistTransaccionalTest}).
 * El {@code save} directo de una entidad nueva va a {@code persist} y con
 * {@code IDENTITY} el id queda en la misma instancia para el {@code 201}.</p>
 */
@Repository
public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {
}
