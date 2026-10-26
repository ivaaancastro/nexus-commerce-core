package com.nexus.commerce.service;

import com.nexus.commerce.dto.AdminOrderDetailResponse;
import com.nexus.commerce.dto.AdminOrderPageResponse;
import com.nexus.commerce.dto.AdminOrderStatusRequest;
import com.nexus.commerce.dto.AdminOrderTrackingRequest;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.ProductReturn;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.OrderStateConflictException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.exception.StockConflictException;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductReturnRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tarea 7.4 (spec specs/admin-orders/, R1–R5) — la lógica que la integración
 * no puede ejercitar de forma exhaustiva: la <strong>matriz completa</strong>
 * de la máquina de transiciones (25 pares) y el despacho de efectos de stock,
 * con el repositorio mockeado (los locks son comportamiento del contenedor,
 * aquí sólo importa qué se llama y en qué orden de decisión).
 *
 * <p>La tabla de transiciones del test se redacta <strong>desde la spec
 * (R3.1)</strong>, no desde el código: si mañana alguien cambia la máquina de
 * producción sin cambiar la spec, este test falla.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Tarea 7.4 - AdminOrderService: máquina de transiciones, efectos de stock y tracking")
class AdminOrderServiceTest {

    private static final String NUM = "ORD-TEST-1";

    /** Tabla esperada según spec R3.1 — escrita a mano, no copiada del código. */
    private static final Map<OrderStatus, Set<OrderStatus>> TABLA = Map.of(
            OrderStatus.PENDING, Set.of(OrderStatus.CONFIRMED, OrderStatus.CANCELLED),
            OrderStatus.CONFIRMED, Set.of(OrderStatus.SHIPPED, OrderStatus.CANCELLED),
            OrderStatus.SHIPPED, Set.of(OrderStatus.DELIVERED),
            OrderStatus.DELIVERED, Set.of(),
            OrderStatus.CANCELLED, Set.of()
    );

    @Mock private OrderRepository orderRepository;
    @Mock private ProductReturnRepository productReturnRepository;
    @Mock private InventoryService inventoryService;
    @Mock private OrderService orderService;
    @Mock private OrderEmailNotifier orderEmailNotifier;

    @InjectMocks private AdminOrderService service;

    // ── C.1: la máquina entera ─────────────────────────────────────────────

    @Test
    @DisplayName("C.1 - matriz 5×5: válidas cambian estado, mismo estado e inválidas -> 409 ORDER_CONFLICT")
    void matrizCompletaDeTransiciones() {
        when(orderService.mapToOrderResponse(any(Order.class))).thenReturn(respuesta());

        for (OrderStatus actual : OrderStatus.values()) {
            for (OrderStatus destino : OrderStatus.values()) {
                // GIVEN — un pedido fresco en cada par de la matriz
                clearInvocations(inventoryService);
                Order pedido = pedido(actual);
                when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(pedido));
                AdminOrderStatusRequest request = new AdminOrderStatusRequest(destino);

                if (actual == destino) {
                    // Guarda anti doble clic (R3.4): repetir el estado nunca es válido
                    assertThatThrownBy(() -> service.cambiarEstado(NUM, request))
                            .as("%s -> %s", actual, destino)
                            .isInstanceOf(OrderStateConflictException.class)
                            .hasMessageContaining("ya está en estado");
                    assertThat(pedido.getStatus()).isEqualTo(actual);
                    verifyNoInteractions(inventoryService);
                } else if (TABLA.get(actual).contains(destino)) {
                    // Transición válida (R3.1): estado nuevo + efecto de stock según destino
                    assertThatCode(() -> service.cambiarEstado(NUM, request))
                            .as("%s -> %s", actual, destino)
                            .doesNotThrowAnyException();
                    assertThat(pedido.getStatus()).isEqualTo(destino);
                    switch (destino) {
                        case CANCELLED -> verify(inventoryService)
                                .releaseReservedStock(1L, "WH_ARTEIXO", 2);
                        case SHIPPED -> verify(inventoryService)
                                .shipStock(1L, "WH_ARTEIXO", 2);
                        // CONFIRMED y DELIVERED no mueven stock (R4.5)
                        default -> verifyNoInteractions(inventoryService);
                    }
                } else {
                    // Fuera de la tabla (R3.3): 409 con el estado actual y los destinos válidos
                    assertThatThrownBy(() -> service.cambiarEstado(NUM, request))
                            .as("%s -> %s", actual, destino)
                            .isInstanceOf(OrderStateConflictException.class)
                            .hasMessageContaining("Transición no permitida");
                    assertThat(pedido.getStatus()).isEqualTo(actual);
                    verifyNoInteractions(inventoryService);
                }
            }
        }
    }

    @Test
    @DisplayName("C.1 - terminal DELIVERED y CANCELLED no admiten salir hacia ningún lado")
    void estadosTerminalesNoSeMueven() {
        for (OrderStatus terminal : List.of(OrderStatus.DELIVERED, OrderStatus.CANCELLED)) {
            Order pedido = pedido(terminal);
            when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(pedido));

            assertThatThrownBy(() -> service.cambiarEstado(
                    NUM, new AdminOrderStatusRequest(OrderStatus.CONFIRMED)))
                    .as("terminal %s", terminal)
                    .isInstanceOf(OrderStateConflictException.class)
                    .hasMessageContaining("es un estado final");
            assertThat(pedido.getStatus()).isEqualTo(terminal);
        }
    }

    @Test
    @DisplayName("C.1 - pedido inexistente -> ResourceNotFoundException (404)")
    void pedidoInexistente404() {
        when(orderRepository.findByOrderNumberForUpdate("ORD-NOEXISTE"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.cambiarEstado(
                "ORD-NOEXISTE", new AdminOrderStatusRequest(OrderStatus.CONFIRMED)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("ORD-NOEXISTE");
    }

    // ── C.2: efectos de stock ──────────────────────────────────────────────

    @Test
    @DisplayName("C.2 - la guarda de stock revierte ANTES de tocar el estado: 409 STOCK_CONFLICT y pedido intacto")
    void guardaDeStockNoCambiaElEstado() {
        // GIVEN — CONFIRMED->SHIPPED es válido, pero el inventario rechaza el envío
        Order pedido = pedido(OrderStatus.CONFIRMED);
        when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(pedido));
        doThrow(new StockConflictException("No se pueden enviar 2 unidades: sólo quedan 1"))
                .when(inventoryService).shipStock(1L, "WH_ARTEIXO", 2);

        // WHEN / THEN — el 409 sube y el estado sigue en CONFIRMED (rollback real
        // lo garantiza @Transactional; aquí se comprueba que setStatus jamás se alcanza)
        assertThatThrownBy(() -> service.cambiarEstado(NUM, new AdminOrderStatusRequest(OrderStatus.SHIPPED)))
                .isInstanceOf(StockConflictException.class);
        assertThat(pedido.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("C.2 - cancelar con fila de stock ausente completa el pedido igualmente (R4.2)")
    void cancelarConStockAusenteNoFalla() {
        // GIVEN — releaseReservedStock no lanza nada con fila ausente (sólo warn)
        Order pedido = pedido(OrderStatus.CONFIRMED);
        when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(pedido));

        // WHEN / THEN
        assertThatCode(() -> service.cambiarEstado(NUM, new AdminOrderStatusRequest(OrderStatus.CANCELLED)))
                .doesNotThrowAnyException();
        assertThat(pedido.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        verify(inventoryService).releaseReservedStock(1L, "WH_ARTEIXO", 2);
        verify(inventoryService, never()).shipStock(anyLong(), anyString(), anyInt());
    }

    // ── C.3: listado y detalle ─────────────────────────────────────────────

    @Test
    @DisplayName("C.3 - listado: filas mapeadas, q recortado, returnRequested por consulta única y totales de página")
    void listadoMapeaPagina() {
        // GIVEN — una página de 2 pedidos: uno con usuario y uno sin (V7 nullable)
        Order conUsuario = pedidoConId(10L, "ORD-TEST-1", OrderStatus.PENDING, 101L,
                User.builder().email("admin@nexus.dev").build());
        Order sinUsuario = pedidoConId(11L, "ORD-TEST-2", OrderStatus.SHIPPED, 102L, null);

        when(orderRepository.findAllForAdmin(eq(OrderStatus.PENDING), eq("ORD-Test"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(conUsuario, sinUsuario), PageRequest.of(0, 2), 5));
        // Una sola consulta para los flags de devolución de la página (patrón 5.5 R10)
        when(productReturnRepository.findOrderItemIdIn(List.of(101L, 102L)))
                .thenReturn(List.of(102L));

        // WHEN — el término viene con espacios: se recorta en el servidor
        AdminOrderPageResponse page = service.listar(0, 2, OrderStatus.PENDING, "  ORD-Test  ");

        // THEN
        assertThat(page.orders()).hasSize(2);
        assertThat(page.orders().get(0).userEmail()).isEqualTo("admin@nexus.dev");
        assertThat(page.orders().get(1).userEmail()).isNull();
        assertThat(page.orders().get(0).returnRequested()).isFalse();
        assertThat(page.orders().get(1).returnRequested()).isTrue();
        // PageImpl ajusta el total si offset+size > total; con size 2 y total 5
        // el fixture es coherente y los totales viajan intactos al DTO.
        assertThat(page.totalElements()).isEqualTo(5);
        assertThat(page.totalPages()).isEqualTo(3);
        assertThat(page.page()).isZero();
        assertThat(page.size()).isEqualTo(2);
        assertThat(page.orders().get(0).itemCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("C.3 - q en blanco y status ausente viajan como null (sin filtro), lista vacía sin consulta de devoluciones")
    void listadoSinFiltrosYPaginaVacia() {
        when(orderRepository.findAllForAdmin(isNull(), isNull(), any(PageRequest.class)))
                .thenReturn(org.springframework.data.domain.Page.empty());

        AdminOrderPageResponse page = service.listar(0, 20, null, "   ");

        assertThat(page.orders()).isEmpty();
        assertThat(page.totalElements()).isZero();
        verify(productReturnRepository, never()).findOrderItemIdIn(any());

        // El término realmente viaja limpio al repositorio
        ArgumentCaptor<String> termino = ArgumentCaptor.forClass(String.class);
        verify(orderRepository).findAllForAdmin(isNull(), termino.capture(), any(PageRequest.class));
        assertThat(termino.getValue()).isNull();
    }

    @Test
    @DisplayName("C.3 - detalle: compone OrderResponse + userEmail + returnRequested; 404 sin pedido")
    void detalleComponeY404() {
        // GIVEN
        Order pedido = pedidoConId(10L, "ORD-TEST-1", OrderStatus.CONFIRMED, 101L,
                User.builder().email("admin@nexus.dev").build());
        when(orderRepository.findByOrderNumber("ORD-TEST-1")).thenReturn(Optional.of(pedido));
        when(orderService.mapToOrderResponse(any(Order.class))).thenReturn(respuesta());
        when(productReturnRepository.findByOrderItemOrderId(10L))
                .thenReturn(List.of(mock(ProductReturn.class)));

        // WHEN
        AdminOrderDetailResponse detail = service.detalle("ORD-TEST-1");

        // THEN — el pedido compuesto es el MISMO shape que ve el cliente (R2.1)
        assertThat(detail.order().orderNumber()).isEqualTo("ORD-TEST-1");
        assertThat(detail.userEmail()).isEqualTo("admin@nexus.dev");
        assertThat(detail.returnRequested()).isTrue();

        // 404
        when(orderRepository.findByOrderNumber("ORD-NOEXISTE")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.detalle("ORD-NOEXISTE"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ── C.4: tracking ──────────────────────────────────────────────────────

    @Test
    @DisplayName("C.4 - full-replace: vacío/espacios -> null (limpia), sin tocar el estado, editable en cualquier estado")
    void trackingFullReplaceSinTocarEstado() {
        // GIVEN — un pedido ya terminado: el tracking sigue siendo editable (R5.2)
        Order pedido = pedido(OrderStatus.DELIVERED);
        when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(pedido));
        when(orderService.mapToOrderResponse(any(Order.class))).thenReturn(respuesta());

        // WHEN — carrier con espacios alrededor y trackingNumber vacío
        service.actualizarTracking(NUM, new AdminOrderTrackingRequest("  Correos  ", "   "));

        // THEN — recortado y vacío a null; el estado DELIVERED intacto (R4.6)
        assertThat(pedido.getCarrier()).isEqualTo("Correos");
        assertThat(pedido.getTrackingNumber()).isNull();
        assertThat(pedido.getStatus()).isEqualTo(OrderStatus.DELIVERED);
        verify(orderRepository).save(pedido);
    }

    @Test
    @DisplayName("C.4 - ausentes los dos campos -> ambos a null; 404 si el pedido no existe")
    void trackingLimpiaY404() {
        Order pedido = pedido(OrderStatus.SHIPPED);
        pedido.setCarrier("SEUR");
        pedido.setTrackingNumber("SEUR-123");
        when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(pedido));
        when(orderService.mapToOrderResponse(any(Order.class))).thenReturn(respuesta());

        service.actualizarTracking(NUM, new AdminOrderTrackingRequest(null, null));

        assertThat(pedido.getCarrier()).isNull();
        assertThat(pedido.getTrackingNumber()).isNull();

        when(orderRepository.findByOrderNumberForUpdate("ORD-NOEXISTE")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.actualizarTracking(
                "ORD-NOEXISTE", new AdminOrderTrackingRequest("SEUR", "X")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("V1 order-status-emails (R2) - cada transición exitosa encola su email; el 409 no encola nada")
    void debeEncolarElEmailEnCadaTransicion() {
        // GIVEN
        when(orderService.mapToOrderResponse(any(Order.class))).thenReturn(respuesta());
        Order pedido = pedido(OrderStatus.CONFIRMED);
        when(orderRepository.findByOrderNumberForUpdate(NUM)).thenReturn(Optional.of(pedido));

        // WHEN — CONFIRMED → SHIPPED
        service.cambiarEstado(NUM, new AdminOrderStatusRequest(OrderStatus.SHIPPED));

        // THEN — una fila por transición, al estado de destino (misma transacción)
        verify(orderEmailNotifier).notificar(pedido, OrderStatus.SHIPPED);

        // WHEN — repetir el mismo estado (la guarda anti doble clic de la 7.4)
        assertThatThrownBy(() -> service.cambiarEstado(NUM, new AdminOrderStatusRequest(OrderStatus.SHIPPED)))
                .isInstanceOf(OrderStateConflictException.class);

        // THEN — el 409 no llega a generar ningún email adicional
        verify(orderEmailNotifier, times(1)).notificar(any(Order.class), any(OrderStatus.class));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private Order pedido(OrderStatus estado) {
        return pedidoConId(10L, NUM, estado, 101L, null);
    }

    private Order pedidoConId(Long id, String orderNumber, OrderStatus estado,
                              Long itemId, User usuario) {
        Order order = Order.builder()
                .id(id)
                .orderNumber(orderNumber)
                .idempotencyKey("idem-" + orderNumber)
                .marketCode("ES")
                .currency("EUR")
                .status(estado)
                .subtotalAmount(new BigDecimal("80.00"))
                .taxAmount(new BigDecimal("16.80"))
                .totalAmount(new BigDecimal("96.80"))
                .user(usuario)
                .build();
        order.addItem(OrderItem.builder()
                .id(itemId)
                .sku(Sku.builder().id(1L).barcode("740100000001").color("Marino").size("M").build())
                .warehouseCode("WH_ARTEIXO")
                .quantity(2)
                .unitPrice(new BigDecimal("40.00"))
                .taxRate(new BigDecimal("21.00"))
                .taxAmount(new BigDecimal("8.40"))
                .totalAmount(new BigDecimal("48.40"))
                .build());
        return order;
    }

    private OrderResponse respuesta() {
        return new OrderResponse(
                10L, NUM, "idem-" + NUM, "ES", "EUR",
                OrderStatus.CONFIRMED, new BigDecimal("80.00"), new BigDecimal("16.80"),
                new BigDecimal("96.80"), Instant.now(), Instant.now().plus(Duration.ofDays(30)),
                null, null, null, null, List.of());
    }
}
