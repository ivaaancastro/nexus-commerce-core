package com.nexus.commerce.service;

import com.nexus.commerce.dto.StockCellResponse;
import com.nexus.commerce.dto.StockMatrixResponse;
import com.nexus.commerce.dto.StockMatrixRowResponse;
import com.nexus.commerce.dto.StockUpdateRequest;
import com.nexus.commerce.dto.StockWarehouseResponse;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.StockItem;
import com.nexus.commerce.entity.Warehouse;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.exception.StockConflictException;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.StockItemRepository;
import com.nexus.commerce.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Matriz y escritura de stock para el panel (Tarea 7.3,
 * spec specs/admin-stock-pricing/).
 *
 * <p>Sólo se invoca desde {@code AdminStockController}, bajo
 * {@code /api/v1/admin/stock} — la protección {@code hasRole("ADMIN")} la
 * aplica {@code SecurityConfig} (regla heredada de la 7.1), no este servicio.</p>
 *
 * <p>Reglas de negocio:</p>
 * <ul>
 *   <li><strong>El admin sólo mueve {@code quantityAvailable}</strong> (R2.4):
 *       {@code quantityReserved} lo gestiona el checkout y ni se acepta en el
 *       body — reservar a mano duplicaría la lógica de
 *       {@code InventoryService.reserveStock}.</li>
 *   <li><strong>Invariant {@code reservado ≤ disponible}</strong> (R2.2):
 *       por debajo → {@code StockConflictException} (409). El
 *       {@code net = max(0, …)} de la vitrina ocultaría la corrupción.</li>
 *   <li><strong>Bloqueo pesimista</strong> (R2.3): la escritura lee la fila con
 *       el mismo {@code PESSIMISTIC_WRITE} que la reserva del checkout, sobre
 *       la misma fila.</li>
 *   <li><strong>Uppsert</strong> (R1.3): un SKU sin fila aparece en la matriz
 *       en {@code 0/0/0} y su primer guardado crea la fila — cierra la
 *       frontera 7.2 D9.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminStockService {

    private final StockItemRepository stockItemRepository;
    private final SkuRepository skuRepository;
    private final WarehouseRepository warehouseRepository;

    // ── Lectura ────────────────────────────────────────────────────────────

    /**
     * Matriz completa (R1): almacenes + todos los SKUs, con una celda por
     * almacén. Dos consultas con JOIN FETCH — sin N+1 (R1.2).
     */
    @Transactional(readOnly = true)
    public StockMatrixResponse getMatrix() {
        List<Warehouse> warehouses = warehouseRepository.findAll(Sort.by(Sort.Direction.ASC, "code"));
        List<Sku> skus = skuRepository.findAllWithProduct();

        Map<Long, Map<String, StockItem>> itemsBySku = new HashMap<>();
        for (StockItem item : stockItemRepository.findAllWithSkuAndWarehouseAndProduct()) {
            itemsBySku.computeIfAbsent(item.getSku().getId(), k -> new HashMap<>())
                    .put(item.getWarehouse().getCode(), item);
        }

        List<StockWarehouseResponse> columnas = warehouses.stream()
                .map(w -> new StockWarehouseResponse(w.getCode(), w.getName(), w.getCountryCode()))
                .toList();

        List<StockMatrixRowResponse> filas = skus.stream()
                .map(sku -> toRow(sku, warehouses,
                        itemsBySku.getOrDefault(sku.getId(), Map.of())))
                .toList();

        return new StockMatrixResponse(columnas, filas);
    }

    private StockMatrixRowResponse toRow(Sku sku, List<Warehouse> warehouses,
                                          Map<String, StockItem> items) {
        List<StockCellResponse> celdas = warehouses.stream()
                .map(w -> toCell(w.getCode(), items.get(w.getCode())))
                .toList();
        return new StockMatrixRowResponse(
                sku.getId(),
                sku.getProduct().getId(),
                sku.getProduct().getReferenceCode(),
                sku.getProduct().getName(),
                sku.getColor(),
                sku.getSize(),
                celdas);
    }

    private StockCellResponse toCell(String warehouseCode, StockItem item) {
        int disponible = item == null ? 0 : item.getQuantityAvailable();
        int reservado = item == null ? 0 : item.getQuantityReserved();
        return new StockCellResponse(warehouseCode, disponible, reservado,
                Math.max(0, disponible - reservado));
    }

    // ── Escritura ──────────────────────────────────────────────────────────

    /**
     * Fija el stock disponible de un SKU en un almacén (upsert, R1.3).
     * Devuelve la celda resultante para que la UI se actualice sin re-fetch.
     */
    @Transactional
    public StockCellResponse actualizarCelda(Long skuId, String warehouseCode,
                                             StockUpdateRequest request) {
        Sku sku = skuRepository.findById(skuId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "SKU no encontrado con id " + skuId));
        Warehouse warehouse = warehouseRepository.findByCode(warehouseCode)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Almacén no encontrado: " + warehouseCode));

        int disponible = request.quantityAvailable();

        Optional<StockItem> existente =
                stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(skuId, warehouseCode);

        StockItem item;
        if (existente.isPresent()) {
            item = existente.get();
            if (disponible < item.getQuantityReserved()) {
                throw new StockConflictException(
                        "No se puede fijar " + disponible + " unidades: hay "
                                + item.getQuantityReserved()
                                + " reservadas por pedidos en curso");
            }
            item.setQuantityAvailable(disponible);
        } else {
            // Fila nueva (SKU creado en la 7.2 sin stock): reservadas = 0,
            // y quantityAvailable ya es ≥ 0 por la validación del DTO.
            item = StockItem.builder()
                    .sku(sku)
                    .warehouse(warehouse)
                    .quantityAvailable(disponible)
                    .quantityReserved(0)
                    .build();
            try {
                stockItemRepository.saveAndFlush(item);
            } catch (DataIntegrityViolationException e) {
                // Carrera de doble insert sobre uk_sku_warehouse (R2.4):
                // 409, nunca 500 — la excepción propaga y la transacción
                // revierte completa.
                throw new StockConflictException(
                        "La celda de stock cambió a la vez; vuelve a intentarlo");
            }
        }

        log.info("Stock actualizado: sku={} almacén={} -> disponibles={}",
                skuId, warehouseCode, disponible);

        return new StockCellResponse(warehouseCode,
                item.getQuantityAvailable(), item.getQuantityReserved(),
                Math.max(0, item.getQuantityAvailable() - item.getQuantityReserved()));
    }
}
