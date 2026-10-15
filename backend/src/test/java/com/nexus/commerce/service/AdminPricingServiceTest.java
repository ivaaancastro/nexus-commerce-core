package com.nexus.commerce.service;

import com.nexus.commerce.dto.PriceUpdateRequest;
import com.nexus.commerce.entity.Market;
import com.nexus.commerce.entity.MarketPrice;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.exception.CatalogConflictException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.MarketPriceRepository;
import com.nexus.commerce.repository.MarketRepository;
import com.nexus.commerce.repository.SkuRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Tarea 7.3 (spec R3) — los caminos que la integración <em>no</em> puede
 * provocar de forma determinista: la <strong>carrera de doble insert</strong>
 * sobre {@code uk_sku_market} (R3.5). Se mockea el repositorio por el mismo
 * criterio que {@code AdminProductServiceTest}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Tarea 7.3 - AdminPricingService: cross-field y carrera de upsert")
class AdminPricingServiceTest {

    @Mock private MarketPriceRepository marketPriceRepository;
    @Mock private MarketRepository marketRepository;
    @Mock private SkuRepository skuRepository;

    @InjectMocks private AdminPricingService service;

    private Sku sku() {
        return Sku.builder().id(1L).color("Marino").size("M").build();
    }

    private Market mercado() {
        return Market.builder().id(1L).code("ES").name("España")
                .currency("EUR").taxRate(new BigDecimal("21.00")).build();
    }

    @Test
    @DisplayName("R3.4 - el descuento que supera el base -> IllegalArgumentException (400 con message)")
    void descuentoMayorQueBase400() {
        // GIVEN — la validación ocurre ANTES de mirar filas (sólo 404s)
        when(skuRepository.findById(1L)).thenReturn(Optional.of(sku()));
        when(marketRepository.findByCode("ES")).thenReturn(Optional.of(mercado()));

        // WHEN / THEN — 70 > 59.90 se rechaza con el mensaje que verá el panel
        assertThatThrownBy(() -> service.actualizarPrecio(1L, "ES",
                new PriceUpdateRequest(
                        new BigDecimal("59.90"), new BigDecimal("70.00"), true)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no puede superar");
    }

    @Test
    @DisplayName("R3.5 - carrera de doble insert -> CatalogConflictException (409), nunca un 500")
    void carreraDeDobleInsert409() {
        // GIVEN — sin fila previa y la restricción UNIQUE gana la carrera
        when(skuRepository.findById(1L)).thenReturn(Optional.of(sku()));
        when(marketRepository.findByCode("ES")).thenReturn(Optional.of(mercado()));
        when(marketPriceRepository.findBySkuIdAndMarketCode(1L, "ES"))
                .thenReturn(Optional.empty());
        when(marketPriceRepository.saveAndFlush(any(MarketPrice.class)))
                .thenThrow(new DataIntegrityViolationException("uk_sku_market"));

        // WHEN / THEN — se traduce al 409 de catálogo ya mapeado
        assertThatThrownBy(() -> service.actualizarPrecio(1L, "ES",
                new PriceUpdateRequest(
                        new BigDecimal("59.90"), null, true)))
                .isInstanceOf(CatalogConflictException.class);
    }

    @Test
    @DisplayName("R3 - SKU desconocido -> ResourceNotFoundException en lectura y escritura")
    void skuDesconocido404() {
        when(skuRepository.existsById(99L)).thenReturn(false);
        assertThatThrownBy(() -> service.getPrecios(99L))
                .isInstanceOf(ResourceNotFoundException.class);

        when(skuRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.actualizarPrecio(99L, "ES",
                new PriceUpdateRequest(
                        new BigDecimal("59.90"), null, true)))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
