package com.nexus.commerce.service;

import com.nexus.commerce.dto.PriceCalculationResponse;
import com.nexus.commerce.entity.Market;
import com.nexus.commerce.entity.MarketPrice;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.repository.MarketPriceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PricingServiceTest {

    @Mock
    private MarketPriceRepository marketPriceRepository;

    @InjectMocks
    private PricingService pricingService;

    @Test
    @DisplayName("Debe calcular desglose impositivo correctamente para precio base sin descuento (España 21%)")
    void shouldCalculateTaxesCorrectlyWithoutDiscount() {
        // GIVEN: 79.95 EUR con 21% IVA -> Base: 66.07, Impuesto: 13.88
        Market market = Market.builder()
                .code("ES")
                .currency("EUR")
                .taxRate(new BigDecimal("21.00"))
                .build();

        Sku sku = Sku.builder().id(1L).build();

        MarketPrice price = MarketPrice.builder()
                .sku(sku)
                .market(market)
                .basePrice(new BigDecimal("79.95"))
                .discountPrice(null)
                .build();

        when(marketPriceRepository.findActivePriceBySkuAndMarket(1L, "ES"))
                .thenReturn(Optional.of(price));

        // WHEN
        Optional<PriceCalculationResponse> result = pricingService.calculatePrice(1L, "es");

        // THEN
        assertThat(result).isPresent();
        PriceCalculationResponse response = result.get();
        assertThat(response.finalPrice()).isEqualByComparingTo("79.95");
        assertThat(response.netAmount()).isEqualByComparingTo("66.07");
        assertThat(response.taxAmount()).isEqualByComparingTo("13.88");
        assertThat(response.hasDiscount()).isFalse();
        assertThat(response.currency()).isEqualTo("EUR");
    }

    @Test
    @DisplayName("Debe aplicar discountPrice como precio final cuando exista rebaja activa")
    void shouldApplyDiscountPriceWhenPresent() {
        // GIVEN: Base 100.00 EUR rebajado a 50.00 EUR con 21% IVA -> Base neta sobre 50: 41.32, Impuesto: 8.68
        Market market = Market.builder()
                .code("ES")
                .currency("EUR")
                .taxRate(new BigDecimal("21.00"))
                .build();

        Sku sku = Sku.builder().id(2L).build();

        MarketPrice price = MarketPrice.builder()
                .sku(sku)
                .market(market)
                .basePrice(new BigDecimal("100.00"))
                .discountPrice(new BigDecimal("50.00"))
                .build();

        when(marketPriceRepository.findActivePriceBySkuAndMarket(2L, "ES"))
                .thenReturn(Optional.of(price));

        // WHEN
        Optional<PriceCalculationResponse> result = pricingService.calculatePrice(2L, "ES");

        // THEN
        assertThat(result).isPresent();
        PriceCalculationResponse response = result.get();
        assertThat(response.finalPrice()).isEqualByComparingTo("50.00");
        assertThat(response.originalPrice()).isEqualByComparingTo("100.00");
        assertThat(response.hasDiscount()).isTrue();
        assertThat(response.netAmount()).isEqualByComparingTo("41.32");
        assertThat(response.taxAmount()).isEqualByComparingTo("8.68");
    }

    @Test
    @DisplayName("Debe retornar Optional vacío si el SKU no tiene precio activo en ese mercado")
    void shouldReturnEmptyWhenPriceNotFound() {
        // GIVEN
        when(marketPriceRepository.findActivePriceBySkuAndMarket(99L, "US"))
                .thenReturn(Optional.empty());

        // WHEN
        Optional<PriceCalculationResponse> result = pricingService.calculatePrice(99L, "US");

        // THEN
        assertThat(result).isEmpty();
        verify(marketPriceRepository, times(1)).findActivePriceBySkuAndMarket(99L, "US");
    }
}