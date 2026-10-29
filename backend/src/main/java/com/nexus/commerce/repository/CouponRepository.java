package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Coupon;
import com.nexus.commerce.entity.CouponUsage;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

// JpaSpecificationExecutor: el listado admin filtra con Specification
// (findAll(spec, pageable)) — sin él, ese findAll no existe.
public interface CouponRepository extends JpaRepository<Coupon, Long>, JpaSpecificationExecutor<Coupon> {

    Optional<Coupon> findByCode(String code);

    boolean existsByCode(String code);

    @Query("SELECT c FROM Coupon c WHERE c.code = :code")
    Optional<Coupon> findByCodeNative(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Coupon c WHERE c.code = :code")
    Optional<Coupon> findByCodeForUpdate(@Param("code") String code);

    @Query("SELECT c FROM Coupon c WHERE c.active = true AND c.validFrom <= :now AND c.validUntil >= :now")
    List<Coupon> findActiveCoupons(@Param("now") OffsetDateTime now);

    @Query("SELECT COUNT(u) FROM CouponUsage u WHERE u.coupon.id = :couponId AND u.user.id = :userId")
    Long countUsagesByUser(@Param("couponId") Long couponId, @Param("userId") Long userId);
}