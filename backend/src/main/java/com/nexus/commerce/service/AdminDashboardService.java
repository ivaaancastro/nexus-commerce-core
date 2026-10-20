package com.nexus.commerce.service;

import com.nexus.commerce.dto.AdminDashboardResponse;
import com.nexus.commerce.dto.AdminDashboardResponse.Products;
import com.nexus.commerce.dto.AdminDashboardResponse.Range;
import com.nexus.commerce.dto.AdminDashboardResponse.Revenue;
import com.nexus.commerce.dto.AdminDashboardResponse.Sales;
import com.nexus.commerce.dto.AdminDashboardResponse.Users;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Dashboard del panel (Tarea 7.6): agrega ventas del periodo, catálogo y
 * usuarios en una sola respuesta de sólo lectura (plan D1/D2).
 *
 * <p>Todas las queries son {@code COUNT}/{@code SUM}/{@code GROUP BY} sobre
 * escalares: la respuesta no contiene entidades, así que no hay N+1 ni lazy
 * surprises que abrir. Sin escrituras ⇒ sin locks y sin interferencia con el
 * checkout (a diferencia de la 7.4, aquí no hay concurrencia que coordinar).</p>
 *
 * <p>Las reglas que el servicio garantiza (plan D3/D4): ingresos siempre
 * <strong>agrupados por moneda</strong> y <strong>sin cancelados</strong>,
 * ticket medio {@code HALF_UP} escala 2, {@code byStatus} con las 5 claves
 * siempre presentes y {@code days} validado en {@code 1–365} — fuera de rango,
 * {@code IllegalArgumentException} que el handler existente traduce a
 * {@code 400} con {@code message} (sin handlers nuevos).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    /** Límites del periodo (R4): la API acepta 1–365 días; la UI ofrece 7/30/90. */
    static final int MIN_DAYS = 1;
    static final int MAX_DAYS = 365;

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final SkuRepository skuRepository;
    private final UserRepository userRepository;

    /**
     * Foto del negocio para la portada del panel.
     *
     * @param days periodo en días ({@code 1–365}); el default lo resuelve el
     *             controller antes de llegar aquí
     * @return bloques {@code range/sales/products/users} con ceros válidos
     *         cuando no hay datos — nunca {@code null}
     * @throws IllegalArgumentException si {@code days} está fuera de rango
     */
    @Transactional(readOnly = true)
    public AdminDashboardResponse getDashboard(int days) {
        if (days < MIN_DAYS || days > MAX_DAYS) {
            throw new IllegalArgumentException(
                    "days debe estar entre " + MIN_DAYS + " y " + MAX_DAYS + " días");
        }
        Instant from = Instant.now().minus(days, ChronoUnit.DAYS);
        log.debug("Dashboard: period de {} días desde {}", days, from);

        // — Ventas: por estado (5 claves siempre) y por moneda (sin cancelados) —
        Map<OrderStatus, Long> byStatus = new EnumMap<>(OrderStatus.class);
        for (OrderStatus status : OrderStatus.values()) {
            byStatus.put(status, 0L);
        }
        for (Object[] row : orderRepository.contarPedidosPorEstadoDesde(from)) {
            byStatus.put((OrderStatus) row[0], (Long) row[1]);
        }
        // orderCount = ventas (no canceladas); sum(byStatus) incluye cancelados
        long orderCount = byStatus.entrySet().stream()
                .filter(e -> e.getKey() != OrderStatus.CANCELLED)
                .mapToLong(Map.Entry::getValue)
                .sum();

        List<Revenue> revenue = new ArrayList<>();
        for (Object[] row : orderRepository.contarIngresosPorMonedaDesde(from, OrderStatus.CANCELLED)) {
            String currency = (String) row[0];
            BigDecimal total = (BigDecimal) row[1];
            long count = (Long) row[2];
            BigDecimal avgTicket = total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
            revenue.add(new Revenue(currency, total, count, avgTicket));
        }

        Products products = new Products(
                productRepository.count(),
                skuRepository.count(),
                productRepository.contarFamilias());
        Users users = new Users(
                userRepository.count(),
                userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN),
                userRepository.contarSuspendidos(),
                userRepository.contarAltasDesde(from));

        return new AdminDashboardResponse(
                new Range(days, from),
                new Sales(orderCount, byStatus, revenue),
                products,
                users);
    }
}
