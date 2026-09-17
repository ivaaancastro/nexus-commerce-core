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
}