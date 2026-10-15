package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {

    /**
     * Almacén por código natural (Tarea 7.3, R2.5): el PUT del panel recibe
     * {@code warehouseCode} en la ruta y devuelve 404 si no existe.
     */
    Optional<Warehouse> findByCode(String code);

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
