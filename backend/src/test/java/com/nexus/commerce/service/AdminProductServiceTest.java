package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductCreateRequest;
import com.nexus.commerce.dto.ProductUpdateRequest;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.exception.CatalogConflictException;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.SkuRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tarea 7.2 (spec R2.3, R3) — las rutas que la integración <em>no</em> puede
 * provocar: la <strong>carrera</strong> entre la guarda previa y la escritura
 * real (R3.4). Si la restricción UNIQUE de BD o la FK de {@code order_items}
 * ganan la partida, el servicio debe traducirlo a {@code 409} — <strong>nunca
 * un {@code 500}</strong>.
 *
 * <p>Se mockea el repositorio porque provocar una violación real exigiría
 * dos transacciones compitiendo (no determinista en CI).</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Tarea 7.2 - AdminProductService: guardas de unicidad, borrado y carreras")
class AdminProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private SkuRepository skuRepository;

    @InjectMocks
    private AdminProductService service;

    private Product producto() {
        return Product.builder()
                .id(1L)
                .referenceCode("7201/001")
                .name("Blazer Prueba 72")
                .family("OUTERWEAR")
                .build();
    }

    // ── Unicidad ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("R2.3 - referencia duplicada: 409 ANTES de escribir")
    void referenciaDuplicada409AntesDeEscribir() {
        // GIVEN — la referencia ya existe
        when(productRepository.existsByReferenceCode("7201/001")).thenReturn(true);

        // WHEN / THEN — 409 y ni se intenta el INSERT
        assertThatThrownBy(() -> service.crear(
                new ProductCreateRequest("7201/001", "Blazer", "OUTERWEAR", null)))
                .isInstanceOf(CatalogConflictException.class)
                .hasMessageContaining("Ya existe un producto");

        verify(productRepository, never()).saveAndFlush(any(Product.class));
    }

    @Test
    @DisplayName("R3.4 - carrera de unicidad: la restricción UNIQUE gana -> 409, jamás 500")
    void carreraDeUnicidadEs409() {
        // GIVEN — la comprobación previa no la vio (dos paneles a la vez)
        when(productRepository.existsByReferenceCode("7201/001")).thenReturn(false);
        when(productRepository.saveAndFlush(any(Product.class)))
                .thenThrow(new DataIntegrityViolationException("uk_products_reference_code"));

        // WHEN / THEN — la violación de BD se traduce en conflicto de catálogo
        assertThatThrownBy(() -> service.crear(
                new ProductCreateRequest("7201/001", "Blazer", "OUTERWEAR", null)))
                .isInstanceOf(CatalogConflictException.class)
                .hasMessageContaining("Ya existe un producto");
    }

    // ── Borrado ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("R3.1 - sin pedidos: borra y fuerza el flush de las cascadas")
    void borrarSinPedidosElimina() {
        // GIVEN
        when(productRepository.findWithSkusById(1L)).thenReturn(Optional.of(producto()));
        when(productRepository.tienePedidos(1L)).thenReturn(false);

        // WHEN / THEN — sin conflicto, y el flush obliga a comprobar la FK
        // dentro de la transacción (y no en el commit, donde ya no habría catch)
        assertThatCode(() -> service.borrar(1L)).doesNotThrowAnyException();

        verify(productRepository).delete(any(Product.class));
        verify(productRepository).flush();
    }

    @Test
    @DisplayName("R3.2 - con pedidos: 409 y NO se llega a borrar")
    void borrarConPedidos409SinBorrar() {
        // GIVEN — el producto tiene pedidos
        when(productRepository.findWithSkusById(1L)).thenReturn(Optional.of(producto()));
        when(productRepository.tienePedidos(1L)).thenReturn(true);

        // WHEN / THEN
        assertThatThrownBy(() -> service.borrar(1L))
                .isInstanceOf(CatalogConflictException.class)
                .hasMessageContaining("tiene pedidos");

        verify(productRepository, never()).delete(any(Product.class));
    }

    @Test
    @DisplayName("R3.4 - carrera de borrado: la FK de order_items gana -> 409, jamás 500")
    void carreraDeBorradoEs409() {
        // GIVEN — la guarda no vio el pedido (llegó entre la guarda y el DELETE)
        when(productRepository.findWithSkusById(1L)).thenReturn(Optional.of(producto()));
        when(productRepository.tienePedidos(1L)).thenReturn(false);
        doThrow(new DataIntegrityViolationException("fk_order_items_sku"))
                .when(productRepository).flush();

        // WHEN / THEN
        assertThatThrownBy(() -> service.borrar(1L))
                .isInstanceOf(CatalogConflictException.class)
                .hasMessageContaining("tiene pedidos");
    }

    // ── SKU ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("R3.3 - SKU con pedidos: 409 y NO se llega a borrar")
    void borrarSkuConPedidos409() {
        // GIVEN — el SKU pertenece al producto 1 (borrarSku sólo toca SkuRepository)
        Sku sku = Sku.builder().id(5L).barcode("720100000001")
                .color("Marino").size("M").product(producto()).build();
        when(skuRepository.findById(5L)).thenReturn(Optional.of(sku));
        when(skuRepository.tienePedidos(5L)).thenReturn(true);

        // WHEN / THEN
        assertThatThrownBy(() -> service.borrarSku(1L, 5L))
                .isInstanceOf(CatalogConflictException.class)
                .hasMessageContaining("tiene pedidos");

        verify(skuRepository, never()).delete(any(Sku.class));
    }

    // ── Actualización ──────────────────────────────────────────────────────

    @Test
    @DisplayName("R2.4 - actualizar no toca la referencia: el DTO no la trae")
    void actualizarSinTocarReferencia() {
        // GIVEN
        when(productRepository.findWithSkusById(1L)).thenReturn(Optional.of(producto()));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));

        // WHEN — el DTO sólo puede llevar nombre, familia y descripción
        var respuesta = service.actualizar(1L,
                new ProductUpdateRequest("Blazer Nuevo", "KNITWEAR", "Desc"));

        // THEN — la referencia sigue intacta
        org.assertj.core.api.Assertions.assertThat(respuesta.referenceCode()).isEqualTo("7201/001");
        org.assertj.core.api.Assertions.assertThat(respuesta.name()).isEqualTo("Blazer Nuevo");
        org.assertj.core.api.Assertions.assertThat(respuesta.family()).isEqualTo("KNITWEAR");
    }
}
