package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.SkuRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final SkuRepository skuRepository;
    private final InventoryService inventoryService;
    private final PricingService pricingService;
    private final WarehouseSelectionService warehouseSelectionService;

    @Transactional
    public OrderResponse processCheckout(String idempotencyKey, CheckoutRequest request) {
        // 1. Control de Idempotencia: si ya fue procesada, devolvemos la existente
        Optional<Order> existingOrder = orderRepository.findByIdempotencyKey(idempotencyKey);
        if (existingOrder.isPresent()) {
            log.info("Idempotency key '{}' detectada. Devolviendo orden {}", idempotencyKey, existingOrder.get().getOrderNumber());
            return mapToOrderResponse(existingOrder.get());
        }

        log.info("Iniciando checkout transaccional para mercado '{}' con {} líneas",
                request.marketCode(), request.items().size());

        String orderNumber = "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String currency = null;

        BigDecimal subtotalAccumulator = BigDecimal.ZERO;
        BigDecimal taxAccumulator = BigDecimal.ZERO;
        BigDecimal totalAccumulator = BigDecimal.ZERO;

        List<OrderItem> orderItems = new ArrayList<>();

        for (CheckoutItemRequest itemRequest : request.items()) {
            // 2. Selección automática de almacén óptimo (más cercano al destino con stock)
            String optimalWarehouse = warehouseSelectionService.selectOptimalWarehouse(
                    itemRequest.skuId(),
                    request.destinationCountryCode(),
                    request.destinationLatitude(),
                    request.destinationLongitude()
            );

            if (optimalWarehouse == null) {
                throw new InsufficientStockException(
                        "No hay stock disponible para el SKU " + itemRequest.skuId());
            }

            // 3. Reserva atómica de inventario (bloqueo pesimista en DB)
            inventoryService.reserveStock(new ReserveStockRequest(
                    itemRequest.skuId(),
                    optimalWarehouse,
                    itemRequest.quantity()
            ));

            // 3. Obtención y congelación del precio e impuestos para el mercado
            PriceCalculationResponse priceResponse = pricingService.calculatePrice(itemRequest.skuId(), request.marketCode())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Precio no configurado para el SKU " + itemRequest.skuId() + " en el mercado " + request.marketCode()));

            if (currency == null) {
                currency = priceResponse.currency();
            }

            Sku sku = skuRepository.findById(itemRequest.skuId())
                    .orElseThrow(() -> new IllegalArgumentException("SKU no encontrado: " + itemRequest.skuId()));

            BigDecimal qty = BigDecimal.valueOf(itemRequest.quantity());
            BigDecimal itemTotal = priceResponse.finalPrice().multiply(qty).setScale(2, RoundingMode.HALF_UP);
            BigDecimal itemTax = priceResponse.taxAmount().multiply(qty).setScale(2, RoundingMode.HALF_UP);

            OrderItem orderItem = OrderItem.builder()
                    .sku(sku)
                    .warehouseCode(optimalWarehouse)
                    .quantity(itemRequest.quantity())
                    .unitPrice(priceResponse.finalPrice())
                    .taxRate(priceResponse.taxRate())
                    .taxAmount(itemTax)
                    .totalAmount(itemTotal)
                    .build();

            orderItems.add(orderItem);

            subtotalAccumulator = subtotalAccumulator.add(itemTotal.subtract(itemTax));
            taxAccumulator = taxAccumulator.add(itemTax);
            totalAccumulator = totalAccumulator.add(itemTotal);
        }

        // 4. Creación y persistencia de la orden
        Order order = Order.builder()
                .orderNumber(orderNumber)
                .idempotencyKey(idempotencyKey)
                .marketCode(request.marketCode().toUpperCase())
                .currency(currency)
                .status(OrderStatus.CONFIRMED)
                .subtotalAmount(subtotalAccumulator)
                .taxAmount(taxAccumulator)
                .totalAmount(totalAccumulator)
                .build();

        for (OrderItem item : orderItems) {
            order.addItem(item);
        }

        Order savedOrder = orderRepository.save(order);
        log.info("Orden {} creada con éxito. Total: {} {}", savedOrder.getOrderNumber(), savedOrder.getTotalAmount(), currency);

        return mapToOrderResponse(savedOrder);
    }

    @Transactional(readOnly = true)
    public Optional<OrderResponse> getOrderByNumber(String orderNumber) {
        return orderRepository.findByOrderNumber(orderNumber)
                .map(this::mapToOrderResponse);
    }

    private OrderResponse mapToOrderResponse(Order order) {
        List<OrderItemResponse> itemResponses = order.getItems().stream()
                .map(item -> new OrderItemResponse(
                        item.getId(),
                        item.getSku().getId(),
                        item.getSku().getBarcode(),
                        item.getWarehouseCode(),
                        item.getQuantity(),
                        item.getUnitPrice(),
                        item.getTaxRate(),
                        item.getTaxAmount(),
                        item.getTotalAmount()
                ))
                .toList();

        return new OrderResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getIdempotencyKey(),
                order.getMarketCode(),
                order.getCurrency(),
                order.getStatus(),
                order.getSubtotalAmount(),
                order.getTaxAmount(),
                order.getTotalAmount(),
                order.getCreatedAt(),
                itemResponses
        );
    }
}