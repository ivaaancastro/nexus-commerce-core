package com.nexus.commerce.service;

import com.nexus.commerce.dto.ReserveStockRequest;
import com.nexus.commerce.dto.StockReservationResponse;
import com.nexus.commerce.dto.StockResponse;
import com.nexus.commerce.entity.StockItem;
import com.nexus.commerce.entity.Warehouse;
import com.nexus.commerce.exception.InsufficientStockException;
import com.nexus.commerce.repository.StockItemRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock
    private StockItemRepository stockItemRepository;

    @InjectMocks
    private InventoryService inventoryService;

    @Test
    @DisplayName("Debe reservar stock correctamente cuando hay existencias suficientes")
    void shouldReserveStockSuccessfullyWhenAvailable() {
        // GIVEN: Un almacén con 100 disponibles y 10 reservadas (90 netas vendibles)
        Warehouse warehouse = Warehouse.builder().code("WH_ARTEIXO").build();
        StockItem stockItem = StockItem.builder()
                .quantityAvailable(100)
                .quantityReserved(10)
                .warehouse(warehouse)
                .build();

        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.of(stockItem));

        ReserveStockRequest request = new ReserveStockRequest(1L, "WH_ARTEIXO", 20);

        // WHEN: Se solicitan 20 unidades
        StockReservationResponse response = inventoryService.reserveStock(request);

        // THEN: La reserva se confirma y el nuevo remanente neto es 70
        assertThat(response.status()).isEqualTo("RESERVED");
        assertThat(response.reservedQuantity()).isEqualTo(20);
        assertThat(response.remainingAvailable()).isEqualTo(70);
        assertThat(stockItem.getQuantityReserved()).isEqualTo(30);

        verify(stockItemRepository, times(1)).save(stockItem);
    }

    @Test
    @DisplayName("Debe lanzar InsufficientStockException si se solicitan más unidades de las netas disponibles")
    void shouldThrowExceptionWhenStockIsInsufficient() {
        // GIVEN: Solo 5 unidades netas disponibles (10 disponibles - 5 reservadas)
        Warehouse warehouse = Warehouse.builder().code("WH_ARTEIXO").build();
        StockItem stockItem = StockItem.builder()
                .quantityAvailable(10)
                .quantityReserved(5)
                .warehouse(warehouse)
                .build();

        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.of(stockItem));

        ReserveStockRequest request = new ReserveStockRequest(1L, "WH_ARTEIXO", 10);

        // WHEN / THEN: Se intentan reservar 10 unidades
        assertThatThrownBy(() -> inventoryService.reserveStock(request))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessageContaining("Stock insuficiente en WH_ARTEIXO");

        verify(stockItemRepository, never()).save(any());
    }

    @Test
    @DisplayName("Debe agregar el stock omnicanal correctamente y calcular el total disponible")
    void shouldReturnAggregatedStockBreakdownForSku() {
        // GIVEN: Dos almacenes (Sabón con 145 netas, Zaragoza con 80 netas -> Total 225)
        Warehouse sabon = Warehouse.builder().code("WH_ARTEIXO").name("Sabón").countryCode("ES").build();
        Warehouse zaragoza = Warehouse.builder().code("WH_ZARAGOZA").name("Zaragoza").countryCode("ES").build();

        StockItem item1 = StockItem.builder()
                .warehouse(sabon)
                .quantityAvailable(150)
                .quantityReserved(5)
                .build();

        StockItem item2 = StockItem.builder()
                .warehouse(zaragoza)
                .quantityAvailable(80)
                .quantityReserved(0)
                .build();

        when(stockItemRepository.findBySkuIdWithWarehouse(1L)).thenReturn(List.of(item1, item2));

        // WHEN
        StockResponse response = inventoryService.getStockBySku(1L);

        // THEN
        assertThat(response.skuId()).isEqualTo(1L);
        assertThat(response.totalAvailable()).isEqualTo(225);
        assertThat(response.inStock()).isTrue();
        assertThat(response.breakdown()).hasSize(2);
        assertThat(response.breakdown().getFirst().netAvailable()).isEqualTo(145);
        assertThat(response.breakdown().get(1).netAvailable()).isEqualTo(80);

        verify(stockItemRepository, times(1)).findBySkuIdWithWarehouse(1L);
    }

    // ── Tarea 7.4 (spec admin-orders, R4): efectos de stock al cancelar/enviar ──

    @Test
    @DisplayName("7.4/R4.1 - liberar reserva al cancelar baja quantity_reserved exactamente la cantidad")
    void releaseReservedStockRestaLaReserva() {
        // GIVEN: fila con 10 disponibles y 4 reservadas (la reserva de este pedido)
        StockItem stockItem = StockItem.builder()
                .quantityAvailable(10)
                .quantityReserved(4)
                .build();
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.of(stockItem));

        // WHEN: se libera la reserva de 4 unidades
        inventoryService.releaseReservedStock(1L, "WH_ARTEIXO", 4);

        // THEN: reservadas a 0, disponibles intactos (cancelar no toca el disponible)
        assertThat(stockItem.getQuantityReserved()).isZero();
        assertThat(stockItem.getQuantityAvailable()).isEqualTo(10);
        verify(stockItemRepository, times(1)).save(stockItem);
    }

    @Test
    @DisplayName("7.4/R4.2 - liberar más de lo reservado queda en 0, nunca negativo")
    void releaseReservedStockNuncaDejaNegativo() {
        // GIVEN: fila con la reserva ya en 0 (los E2E restauran stock a V1)
        StockItem stockItem = StockItem.builder()
                .quantityAvailable(10)
                .quantityReserved(0)
                .build();
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.of(stockItem));

        // WHEN / THEN: liberar 3 no puede hundir la reserva por debajo de cero
        inventoryService.releaseReservedStock(1L, "WH_ARTEIXO", 3);
        assertThat(stockItem.getQuantityReserved()).isZero();
    }

    @Test
    @DisplayName("7.4/R4.2 - fila de stock ausente al cancelar: se salta con warn, sin excepción")
    void releaseReservedStockFilaAusenteNoFalla() {
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ZARAGOZA"))
                .thenReturn(Optional.empty());

        // WHEN / THEN: la cancelación nunca queda bloqueada por un hueco de inventario
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                () -> inventoryService.releaseReservedStock(1L, "WH_ZARAGOZA", 2));
        verify(stockItemRepository, never()).save(any());
    }

    @Test
    @DisplayName("7.4/R4.3 - enviar descuenta disponible y consume la reserva (el neto no cambia)")
    void shipStockDescuentaYConsumeReserva() {
        // GIVEN: 10 disponibles con 3 reservadas de este pedido
        StockItem stockItem = StockItem.builder()
                .quantityAvailable(10)
                .quantityReserved(3)
                .build();
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.of(stockItem));

        // WHEN: salen 3 unidades del almacén
        inventoryService.shipStock(1L, "WH_ARTEIXO", 3);

        // THEN: disponibles 7, reservadas 0 — el neto baja exactamente 3
        assertThat(stockItem.getQuantityAvailable()).isEqualTo(7);
        assertThat(stockItem.getQuantityReserved()).isZero();
        verify(stockItemRepository, times(1)).save(stockItem);
    }

    @Test
    @DisplayName("7.4/R4.4 - enviar con disponible insuficiente -> StockConflictException, sin tocar la fila")
    void shipStockInsuficienteLanzaConflicto() {
        StockItem stockItem = StockItem.builder()
                .quantityAvailable(2)
                .quantityReserved(0)
                .build();
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.of(stockItem));

        // WHEN / THEN: 4 no caben en 2 disponibles -> 409 y rollback del estado
        assertThatThrownBy(() -> inventoryService.shipStock(1L, "WH_ARTEIXO", 4))
                .isInstanceOf(com.nexus.commerce.exception.StockConflictException.class)
                .hasMessageContaining("sólo quedan 2");
        assertThat(stockItem.getQuantityAvailable()).isEqualTo(2);
        verify(stockItemRepository, never()).save(any());
    }

    @Test
    @DisplayName("7.4/R4.4 - enviar sin fila de stock -> StockConflictException (no un NPE ni un 500)")
    void shipStockFilaAusenteLanzaConflicto() {
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(9L, "WH_ZARAGOZA"))
                .thenReturn(Optional.empty());

        // WHEN / THEN
        assertThatThrownBy(() -> inventoryService.shipStock(9L, "WH_ZARAGOZA", 1))
                .isInstanceOf(com.nexus.commerce.exception.StockConflictException.class)
                .hasMessageContaining("falta la fila de stock");
        verify(stockItemRepository, never()).save(any());
    }
}