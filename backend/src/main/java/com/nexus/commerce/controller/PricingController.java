package com.nexus.commerce.controller;

import com.nexus.commerce.dto.PriceCalculationResponse;
import com.nexus.commerce.service.PricingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pricing")
@RequiredArgsConstructor
public class PricingController {

    private final PricingService pricingService;

    @GetMapping("/skus/{skuId}")
    public ResponseEntity<PriceCalculationResponse> getSkuPrice(
            @PathVariable Long skuId,
            @RequestParam(defaultValue = "ES") String market
    ) {
        return pricingService.calculatePrice(skuId, market)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}