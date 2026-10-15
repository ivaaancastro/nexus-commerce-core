package com.nexus.commerce.service;

import com.nexus.commerce.dto.ReserveStockRequest;
import com.nexus.commerce.dto.StockReservationResponse;
import com.nexus.commerce.dto.StockResponse;
import com.nexus.commerce.dto.WarehouseStockResponse;
import com.nexus.commerce.entity.StockItem;
import com.nexus.commerce.exception.InsufficientStockException;
import com.nexus.commerce.exception.StockConflictException;
import com.nexus.commerce.repository.StockItemRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryService {

    private final StockItemRepository stockItemRepository;

    public StockResponse getStockBySku(Long skuId) {
        List<StockItem> items = stockItemRepository.findBySkuIdWithWarehouse(skuId);

        List<WarehouseStockResponse> breakdown = items.stream()
                .map(this::mapToWarehouseStock)
                .toList();

        int totalAvailable = breakdown.stream()
                .mapToInt(WarehouseStockResponse::netAvailable)
                .sum();

        return new StockResponse(
                skuId,
                totalAvailable,
                totalAvailable > 0,
                breakdown
        );
    }

    @Transactional // Transacción de escritura obligatoria
    public StockReservationResponse reserveStock(@Valid ReserveStockRequest request) {
        StockItem stockItem = stockItemRepository
                .findBySkuIdAndWarehouseCodeForUpdate(request.skuId(), request.warehouseCode())
                .orElseThrow(() -> new IllegalArgumentException(
                        "No se encontró stock para el SKU " + request.skuId() +
                                " en el almacén " + request.warehouseCode()));

        int currentNetAvailable = stockItem.getQuantityAvailable() - stockItem.getQuantityReserved();

        if (currentNetAvailable < request.quantity()) {
            throw new InsufficientStockException(
                    "Stock insuficiente en " + request.warehouseCode() +
                            ". Solicitadas: " + request.quantity() +
                            ", Disponibles: " + currentNetAvailable);
        }

        // Aplicar la reserva
        stockItem.setQuantityReserved(stockItem.getQuantityReserved() + request.quantity());
        stockItemRepository.save(stockItem);

        int remaining = stockItem.getQuantityAvailable() - stockItem.getQuantityReserved();

        return new StockReservationResponse(
                request.skuId(),
                request.warehouseCode(),
                request.quantity(),
                remaining,
                "RESERVED"
        );
    }

    /**
     * Libera la reserva de una línea al <strong>cancelar</strong> un pedido
     * (Tarea 7.4, R4.1): las unidades vuelven a estar vendibles bajando
     * {@code quantity_reserved}. Escritura bajo el mismo
     * {@code PESSIMISTIC_WRITE} que usa la reserva del checkout, así que una
     * cancelación y una reserva concurrentes sobre la fila se serializan.
     *
     * <p><strong>Fila ausente → no falla</strong> (R4.2): se loguea y se sigue.
     * Cancelar es la vía de recuperación del pedido y una cancelación nunca debe
     * quedar bloqueada por un hueco de inventario. El {@code max(0,…)} es
     * defensivo (plan D4): los E2E restauran el stock a los valores de V1 y
     * podrían dejar {@code reserved = 0} con pedidos vivos.</p>
     */
    @Transactional
    public void releaseReservedStock(Long skuId, String warehouseCode, int quantity) {
        Optional<StockItem> maybeItem = stockItemRepository
                .findBySkuIdAndWarehouseCodeForUpdate(skuId, warehouseCode);

        if (maybeItem.isEmpty()) {
            log.warn("Liberación de reserva omitida: no hay fila de stock para el SKU {} en {}",
                    skuId, warehouseCode);
            return;
        }

        StockItem stockItem = maybeItem.get();
        stockItem.setQuantityReserved(Math.max(0, stockItem.getQuantityReserved() - quantity));
        stockItemRepository.save(stockItem);
    }

    /**
     * Descuenta el inventario al <strong>enviar</strong> un pedido (Tarea 7.4,
     * R4.3): la mercancía sale del almacén, así que baja el disponible y la
     * reserva se consume (el neto no cambia — esas unidades ya no eran
     * vendibles desde el checkout).
     *
     * <p>Guardas: fila ausente o {@code available < quantity} →
     * {@link StockConflictException} (HTTP 409) — el servicio transaccional del
     * panel revierte también el cambio de estado, así que el pedido <strong>no
     * queda</strong> en «enviado» sobre un inventario imposible.</p>
     */
    @Transactional
    public void shipStock(Long skuId, String warehouseCode, int quantity) {
        StockItem stockItem = stockItemRepository
                .findBySkuIdAndWarehouseCodeForUpdate(skuId, warehouseCode)
                .orElseThrow(() -> new StockConflictException(
                        "No se puede enviar el pedido: falta la fila de stock del SKU " +
                                skuId + " en " + warehouseCode));

        if (stockItem.getQuantityAvailable() < quantity) {
            throw new StockConflictException(
                    "No se pueden enviar " + quantity + " unidades del SKU " + skuId +
                            ": sólo quedan " + stockItem.getQuantityAvailable() +
                            " disponibles en " + warehouseCode);
        }

        stockItem.setQuantityAvailable(stockItem.getQuantityAvailable() - quantity);
        stockItem.setQuantityReserved(Math.max(0, stockItem.getQuantityReserved() - quantity));
        stockItemRepository.save(stockItem);
    }

    private WarehouseStockResponse mapToWarehouseStock(StockItem item) {
        int netAvailable = Math.max(0, item.getQuantityAvailable() - item.getQuantityReserved());

        return new WarehouseStockResponse(
                item.getWarehouse().getCode(),
                item.getWarehouse().getName(),
                item.getWarehouse().getCountryCode(),
                item.getQuantityAvailable(),
                item.getQuantityReserved(),
                netAvailable
        );
    }
}