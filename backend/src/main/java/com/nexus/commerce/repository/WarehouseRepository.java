package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {

    /**
     * Busca almacenes que tengan stock disponible para un SKU específico.
     */
    @Query("""
            SELECT DISTINCT w FROM Warehouse w
            JOIN StockItem si ON si.warehouse.id = w.id
            WHERE si.sku.id = :skuId
            AND si.quantityAvailable > si.quantityReserved
            ORDER BY w.code
            """)
    List<Warehouse> findWarehousesWithStockForSku(@Param("skuId") Long skuId);
}
