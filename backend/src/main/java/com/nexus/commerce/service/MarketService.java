package com.nexus.commerce.service;

import com.nexus.commerce.dto.MarketResponse;
import com.nexus.commerce.entity.Market;
import com.nexus.commerce.repository.MarketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Lectura del catálogo de mercados (Tarea 3.2, R1).
 *
 * <p>Sin lógica de negocio: solo expone lo que ya está sembrado en
 * {@code markets}, ordenado por código para que el selector tenga siempre el
 * mismo orden en todas las sesiones.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MarketService {

    private final MarketRepository marketRepository;

    public List<MarketResponse> getAllMarkets() {
        return marketRepository.findAll(Sort.by("code")).stream()
                .map(this::toResponse)
                .toList();
    }

    private MarketResponse toResponse(Market market) {
        return new MarketResponse(
                market.getCode(),
                market.getName(),
                market.getCurrency(),
                market.getTaxRate()
        );
    }
}
