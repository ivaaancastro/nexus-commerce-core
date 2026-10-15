package com.nexus.commerce.service;

import com.nexus.commerce.dto.PriceUpdateRequest;
import com.nexus.commerce.dto.SkuPriceResponse;
import com.nexus.commerce.entity.Market;
import com.nexus.commerce.entity.MarketPrice;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.exception.CatalogConflictException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.MarketPriceRepository;
import com.nexus.commerce.repository.MarketRepository;
import com.nexus.commerce.repository.SkuRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Precios por mercado para el panel (Tarea 7.3,
 * spec specs/admin-stock-pricing/).
 *
 * <p>Sólo se invoca desde {@code AdminSkuPriceController}, bajo
 * {@code /api/v1/admin/skus/…/prices} — la protección {@code hasRole("ADMIN")}
 * la aplica {@code SecurityConfig}, no este servicio.</p>
 *
 * <p>Reglas de negocio:</p>
 * <ul>
 *   <li><strong>Los 4 mercados siempre</strong> (R3.1): el GET cruza el
 *       catálogo de mercados con las filas del SKU; sin fila → campos en
 *       {@code null} y la UI crea en el primer guardado.</li>
 *   <li><strong>Uppsert sobre {@code uk_sku_market}</strong> (R3.2): la carrera
 *       de doble insert → {@code CatalogConflictException} (409), nunca 500.</li>
 *   <li><strong>Cross-field {@code 0 < descuento ≤ base}</strong> (R3.4): la
 *       capa {@code jakarta} del DTO cubre tipos y signos; esta comprobación
 *       → {@code IllegalArgumentException} → 400 con message.</li>
 *   <li><strong>{@code BigDecimal} punta a punta</strong> (regla 4.1): aquí no
 *       hay aritmética — la única, la de {@code PricingService}, no se toca.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminPricingService {

    private final MarketPriceRepository marketPriceRepository;
    private final MarketRepository marketRepository;
    private final SkuRepository skuRepository;

    // ── Lectura ────────────────────────────────────────────────────────────

    /**
     * Los 4 mercados del SKU, orden por {@code code} (R3.1). Las filas
     * inexistentes salen con los campos de precio en {@code null} — es la
     * señal de «crear en el primer guardado».
     */
    @Transactional(readOnly = true)
    public List<SkuPriceResponse> getPrecios(Long skuId) {
        if (!skuRepository.existsById(skuId)) {
            throw new ResourceNotFoundException("SKU no encontrado con id " + skuId);
        }

        Map<String, MarketPrice> porMercado = marketPriceRepository.findBySkuIdWithMarket(skuId)
                .stream()
                .collect(Collectors.toMap(
                        mp -> mp.getMarket().getCode(),
                        Function.identity(),
                        (a, b) -> a));

        return marketRepository.findAll(Sort.by(Sort.Direction.ASC, "code")).stream()
                .map(mercado -> {
                    MarketPrice precio = porMercado.get(mercado.getCode());
                    return new SkuPriceResponse(
                            mercado.getCode(),
                            mercado.getName(),
                            mercado.getCurrency(),
                            mercado.getTaxRate(),
                            precio == null ? null : precio.getBasePrice(),
                            precio == null ? null : precio.getDiscountPrice(),
                            precio == null ? null : precio.getIsActive());
                })
                .toList();
    }

    // ── Escritura ──────────────────────────────────────────────────────────

    /**
     * Crea o actualiza el precio de un SKU en un mercado (upsert, R3.2).
     * Devuelve la fila resultante para que la UI se actualice sin re-fetch.
     */
    @Transactional
    public SkuPriceResponse actualizarPrecio(Long skuId, String marketCode,
                                             PriceUpdateRequest request) {
        String codigo = marketCode.toUpperCase();
        Sku sku = skuRepository.findById(skuId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "SKU no encontrado con id " + skuId));
        Market mercado = marketRepository.findByCode(codigo)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Mercado no encontrado: " + marketCode));

        // Cross-field (R3.4): la capa jakarta ya garantizó signos y escala.
        if (request.discountPrice() != null
                && request.discountPrice().compareTo(request.basePrice()) > 0) {
            throw new IllegalArgumentException(
                    "El descuento no puede superar el precio base");
        }

        MarketPrice precio = marketPriceRepository
                .findBySkuIdAndMarketCode(skuId, codigo)
                .orElseGet(() -> MarketPrice.builder()
                        .sku(sku)
                        .market(mercado)
                        .build());

        precio.setBasePrice(request.basePrice());
        precio.setDiscountPrice(request.discountPrice());
        precio.setIsActive(request.isActive());

        try {
            marketPriceRepository.saveAndFlush(precio);
        } catch (DataIntegrityViolationException e) {
            // Carrera de doble insert sobre uk_sku_market (R3.5): 409 con el
            // código CATALOG_CONFLICT ya mapeado, nunca un 500.
            throw new CatalogConflictException(
                    "El precio cambió a la vez; vuelve a intentarlo");
        }

        log.info("Precio actualizado: sku={} mercado={} base={} descuento={} activo={}",
                skuId, codigo, precio.getBasePrice(), precio.getDiscountPrice(),
                precio.getIsActive());

        return new SkuPriceResponse(
                precio.getMarket().getCode(),
                precio.getMarket().getName(),
                precio.getMarket().getCurrency(),
                precio.getMarket().getTaxRate(),
                precio.getBasePrice(),
                precio.getDiscountPrice(),
                precio.getIsActive());
    }
}
