package com.nexus.commerce.repository;

import com.nexus.commerce.entity.MarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MarketPriceRepository extends JpaRepository<MarketPrice, Long> {

    @Query("""
        SELECT mp FROM MarketPrice mp
        JOIN FETCH mp.market m
        WHERE mp.sku.id = :skuId
          AND m.code = :marketCode
          AND mp.isActive = true
    """)
    Optional<MarketPrice> findActivePriceBySkuAndMarket(
            @Param("skuId") Long skuId,
            @Param("marketCode") String marketCode
    );

    @Query("""
        SELECT mp FROM MarketPrice mp
        JOIN FETCH mp.market m
        WHERE mp.sku.product.id = :productId
          AND m.code = :marketCode
          AND mp.isActive = true
    """)
    List<MarketPrice> findActivePricesByProductAndMarket(
            @Param("productId") Long productId,
            @Param("marketCode") String marketCode
    );

    /**
     * Panel de precios (Tarea 7.3, R3.1): TODAS las filas del SKU con su
     * mercado — sin filtrar {@code isActive}, porque el panel también
     * gestiona las inactivas.
     */
    @Query("""
        SELECT mp FROM MarketPrice mp
        JOIN FETCH mp.market m
        WHERE mp.sku.id = :skuId
        ORDER BY m.code ASC
    """)
    List<MarketPrice> findBySkuIdWithMarket(@Param("skuId") Long skuId);

    /**
     * Fila concreta para el upsert (Tarea 7.3, R3.2): incluye las inactivas
     * — {@link #findActivePriceBySkuAndMarket} filtra por {@code isActive} y
     * reactivaría una fila desactivada en lugar de actualizarla.
     */
    @Query("""
        SELECT mp FROM MarketPrice mp
        JOIN FETCH mp.market m
        WHERE mp.sku.id = :skuId
          AND m.code = :marketCode
    """)
    Optional<MarketPrice> findBySkuIdAndMarketCode(
            @Param("skuId") Long skuId,
            @Param("marketCode") String marketCode
    );
}