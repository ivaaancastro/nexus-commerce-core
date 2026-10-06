package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Address;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.ShippingAddress;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.exception.InsufficientStockException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.AddressRepository;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductReturnRepository;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final SkuRepository skuRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final ProductReturnRepository productReturnRepository;
    private final InventoryService inventoryService;
    private final PricingService pricingService;
    private final WarehouseSelectionService warehouseSelectionService;
    private final ReturnEligibilityService returnEligibilityService;

    @Transactional
    public OrderResponse processCheckout(String idempotencyKey, CheckoutRequest request, String userEmail) {
        // 1. Control de Idempotencia: si ya fue procesada, devolvemos la existente
        Optional<Order> existingOrder = orderRepository.findByIdempotencyKey(idempotencyKey);
        if (existingOrder.isPresent()) {
            log.info("Idempotency key '{}' detectada. Devolviendo orden {}", idempotencyKey, existingOrder.get().getOrderNumber());
            return mapToOrderResponse(existingOrder.get());
        }

        log.info("Iniciando checkout transaccional para mercado '{}' con {} líneas",
                request.marketCode(), request.items().size());

        // 1b. Dirección y usuario, ANTES de reservar stock (Tarea 5.5, R1).
        //     Si la dirección no existe o es de otro usuario, se falla aquí sin
        //     haber tocado inventario.
        User user = resolveUser(userEmail);
        ShippingAddress shippingAddress = resolveShippingAddress(request.addressId(), user);

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
                .user(user)
                .shippingAddress(shippingAddress)
                .paymentMethod(request.paymentMethod())
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

    /**
     * Historial paginado del usuario, del más reciente al más antiguo.
     * La propiedad se comprueba en la consulta: sin usuario no hay filas.
     */
    @Transactional(readOnly = true)
    public OrderPageResponse listOrders(String email, int page, int size) {
        User user = requireUser(email);

        Page<Order> result = orderRepository.findByUserIdOrderByCreatedAtDesc(
                user.getId(), PageRequest.of(page, size));

        // R10: qué líneas tienen devolución ya solicitada. UNA consulta para toda
        // la página — llamando a existsByOrderItemId por línea dispararíamos una
        // query por cada artículo del listado.
        List<Long> itemIds = result.getContent().stream()
                .flatMap(order -> order.getItems().stream())
                .map(OrderItem::getId)
                .toList();

        Set<Long> returnedItemIds = itemIds.isEmpty()
                ? Set.of()
                : new HashSet<>(productReturnRepository.findOrderItemIdIn(itemIds));

        List<OrderSummaryResponse> summaries = result.getContent().stream()
                .map(order -> new OrderSummaryResponse(
                        order.getId(),
                        order.getOrderNumber(),
                        order.getStatus(),
                        order.getCurrency(),
                        order.getTotalAmount(),
                        order.getCreatedAt(),
                        order.getItems().size(),
                        // R9: la tarjeta pinta nombre y variante de cada producto
                        order.getItems().stream()
                                .map(this::mapToItemPreview)
                                .toList(),
                        // R10: badge «Devolución solicitada» en el historial
                        order.getItems().stream()
                                .anyMatch(item -> returnedItemIds.contains(item.getId()))
                ))
                .toList();

        return new OrderPageResponse(
                summaries,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    /**
     * Línea para la tarjeta del historial (Tarea 5.5, R9). Recorre
     * {@code OrderItem → Sku → Product}, igual que el detalle, pero solo con lo
     * que se pinta: sin precios fiscales ni elegibilidad.
     */
    private OrderItemPreviewResponse mapToItemPreview(OrderItem item) {
        Product product = item.getSku().getProduct();
        return new OrderItemPreviewResponse(
                product.getName(),
                product.getFamily(),
                item.getSku().getSize(),
                item.getSku().getColor(),
                item.getQuantity(),
                item.getTotalAmount()
        );
    }

    /**
     * Detalle de un pedido propiedad del usuario.
     * Devuelve vacío tanto si no existe como si es de otro usuario → 404.
     */
    @Transactional(readOnly = true)
    public Optional<OrderResponse> getOrderForUser(String email, String orderNumber) {
        return userRepository.findByEmail(email)
                .flatMap(user -> orderRepository.findByUserIdAndOrderNumber(user.getId(), orderNumber))
                .map(this::mapToOrderResponse);
    }

    /**
     * Asocia el usuario al pedido. Un checkout sin sesión (o con un email que ya
     * no exista) queda con user_id nulo, tal como prevé la spec.
     */
    private User resolveUser(String email) {
        if (email == null) {
            return null;
        }
        return userRepository.findByEmail(email)
                .map(user -> {
                    log.info("Pedido asociado al usuario {}", user.getId());
                    return user;
                })
                .orElseGet(() -> {
                    log.warn("No se encontró usuario para '{}'; el pedido quedará sin asociar", email);
                    return null;
                });
    }

    /**
     * Resuelve el <strong>snapshot</strong> de la dirección de envío (Tarea 5.5, R1).
     *
     * <p>La propiedad se comprueba <em>en la propia consulta</em>
     * ({@code findByIdAndUserId}), así que «no existe» y «es de otro usuario»
     * caen en lo mismo: un único {@code 400} que además no permite averiguar si
     * una dirección ajena existe.</p>
     *
     * <p>Si no hay usuario, no hay a quién pertenecer la dirección —y
     * {@code addressId} es obligatorio—, así que el checkout se rechaza. Ese
     * caso solo es alcanzable con un email que ya no resuelva: desde que el
     * checkout exige sesión (PR #13) siempre hay usuario.</p>
     */
    private ShippingAddress resolveShippingAddress(Long addressId, User user) {
        Optional<Address> found = user == null
                ? Optional.empty()
                : addressRepository.findByIdAndUserId(addressId, user.getId());

        return found
                .map(source -> ShippingAddress.builder()
                        .fullName(source.getFullName())
                        .street(source.getStreet())
                        .city(source.getCity())
                        .postalCode(source.getPostalCode())
                        .countryCode(source.getCountryCode())
                        .build())
                .orElseThrow(() -> new IllegalArgumentException(
                        "La dirección de envío seleccionada no es válida."));
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    }

    private OrderResponse mapToOrderResponse(Order order) {
        List<OrderItemResponse> itemResponses = order.getItems().stream()
                .map(item -> {
                    // §2.2 de la spec: la elegibilidad viaja enriquecida en el detalle.
                    // En el checkout el pedido es PENDING, así que sale por R2 sin consultar BD.
                    ReturnEligibilityService.Eligibility eligibility =
                            returnEligibilityService.evaluate(order, item);

                    // Tarea 5.5, R3: nombre y variantes para el resumen de productos.
                    Product product = item.getSku().getProduct();
                    return new OrderItemResponse(
                            item.getId(),
                            item.getSku().getId(),
                            item.getSku().getBarcode(),
                            item.getWarehouseCode(),
                            item.getQuantity(),
                            item.getUnitPrice(),
                            item.getTaxRate(),
                            item.getTaxAmount(),
                            item.getTotalAmount(),
                            eligibility.eligible(),
                            eligibility.ineligibleReason(),
                            product.getName(),
                            product.getFamily(),
                            item.getSku().getSize(),
                            item.getSku().getColor()
                    );
                })
                .toList();

        // R4: la ventana vive en un solo sitio — la misma constante que evalúa R1.
        // `createdAt` es nullable aquí porque @CreationTimestamp se fija en el flush,
        // no necesariamente en el save() del propio checkout.
        Instant createdAt = order.getCreatedAt();
        Instant returnDeadline = createdAt == null
                ? null
                : createdAt.plus(Duration.ofDays(ReturnEligibilityService.WINDOW_DAYS));

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
                createdAt,
                returnDeadline,
                mapToShippingAddress(order.getShippingAddress()),
                order.getPaymentMethod(),
                itemResponses
        );
    }

    /**
     * Snapshot de envío a DTO. {@code null} en las órdenes anteriores a {@code V10}:
     * se devuelve tal cual y el frontend <strong>no pinta</strong> la sección
     * en lugar de mostrar un hueco vacío (Tarea 5.5, R7).
     */
    private ShippingAddressResponse mapToShippingAddress(ShippingAddress address) {
        if (address == null) {
            return null;
        }
        return new ShippingAddressResponse(
                address.getFullName(),
                address.getStreet(),
                address.getCity(),
                address.getPostalCode(),
                address.getCountryCode()
        );
    }
}