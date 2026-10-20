package com.nexus.commerce.service;

import com.nexus.commerce.dto.AdminDashboardResponse;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tarea 7.6 (spec specs/admin-dashboard/, R8.1) — números exactos de los
 * agregados del dashboard <strong>con mocks</strong>: aquí se prueban sumas,
 * exclusiones y redondeos porque contra la BD compartida los globales cambian
 * con cada corrida (plan D8 — lección 4.2/D5).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Tarea 7.6 - Agregados del dashboard (servicio con mocks)")
class AdminDashboardServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private ProductRepository productRepository;
    @Mock private SkuRepository skuRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private AdminDashboardService service;

    // ── R2: ventas ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("R2 - byStatus trae las 5 claves aunque la query sólo devuelva 3 filas")
    void byStatusSiempreCincoClaves() {
        when(orderRepository.contarPedidosPorEstadoDesde(any(Instant.class))).thenReturn(List.of(
                fila(OrderStatus.CONFIRMED, 5),
                fila(OrderStatus.DELIVERED, 4),
                fila(OrderStatus.CANCELLED, 2)));
        when(orderRepository.contarIngresosPorMonedaDesde(any(), any()))
                .thenReturn(List.of());

        AdminDashboardResponse.Sales sales = service.getDashboard(30).sales();

        assertThat(sales.byStatus())
                .containsOnlyKeys(OrderStatus.values())
                .containsEntry(OrderStatus.PENDING, 0L)
                .containsEntry(OrderStatus.SHIPPED, 0L)
                .containsEntry(OrderStatus.CONFIRMED, 5L);
    }

    @Test
    @DisplayName("R2 - orderCount es ventas: excluye CANCELLED (sum(byStatus) sí los cuenta)")
    void orderCountExcluyeCancelados() {
        when(orderRepository.contarPedidosPorEstadoDesde(any(Instant.class))).thenReturn(List.of(
                fila(OrderStatus.CONFIRMED, 5),
                fila(OrderStatus.SHIPPED, 3),
                fila(OrderStatus.DELIVERED, 4),
                fila(OrderStatus.CANCELLED, 2)));
        when(orderRepository.contarIngresosPorMonedaDesde(any(), any()))
                .thenReturn(List.of());

        AdminDashboardResponse.Sales sales = service.getDashboard(30).sales();

        long sumaTodos = sales.byStatus().values().stream().mapToLong(Long::longValue).sum();
        assertThat(sales.orderCount()).isEqualTo(12);          // 5+3+4, sin los 2 cancelados
        assertThat(sumaTodos).isEqualTo(14);                   // cancelados incluidos
        assertThat(sales.orderCount()).isLessThan(sumaTodos);
    }

    @Test
    @DisplayName("R2 - ingresos por moneda sin cruzar y avgTicket HALF_UP escala 2")
    void ingresosPorMonedaYTicketMedio() {
        when(orderRepository.contarPedidosPorEstadoDesde(any(Instant.class))).thenReturn(List.of());
        when(orderRepository.contarIngresosPorMonedaDesde(any(), any())).thenReturn(List.of(
                moneda("EUR", "100.00", 3),   // 33.333… → 33.33
                moneda("USD", "10.00", 6),    //  1.666… →  1.67
                moneda("GBP", "33.33", 2)));  // 16.665  →  16.67 (HALF_UP: HALF_EVEN daría 16.66)

        List<AdminDashboardResponse.Revenue> revenue = service.getDashboard(30).sales().revenue();

        assertThat(revenue).hasSize(3);
        assertThat(revenue.get(0).currency()).isEqualTo("EUR");
        assertThat(revenue.get(0).total()).isEqualTo(new BigDecimal("100.00"));
        assertThat(revenue.get(0).orderCount()).isEqualTo(3);
        assertThat(revenue.get(0).avgTicket()).isEqualTo(new BigDecimal("33.33"));
        assertThat(revenue.get(1).avgTicket()).isEqualTo(new BigDecimal("1.67"));
        assertThat(revenue.get(2).avgTicket())
                .as("HALF_UP escala 2: 16.665 sube a 16.67")
                .isEqualTo(new BigDecimal("16.67"));
    }

    @Test
    @DisplayName("R2 - sin pedidos en el periodo: revenue vacío, orderCount 0, sin división")
    void periodoVacioSinDivision() {
        when(orderRepository.contarPedidosPorEstadoDesde(any(Instant.class))).thenReturn(List.of());
        when(orderRepository.contarIngresosPorMonedaDesde(any(), any()))
                .thenReturn(List.of());

        AdminDashboardResponse.Sales sales = service.getDashboard(7).sales();

        assertThat(sales.revenue()).isEmpty();
        assertThat(sales.orderCount()).isZero();
        assertThat(sales.byStatus()).containsOnlyKeys(OrderStatus.values());
        assertThat(sales.byStatus().values()).containsOnly(0L);
    }

    // ── R1: periodo ────────────────────────────────────────────────────────

    @Test
    @DisplayName("R1 - range.days refleja el pedido y from = now − days (misma query a los bloques)")
    void rangeFromEsNowMenosDays() {
        when(orderRepository.contarPedidosPorEstadoDesde(any(Instant.class))).thenReturn(List.of());
        when(orderRepository.contarIngresosPorMonedaDesde(any(), any())).thenReturn(List.of());

        Instant antes = Instant.now();
        AdminDashboardResponse respuesta = service.getDashboard(7);
        Instant despues = Instant.now();

        assertThat(respuesta.range().days()).isEqualTo(7);
        ArgumentCaptor<Instant> desde = ArgumentCaptor.forClass(Instant.class);
        verify(orderRepository).contarPedidosPorEstadoDesde(desde.capture());
        Instant esperado = antes.minus(7, ChronoUnit.DAYS);
        assertThat(desde.getValue())
                .as("from ≈ now − 7 días (tolerancia de 5 s)")
                .isBetween(esperado.minusSeconds(5), despues.minus(7, ChronoUnit.DAYS).plusSeconds(5));
        assertThat(respuesta.range().from()).isEqualTo(desde.getValue());
    }

    @Test
    @DisplayName("R4 - days fuera de 1–365 → IllegalArgumentException (la validación es previa a todo)")
    void daysFueraDeRango() {
        for (int invalido : new int[]{0, -5, 366, 9999}) {
            assertThatThrownBy(() -> service.getDashboard(invalido))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("days");
        }
    }

    @Test
    @DisplayName("R4 - los extremos 1 y 365 son válidos")
    void diasLimitesValidos() {
        when(orderRepository.contarPedidosPorEstadoDesde(any(Instant.class))).thenReturn(List.of());
        when(orderRepository.contarIngresosPorMonedaDesde(any(), any())).thenReturn(List.of());

        assertThat(service.getDashboard(1).range().days()).isEqualTo(1);
        assertThat(service.getDashboard(365).range().days()).isEqualTo(365);
    }

    // ── R3: catálogo y usuarios ────────────────────────────────────────────

    @Test
    @DisplayName("R3 - productos/users fluyen con el criterio 7.5 (admins sin suspender, suspendidos de cualquier rol)")
    void bloquesCatalogoYUsuarios() {
        when(orderRepository.contarPedidosPorEstadoDesde(any(Instant.class))).thenReturn(List.of());
        when(orderRepository.contarIngresosPorMonedaDesde(any(), any())).thenReturn(List.of());
        when(productRepository.count()).thenReturn(4L);
        when(skuRepository.count()).thenReturn(12L);
        when(productRepository.contarFamilias()).thenReturn(3L);
        when(userRepository.count()).thenReturn(9L);
        when(userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN)).thenReturn(1L);
        when(userRepository.contarSuspendidos()).thenReturn(2L);
        when(userRepository.contarAltasDesde(any(Instant.class))).thenReturn(5L);

        AdminDashboardResponse respuesta = service.getDashboard(30);

        assertThat(respuesta.products().total()).isEqualTo(4);
        assertThat(respuesta.products().skus()).isEqualTo(12);
        assertThat(respuesta.products().families()).isEqualTo(3);
        assertThat(respuesta.users().total()).isEqualTo(9);
        assertThat(respuesta.users().admins()).isEqualTo(1);
        assertThat(respuesta.users().suspended()).isEqualTo(2);
        assertThat(respuesta.users().newInPeriod()).isEqualTo(5);
        verify(userRepository).countByRoleAndSuspendedAtIsNull(Role.ADMIN);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private Object[] fila(OrderStatus estado, long n) {
        return new Object[]{estado, n};
    }

    private Object[] moneda(String currency, String total, long n) {
        return new Object[]{currency, new BigDecimal(total), n};
    }
}
