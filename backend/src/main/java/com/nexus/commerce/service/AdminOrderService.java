package com.nexus.commerce.service;

import com.nexus.commerce.dto.AdminOrderDetailResponse;
import com.nexus.commerce.dto.AdminOrderPageResponse;
import com.nexus.commerce.dto.AdminOrderStatusRequest;
import com.nexus.commerce.dto.AdminOrderSummaryResponse;
import com.nexus.commerce.dto.AdminOrderTrackingRequest;
import com.nexus.commerce.dto.OrderResponse;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.exception.OrderStateConflictException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductReturnRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Gestión de pedidos del panel (Tarea 7.4, spec specs/admin-orders/).
 *
 * <p><strong>No hay reglas de seguridad nuevas</strong>: al vivir bajo
 * {@code /api/v1/admin/**}, hereda el {@code hasRole("ADMIN")} de la 7.1
 * (ADR-0006) antes del {@code anyRequest().denyAll()}.
 * {@code SecurityConfig} no se modifica.</p>
 *
 * <p>El servidor es la <strong>única autoridad</strong> en la máquina de
 * transiciones (R3): el espejo TS del frontend sólo decide qué botones pinta.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminOrderService {

    /**
     * Máquina de transiciones (spec R3, plan D3). Fuera de la tabla →
     * {@code 409 ORDER_CONFLICT}; el caso «mismo estado» se trata aparte como
     * mensaje propio — es la guarda anti doble clic que impide aplicar los
     * efectos de stock dos veces.
     */
    private static final Map<OrderStatus, Set<OrderStatus>> TRANSICIONES = Map.of(
            OrderStatus.PENDING, Set.of(OrderStatus.CONFIRMED, OrderStatus.CANCELLED),
            OrderStatus.CONFIRMED, Set.of(OrderStatus.SHIPPED, OrderStatus.CANCELLED),
            OrderStatus.SHIPPED, Set.of(OrderStatus.DELIVERED),
            OrderStatus.DELIVERED, Set.of(),
            OrderStatus.CANCELLED, Set.of()
    );

    private final OrderRepository orderRepository;
    private final ProductReturnRepository productReturnRepository;
    private final InventoryService inventoryService;
    /** Reutiliza {@code mapToOrderResponse}: una sola definición de la forma del pedido. */
    private final OrderService orderService;

    // ── Lectura ────────────────────────────────────────────────────────────

    /**
     * Listado del panel (R1): todos los pedidos, orden {@code createdAt DESC},
     * filtros opcionales {@code status} y {@code q} (nº de pedido o email del
     * cliente). El flag {@code returnRequested} se resuelve con <strong>una
     * consulta por página</strong> (patrón 5.5 R10).
     */
    @Transactional(readOnly = true)
    public AdminOrderPageResponse listar(int page, int size, OrderStatus status, String q) {
        // Vacío o en blanco = sin filtro (el frontend no debe distinguir
        // «no mandó q» de «mandó q vacío»).
        String termino = (q == null || q.isBlank()) ? null : q.trim();

        Page<Order> resultado = orderRepository.findAllForAdmin(
                status, termino, PageRequest.of(page, size));

        List<Long> itemIds = resultado.getContent().stream()
                .flatMap(order -> order.getItems().stream())
                .map(OrderItem::getId)
                .toList();
        Set<Long> lineasConDevolucion = itemIds.isEmpty()
                ? Set.of()
                : new HashSet<>(productReturnRepository.findOrderItemIdIn(itemIds));

        List<AdminOrderSummaryResponse> filas = resultado.getContent().stream()
                .map(order -> new AdminOrderSummaryResponse(
                        order.getId(),
                        order.getOrderNumber(),
                        order.getStatus(),
                        order.getMarketCode(),
                        order.getCurrency(),
                        order.getTotalAmount(),
                        order.getCreatedAt(),
                        // Pedidos sin usuario (V7 nullable) → null, y la UI pinta «—»
                        order.getUser() != null ? order.getUser().getEmail() : null,
                        order.getItems().size(),
                        order.getCarrier(),
                        order.getTrackingNumber(),
                        order.getItems().stream().anyMatch(i -> lineasConDevolucion.contains(i.getId()))
                ))
                .toList();

        return new AdminOrderPageResponse(
                filas,
                resultado.getNumber(),
                resultado.getSize(),
                resultado.getTotalElements(),
                resultado.getTotalPages()
        );
    }

    /**
     * Detalle admin (R2): compone el mismo {@link OrderResponse} que ve el
     * cliente más {@code userEmail} y {@code returnRequested}.
     */
    @Transactional(readOnly = true)
    public AdminOrderDetailResponse detalle(String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Pedido no encontrado: " + orderNumber));
        return toDetail(order);
    }

    // ── Escritura ──────────────────────────────────────────────────────────

    /**
     * Cambio de estado (R3/R4): <strong>lock de la fila del pedido</strong> antes
     * de mirar nada — dos cambios concurrentes se serializan y el segundo ve el
     * estado ya aplicado (recibe {@code 409}, no un doble efecto de stock).
     * Los efectos de inventario corren dentro de <strong>la misma
     * transacción</strong>: si la guarda de stock falla, el estado no cambia
     * (regla 4.2, plan D4).
     */
    @Transactional
    public AdminOrderDetailResponse cambiarEstado(String orderNumber, AdminOrderStatusRequest request) {
        Order order = orderRepository.findByOrderNumberForUpdate(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Pedido no encontrado: " + orderNumber));

        OrderStatus actual = order.getStatus();
        OrderStatus destino = request.status();

        if (actual == destino) {
            // Guarda anti doble clic: «enviar» dos veces no descuenta stock dos veces.
            throw new OrderStateConflictException(
                    "El pedido " + orderNumber + " ya está en estado " + etiqueta(actual));
        }

        Set<OrderStatus> permitidas = TRANSICIONES.getOrDefault(actual, Set.of());
        if (!permitidas.contains(destino)) {
            String sugerencia = permitidas.isEmpty()
                    ? "es un estado final"
                    : "sólo se puede mover a " + permitidas.stream()
                            .map(AdminOrderService::etiqueta).sorted().toList();
            throw new OrderStateConflictException(
                    "Transición no permitida: un pedido " + etiqueta(actual) +
                            " no puede pasar a " + etiqueta(destino) + " (" + sugerencia + ").");
        }

        switch (destino) {
            case CANCELLED -> liberarReservas(order);
            case SHIPPED -> descontarEnvio(order);
            // CONFIRMED y DELIVERED no mueven stock (R4.5)
            default -> { }
        }

        order.setStatus(destino);
        orderRepository.save(order);
        log.info("Pedido {} cambia de {} a {}", orderNumber, actual, destino);

        return toDetail(order);
    }

    /**
     * Tracking (R5): full-replace — vacío o ausente → {@code null} (limpia).
     * Editable en cualquier estado: es metadato puro (plan D5). Se toma el lock
     * de la fila igual que en el cambio de estado para que una edición de
     * tracking concurrente no pise (ni sea pisada por) un cambio de estado.
     */
    @Transactional
    public AdminOrderDetailResponse actualizarTracking(String orderNumber, AdminOrderTrackingRequest request) {
        Order order = orderRepository.findByOrderNumberForUpdate(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Pedido no encontrado: " + orderNumber));

        order.setCarrier(normalizar(request.carrier()));
        order.setTrackingNumber(normalizar(request.trackingNumber()));
        orderRepository.save(order);
        log.info("Tracking del pedido {} actualizado (carrier={}, trackingNumber={})",
                orderNumber, order.getCarrier(), order.getTrackingNumber());

        return toDetail(order);
    }

    // ── Internos ───────────────────────────────────────────────────────────

    /**
     * Efecto de stock al cancelar (R4.1/R4.2): cada línea devuelve su reserva.
     * Si falta una fila de stock, el servicio la salta con {@code warn} — la
     * cancelación se completa igualmente.
     */
    private void liberarReservas(Order order) {
        for (OrderItem item : order.getItems()) {
            inventoryService.releaseReservedStock(
                    item.getSku().getId(), item.getWarehouseCode(), item.getQuantity());
        }
    }

    /**
     * Efecto de stock al enviar (R4.3/R4.4): la mercancía sale del almacén.
     * {@code shipStock} lanza {@code 409 STOCK_CONFLICT} si no cuadra y aquí
     * propaga — el {@code @Transactional} revierte también el cambio de estado.
     */
    private void descontarEnvio(Order order) {
        for (OrderItem item : order.getItems()) {
            inventoryService.shipStock(
                    item.getSku().getId(), item.getWarehouseCode(), item.getQuantity());
        }
    }

    private AdminOrderDetailResponse toDetail(Order order) {
        OrderResponse orden = orderService.mapToOrderResponse(order);
        boolean returnRequested = !productReturnRepository
                .findByOrderItemOrderId(order.getId()).isEmpty();
        String email = order.getUser() != null ? order.getUser().getEmail() : null;
        return new AdminOrderDetailResponse(orden, email, returnRequested);
    }

    /** Blanquea el full-replace de tracking: vacío o en blanco → {@code null}. */
    private static String normalizar(String valor) {
        if (valor == null) {
            return null;
        }
        String limpio = valor.trim();
        return limpio.isEmpty() ? null : limpio;
    }

    /** Etiqueta en español para los mensajes de la máquina (espejo del frontend). */
    private static String etiqueta(OrderStatus status) {
        return switch (status) {
            case PENDING -> "Pendiente";
            case CONFIRMED -> "Confirmado";
            case SHIPPED -> "Enviado";
            case DELIVERED -> "Entregado";
            case CANCELLED -> "Cancelado";
        };
    }
}
