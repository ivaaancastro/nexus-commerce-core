package com.nexus.commerce.repository;

import com.nexus.commerce.entity.StockItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StockItemRepository extends JpaRepository<StockItem, Long> {

    @Query("""
        SELECT si FROM StockItem si
        JOIN FETCH si.warehouse w
        WHERE si.sku.id = :skuId
    """)
    List<StockItem> findBySkuIdWithWarehouse(@Param("skuId") Long skuId);

    // Bloqueo pesimista para evitar condiciones de carrera en reservas concurrentes
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT si FROM StockItem si
        WHERE si.sku.id = :skuId AND si.warehouse.code = :warehouseCode
    """)
    Optional<StockItem> findBySkuIdAndWarehouseCodeForUpdate(
            @Param("skuId") Long skuId,
            @Param("warehouseCode") String warehouseCode
    );

    @Query("""
        SELECT COALESCE(SUM(si.quantityAvailable - si.quantityReserved), 0)
        FROM StockItem si
        WHERE si.sku.id = :skuId
    """)
    Integer calculateTotalAvailableStock(@Param("skuId") Long skuId);
}