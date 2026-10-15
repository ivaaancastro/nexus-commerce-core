package com.nexus.commerce.service;

import com.nexus.commerce.dto.StockUpdateRequest;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.StockItem;
import com.nexus.commerce.entity.Warehouse;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.exception.StockConflictException;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.StockItemRepository;
import com.nexus.commerce.repository.WarehouseRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tarea 7.3 (spec R2) — los caminos que la integración <em>no</em> puede
 * provocar de forma determinista: la <strong>carrera de doble insert</strong>
 * sobre {@code uk_sku_warehouse} (dos PUTs simultáneos sobre una celda
 * inexistente). Si la restricción UNIQUE gana, el servicio debe traducirlo a
 * {@code 409} — <strong>nunca un 500</strong> (R2.4).
 *
 * <p>Se mockea el repositorio porque provocar la violación real exigiría dos
 * transacciones compitiendo (no determinista en CI), mismo criterio que
 * {@code AdminProductServiceTest}.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Tarea 7.3 - AdminStockService: guarda de reservadas y carrera de upsert")
class AdminStockServiceTest {

    @Mock private StockItemRepository stockItemRepository;
    @Mock private SkuRepository skuRepository;
    @Mock private WarehouseRepository warehouseRepository;

    @InjectMocks private AdminStockService service;

    private Sku sku() {
        return Sku.builder().id(1L).color("Marino").size("M").build();
    }

    private Warehouse warehouse() {
        return Warehouse.builder().id(1L).code("WH_ARTEIXO").name("Sabón").build();
    }

    @Test
    @DisplayName("R2.2 - disponible por debajo de las reservadas -> StockConflictException con las unidades")
    void disponibleMenorQueReservado409() {
        // GIVEN — fila existente con 5 reservadas
        when(skuRepository.findById(1L)).thenReturn(Optional.of(sku()));
        when(warehouseRepository.findByCode("WH_ARTEIXO")).thenReturn(Optional.of(warehouse()));
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.of(StockItem.builder()
                        .sku(sku()).warehouse(warehouse())
                        .quantityAvailable(10).quantityReserved(5)
                        .build()));

        // WHEN / THEN — fijar 4 (< 5) choca con el invariant
        assertThatThrownBy(() -> service.actualizarCelda(1L, "WH_ARTEIXO",
                new StockUpdateRequest(4)))
                .isInstanceOf(StockConflictException.class)
                .hasMessageContaining("5 reservadas");
    }

    @Test
    @DisplayName("R2.4 - carrera de doble insert -> StockConflictException, nunca un 500")
    void carreraDeDobleInsert409() {
        // GIVEN — la celda no existe aún y la restricción UNIQUE gana la carrera
        when(skuRepository.findById(1L)).thenReturn(Optional.of(sku()));
        when(warehouseRepository.findByCode("WH_ARTEIXO")).thenReturn(Optional.of(warehouse()));
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.empty());
        when(stockItemRepository.saveAndFlush(any(StockItem.class)))
                .thenThrow(new DataIntegrityViolationException("uk_sku_warehouse"));

        // WHEN / THEN — se traduce a conflicto (el 409 lo da el handler)
        assertThatThrownBy(() -> service.actualizarCelda(1L, "WH_ARTEIXO",
                new StockUpdateRequest(12)))
                .isInstanceOf(StockConflictException.class);
    }

    @Test
    @DisplayName("R2 - en el límite (disponible == reservadas) la escritura pasa y el neto es 0")
    void disponibleIgualAReservadoNetoCero() {
        // GIVEN — fila con 5 reservadas y 10 disponibles
        StockItem item = StockItem.builder()
                .sku(sku()).warehouse(warehouse())
                .quantityAvailable(10).quantityReserved(5)
                .build();
        when(skuRepository.findById(1L)).thenReturn(Optional.of(sku()));
        when(warehouseRepository.findByCode("WH_ARTEIXO")).thenReturn(Optional.of(warehouse()));
        when(stockItemRepository.findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO"))
                .thenReturn(Optional.of(item));

        // WHEN — fijar exactamente 5 (el límite permitido)
        var celda = service.actualizarCelda(1L, "WH_ARTEIXO", new StockUpdateRequest(5));

        // THEN — la celda refleja el neto 0 y la fila quedó en 5
        assertThat(celda.quantityAvailable()).isEqualTo(5);
        assertThat(celda.quantityReserved()).isEqualTo(5);
        assertThat(celda.netAvailable()).isZero();
        assertThat(item.getQuantityAvailable()).isEqualTo(5);
        verify(stockItemRepository).findBySkuIdAndWarehouseCodeForUpdate(1L, "WH_ARTEIXO");
    }

    @Test
    @DisplayName("R2.5 - SKU o almacén desconocidos -> ResourceNotFoundException (404)")
    void desconocidos404() {
        when(skuRepository.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.actualizarCelda(1L, "WH_ARTEIXO",
                new StockUpdateRequest(10)))
                .isInstanceOf(ResourceNotFoundException.class);

        when(skuRepository.findById(2L)).thenReturn(Optional.of(sku()));
        when(warehouseRepository.findByCode("WH_INVENTO")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.actualizarCelda(2L, "WH_INVENTO",
                new StockUpdateRequest(10)))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
