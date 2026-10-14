package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Sku;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SkuRepository extends JpaRepository<Sku, Long> {

    /**
     * Unicidad del código de barras (Tarea 7.2, R2.3): comprobación previa al
     * INSERT para el 409 claro; la carrera la cubre la restricción {@code UNIQUE}.
     */
    boolean existsByBarcode(String barcode);

    /**
     * Guarda de borrado de SKU (Tarea 7.2, R3): un SKU con pedidos no se puede
     * borrar — {@code order_items.sku_id} es {@code NO ACTION} y fallar en el
     * DELETE sería un 500. Mismo contrato que
     * {@code ProductRepository#tienePedidos}.
     */
    @Query("SELECT CASE WHEN COUNT(oi) > 0 THEN true ELSE false END "
            + "FROM OrderItem oi WHERE oi.sku.id = :skuId")
    boolean tienePedidos(@Param("skuId") Long skuId);
}
