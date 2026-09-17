package com.nexus.commerce.service;

import com.nexus.commerce.dto.PriceCalculationResponse;
import com.nexus.commerce.entity.Market;
import com.nexus.commerce.entity.MarketPrice;
import com.nexus.commerce.repository.MarketPriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PricingService {

    private final MarketPriceRepository marketPriceRepository;

    public Optional<PriceCalculationResponse> calculatePrice(Long skuId, String marketCode) {
        return marketPriceRepository.findActivePriceBySkuAndMarket(skuId, marketCode.toUpperCase())
                .map(this::buildPriceResponse);
    }

    private PriceCalculationResponse buildPriceResponse(MarketPrice price) {
        Market market = price.getMarket();
        BigDecimal taxRate = market.getTaxRate();

        // Determinar el precio final (si hay descuento activo, manda el descuento)
        boolean hasDiscount = price.getDiscountPrice() != null
                && price.getDiscountPrice().compareTo(BigDecimal.ZERO) > 0;

        BigDecimal finalPrice = hasDiscount ? price.getDiscountPrice() : price.getBasePrice();
        BigDecimal originalPrice = price.getBasePrice();

        // Cálculo de impuestos: Base Neta = Precio Final / (1 + (taxRate / 100))
        BigDecimal taxFactor = BigDecimal.ONE.add(
                taxRate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)
        );

        BigDecimal netAmount = finalPrice.divide(taxFactor, 2, RoundingMode.HALF_UP);
        BigDecimal taxAmount = finalPrice.subtract(netAmount);

        return new PriceCalculationResponse(
                price.getSku().getId(),
                market.getCode(),
                market.getCurrency(),
                finalPrice,
                originalPrice,
                hasDiscount,
                netAmount,
                taxAmount,
                taxRate
        );
    }
}