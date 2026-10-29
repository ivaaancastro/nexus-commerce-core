package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.*;
import com.nexus.commerce.exception.*;
import com.nexus.commerce.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CouponService {

    private final CouponRepository couponRepository;
    private final CouponUsageRepository couponUsageRepository;
    private final UserRepository userRepository;

    /**
     * Resultado del canje atómico en checkout: el cupón bloqueado y el descuento
     * ya calculado y acotado. Va de servicio a servicio ({@code OrderService}),
     * nunca sale por HTTP, así que no es un DTO de la capa {@code dto}.
     *
     * <p>Precedente: {@link WishlistService.AddResult}.</p>
     */
    public record CouponDiscountResult(Coupon coupon, BigDecimal discount) {}

    // ========== ADMIN CRUD ==========

    @Transactional(readOnly = true)
    public AdminCouponPageResponse getAdminCoupons(int page, int size, String code, Coupon.DiscountType type, Boolean active, OffsetDateTime validFrom, OffsetDateTime validUntil) {
        Pageable pageable = PageRequest.of(page, size);
        Specification<Coupon> spec = Specification.where(null);

        if (code != null && !code.isBlank()) {
            spec = spec.and((root, query, cb) -> cb.like(cb.upper(root.get("code")), "%" + code.toUpperCase() + "%"));
        }
        if (type != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("type"), type));
        }
        if (active != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("active"), active));
        }
        if (validFrom != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("validFrom"), validFrom));
        }
        if (validUntil != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("validUntil"), validUntil));
        }

        Page<Coupon> couponPage = couponRepository.findAll(spec, pageable);

        List<CouponSummaryResponse> summaries = couponPage.getContent().stream()
                .map(this::mapToSummary)
                .toList();

        return new AdminCouponPageResponse(
                summaries,
                couponPage.getNumber(),
                couponPage.getSize(),
                couponPage.getTotalElements(),
                couponPage.getTotalPages()
        );
    }

    @Transactional
    public AdminCouponDetailResponse createCoupon(CouponCreateRequest req) {
        if (couponRepository.existsByCode(req.code())) {
            throw new CouponCodeExistsException("Este código ya existe");
        }

        Coupon coupon = Coupon.builder()
                .code(req.code())
                .type(req.type())
                .value(req.value())
                .minOrderAmount(req.minOrderAmount() != null ? req.minOrderAmount() : BigDecimal.ZERO)
                .maxDiscountAmount(req.maxDiscountAmount())
                .validFrom(req.validFrom())
                .validUntil(req.validUntil())
                // Integer (DTO, opcional) → int (entidad): sin la guarda, un
                // create sin límites revienta con NPE al desempaquetar null.
                .usageLimit(req.usageLimit() != null ? req.usageLimit() : 0)
                .perUserLimit(req.perUserLimit() != null ? req.perUserLimit() : 0)
                .usageCount(0)
                .active(true)
                .build();

        coupon = couponRepository.save(coupon);
        return mapToDetail(coupon, List.of());
    }

    @Transactional(readOnly = true)
    public AdminCouponDetailResponse getAdminCoupon(Long id) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new CouponNotFoundException("Cupón no encontrado: " + id));

        List<CouponUsageSummary> usages = couponUsageRepository.findByCouponIdOrderByUsedAtDesc(coupon.getId())
                .stream()
                .limit(50)
                .map(this::mapToUsageSummary)
                .toList();

        return mapToDetail(coupon, usages);
    }

    @Transactional
    public AdminCouponDetailResponse updateCoupon(Long id, CouponUpdateRequest req) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new CouponNotFoundException("Cupón no encontrado: " + id));

        if (req.type() != null) coupon.setType(req.type());
        if (req.value() != null) coupon.setValue(req.value());
        if (req.minOrderAmount() != null) coupon.setMinOrderAmount(req.minOrderAmount());
        if (req.maxDiscountAmount() != null) coupon.setMaxDiscountAmount(req.maxDiscountAmount());
        if (req.validFrom() != null) coupon.setValidFrom(req.validFrom());
        if (req.validUntil() != null) coupon.setValidUntil(req.validUntil());
        if (req.usageLimit() != null) coupon.setUsageLimit(req.usageLimit());
        if (req.perUserLimit() != null) coupon.setPerUserLimit(req.perUserLimit());
        if (req.active() != null) coupon.setActive(req.active());

        coupon = couponRepository.save(coupon);

        List<CouponUsageSummary> usages = couponUsageRepository.findByCouponIdOrderByUsedAtDesc(coupon.getId())
                .stream()
                .limit(50)
                .map(this::mapToUsageSummary)
                .toList();

        return mapToDetail(coupon, usages);
    }

    @Transactional
    public void deleteCoupon(Long id) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new CouponNotFoundException("Cupón no encontrado: " + id));

        if (coupon.getUsageCount() > 0) {
            throw new CouponHasUsagesException("No se puede borrar un cupón que ya se ha usado; desactívalo");
        }

        couponRepository.delete(coupon);
    }

    // ========== VALIDACIÓN CLIENTE ==========

    @Transactional(readOnly = true)
    public CouponValidationResponse validateCoupon(CouponValidateRequest req, String email) {
        Optional<Coupon> optCoupon = couponRepository.findByCode(req.code().toUpperCase());

        if (optCoupon.isEmpty()) {
            return invalid("Cupón no válido", req.subtotal());
        }

        Coupon coupon = optCoupon.get();

        // 1. Activo
        if (!coupon.isActive()) {
            return invalid("Este cupón no está disponible", req.subtotal());
        }

        OffsetDateTime now = OffsetDateTime.now();

        // 2. Fechas
        if (now.isBefore(coupon.getValidFrom())) {
            return invalid("El cupón aún no es válido", req.subtotal());
        }
        if (now.isAfter(coupon.getValidUntil())) {
            return invalid("El cupón ha expirado", req.subtotal());
        }

        // 3. Límite global
        if (coupon.getUsageLimit() > 0 && coupon.getUsageCount() >= coupon.getUsageLimit()) {
            return invalid("Se ha alcanzado el límite de usos de este cupón", req.subtotal());
        }

        // 4. Límite por usuario (la identidad en sesión es el email: se resuelve
        //    aquí con userRepository, patrón de OrderService.requireUser).
        if (coupon.getPerUserLimit() > 0) {
            Long userId = userRepository.findByEmail(email).map(User::getId).orElse(null);
            // Usuario sin fila (token válido de una cuenta ya borrada): no puede
            // tener usos, así que el límite no lo bloquea.
            if (userId != null) {
                Long userUsages = couponRepository.countUsagesByUser(coupon.getId(), userId);
                if (userUsages >= coupon.getPerUserLimit()) {
                    return invalid("Ya has usado este cupón el máximo de veces permitido", req.subtotal());
                }
            }
        }

        // 5. Importe mínimo
        if (req.subtotal().compareTo(coupon.getMinOrderAmount()) < 0) {
            return invalid("El pedido no alcanza el importe mínimo para este cupón", req.subtotal());
        }

        // Válido: calcular descuento
        BigDecimal discount = calculateDiscount(coupon, req.subtotal());

        return new CouponValidationResponse(
                true,
                "Cupón aplicado",
                discount,
                mapToSummary(coupon)
        );
    }

    // ========== CANJE ATÓMICO (CHECKOUT) ==========

    /** Valida y calcula el descuento del cupón, incrementa el contador de usos.
     * La inserción en coupon_usages se hace después con {@link #recordCouponUsage}.
     * Debe llamarse dentro de la misma transacción que la creación de la orden.
     *
     * @param code       código del cupón
     * @param subtotal   subtotal del pedido (para recalcular y validar)
     * @param userId     usuario que canjea
     * @return par [cupón, descuento aplicado]
     */
    @Transactional
    public CouponDiscountResult redeemCoupon(String code, BigDecimal subtotal, Long userId) {
        // Bloqueo pesimista sobre el cupón para evitar over-redemption
        Coupon coupon = couponRepository.findByCodeForUpdate(code.toUpperCase())
                .orElseThrow(() -> new CouponNotFoundException("Cupón no encontrado: " + code));

        OffsetDateTime now = OffsetDateTime.now();

        // Re-validar todo bajo lock
        if (!coupon.isActive()) {
            throw new CouponInactiveException("Este cupón no está disponible");
        }
        if (now.isBefore(coupon.getValidFrom())) {
            throw new CouponNotYetValidException("El cupón aún no es válido");
        }
        if (now.isAfter(coupon.getValidUntil())) {
            throw new CouponExpiredException("El cupón ha expirado");
        }
        if (coupon.getUsageLimit() > 0 && coupon.getUsageCount() >= coupon.getUsageLimit()) {
            throw new CouponUsageLimitExceededException("Se ha alcanzado el límite de usos de este cupón");
        }
        if (coupon.getPerUserLimit() > 0) {
            Long userUsages = couponRepository.countUsagesByUser(coupon.getId(), userId);
            if (userUsages >= coupon.getPerUserLimit()) {
                throw new CouponPerUserLimitExceededException("Ya has usado este cupón el máximo de veces permitido");
            }
        }
        if (subtotal.compareTo(coupon.getMinOrderAmount()) < 0) {
            throw new CouponMinOrderNotMetException("El pedido no alcanza el importe mínimo para este cupón");
        }

        // Calcular descuento
        BigDecimal discount = calculateDiscount(coupon, subtotal);

        // Incrementar contador
        coupon.setUsageCount(coupon.getUsageCount() + 1);
        couponRepository.save(coupon);

        log.info("Coupon {} validated for user {} (discount: {})", code, userId, discount);

        return new CouponDiscountResult(coupon, discount);
    }

    /** Registra el uso del cupón vinculado a la orden ya persistida.
     * Debe llamarse en la misma transacción tras guardar la orden.
     */
    @Transactional
    public void recordCouponUsage(String couponCode, Long userId, Order order, BigDecimal discountAmount) {
        Coupon coupon = couponRepository.findByCode(couponCode.toUpperCase())
                .orElseThrow(() -> new CouponNotFoundException("Cupón no encontrado: " + couponCode));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CouponNotFoundException("Usuario no encontrado: " + userId));

        CouponUsage usage = CouponUsage.builder()
                .coupon(coupon)
                .user(user)
                .order(order)
                .discountAmount(discountAmount)
                .usedAt(OffsetDateTime.now())
                .build();
        couponUsageRepository.save(usage);

        log.info("Coupon usage recorded: coupon={}, user={}, order={}, discount={}", coupon.getCode(), userId, order.getOrderNumber(), discountAmount);
    }

    /** Vincula el uso del cupón a la orden ya persistida.
     * Debe llamarse en la misma transacción tras guardar la orden.
     */
    @Transactional
    public void linkUsageToOrder(String couponCode, Order order) {
        Coupon coupon = couponRepository.findByCode(couponCode.toUpperCase())
                .orElseThrow(() -> new CouponNotFoundException("Cupón no encontrado: " + couponCode));

        recordCouponUsage(couponCode, order.getUser().getId(), order, order.getDiscountAmount());
    }

    // ========== HELPERS ==========

    private BigDecimal calculateDiscount(Coupon coupon, BigDecimal subtotal) {
        BigDecimal discount;
        if (coupon.getType() == Coupon.DiscountType.PERCENTAGE) {
            // subtotal * value / 100
            discount = subtotal.multiply(coupon.getValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        } else {
            // FIXED: min(value, subtotal)
            discount = coupon.getValue().min(subtotal);
        }

        // Cap a maxDiscountAmount si existe
        if (coupon.getMaxDiscountAmount() != null) {
            discount = discount.min(coupon.getMaxDiscountAmount());
        }

        // Nunca más que el subtotal
        return discount.min(subtotal);
    }

    private CouponSummaryResponse mapToSummary(Coupon c) {
        return new CouponSummaryResponse(
                c.getId(), c.getCode(), c.getType(), c.getValue(),
                c.getMinOrderAmount(), c.getMaxDiscountAmount(),
                c.getValidFrom(), c.getValidUntil(),
                c.getUsageLimit(), c.getUsageCount(), c.getPerUserLimit(),
                c.isActive(), c.getCreatedAt()
        );
    }

    private CouponUsageSummary mapToUsageSummary(CouponUsage u) {
        return new CouponUsageSummary(
                u.getId(),
                u.getUser().getEmail(),
                u.getOrder().getOrderNumber(),
                u.getDiscountAmount(),
                u.getUsedAt()
        );
    }

    private AdminCouponDetailResponse mapToDetail(Coupon c, List<CouponUsageSummary> usages) {
        return new AdminCouponDetailResponse(
                c.getId(), c.getCode(), c.getType(), c.getValue(),
                c.getMinOrderAmount(), c.getMaxDiscountAmount(),
                c.getValidFrom(), c.getValidUntil(),
                c.getUsageLimit(), c.getUsageCount(), c.getPerUserLimit(),
                c.isActive(), c.getCreatedAt(), c.getUpdatedAt(),
                usages
        );
    }

    private CouponValidationResponse invalid(String message, BigDecimal subtotal) {
        return new CouponValidationResponse(
                false,
                message,
                BigDecimal.ZERO,
                null
        );
    }
}