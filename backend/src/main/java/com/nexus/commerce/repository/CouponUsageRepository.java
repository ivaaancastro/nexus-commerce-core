package com.nexus.commerce.repository;

import com.nexus.commerce.entity.CouponUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CouponUsageRepository extends JpaRepository<CouponUsage, Long> {

    @Query("SELECT u FROM CouponUsage u WHERE u.coupon.id = :couponId ORDER BY u.usedAt DESC")
    List<CouponUsage> findByCouponIdOrderByUsedAtDesc(@Param("couponId") Long couponId);

    @Query("SELECT SUM(u.discountAmount) FROM CouponUsage u WHERE u.coupon.id = :couponId")
    BigDecimal getTotalDiscountByCoupon(@Param("couponId") Long couponId);
}