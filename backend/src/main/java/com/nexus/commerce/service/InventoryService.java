package com.nexus.commerce.service;

import com.nexus.commerce.dto.StockResponse;
import com.nexus.commerce.dto.WarehouseStockResponse;
import com.nexus.commerce.entity.StockItem;
import com.nexus.commerce.repository.StockItemRepository;
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