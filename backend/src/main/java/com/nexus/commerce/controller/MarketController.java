package com.nexus.commerce.controller;

import com.nexus.commerce.dto.MarketResponse;
import com.nexus.commerce.service.MarketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/markets")
@RequiredArgsConstructor
@Tag(name = "Markets", description = "Mercados activos con su divisa e impuestos para el selector de divisa")
public class MarketController {

    private final MarketService marketService;

    @GetMapping
    @Operation(summary = "Listar mercados disponibles",
            description = "Devuelve los mercados ordenados por código. Público: el visitante del catálogo "
                    + "también necesita ver los precios en su divisa.")
    public ResponseEntity<List<MarketResponse>> getAllMarkets() {
        return ResponseEntity.ok(marketService.getAllMarkets());
    }
}
