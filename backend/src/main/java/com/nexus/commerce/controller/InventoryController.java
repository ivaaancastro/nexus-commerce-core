package com.nexus.commerce.controller;

import com.nexus.commerce.dto.StockResponse;
import com.nexus.commerce.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/skus/{skuId}")
    public ResponseEntity<StockResponse> getSkuStock(@PathVariable Long skuId) {
        return ResponseEntity.ok(inventoryService.getStockBySku(skuId));
    }
}