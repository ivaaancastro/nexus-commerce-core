package com.nexus.commerce.repository;

import com.nexus.commerce.entity.CouponUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;

public interface CouponUsageRepository extends JpaRepository<CouponUsage, Long> {

    /**
     * Fase 9 (D17): borra el uso ligado a un pedido y devuelve cuántas filas
     * eliminó — {@code 0} hace la devolución del cupón idempotente (no se
     * decrementa dos veces).
     */
    @Modifying
    @Query("DELETE FROM CouponUsage u WHERE u.order.id = :orderId")
    int deleteByOrderId(@Param("orderId") Long orderId);

    @Query("SELECT u FROM CouponUsage u WHERE u.coupon.id = :couponId ORDER BY u.usedAt DESC")
    List<CouponUsage> findByCouponIdOrderByUsedAtDesc(@Param("couponId") Long couponId);

    @Query("SELECT SUM(u.discountAmount) FROM CouponUsage u WHERE u.coupon.id = :couponId")
    BigDecimal getTotalDiscountByCoupon(@Param("couponId") Long couponId);
}