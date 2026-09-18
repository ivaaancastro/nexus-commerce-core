package com.nexus.commerce.service;

import com.nexus.commerce.dto.ReserveStockRequest;
import com.nexus.commerce.dto.StockReservationResponse;
import com.nexus.commerce.dto.StockResponse;
import com.nexus.commerce.dto.WarehouseStockResponse;
import com.nexus.commerce.entity.StockItem;
import com.nexus.commerce.exception.InsufficientStockException;
import com.nexus.commerce.repository.StockItemRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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