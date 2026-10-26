package com.nexus.commerce.service;

import com.nexus.commerce.dto.ProductResponse;
import com.nexus.commerce.dto.WishlistResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.entity.Wishlist;
import com.nexus.commerce.entity.WishlistItem;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.UserRepository;
import com.nexus.commerce.repository.WishlistItemRepository;
import com.nexus.commerce.repository.WishlistRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unitarios del servicio de favoritos (spec V3 wishlist, plan D1/D2/D4).
 *
 * <p>La unicidad REAL y el cascade se miden contra PostgreSQL en
 * {@code WishlistTransaccionalTest}; aquí sólo la lógica: get-or-create,
 * idempotencia amable (sin 409), orden por {@code addedAt} DESC y el bloqueo
 * de la fila de usuario en las escrituras (§4.2).</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("V3 wishlist - servicio: una lista por usuario, idempotencia amable")
class WishlistServiceTest {

    private static final String EMAIL = "ana@example.com";
    private static final OffsetDateTime T1 = OffsetDateTime.parse("2026-10-26T10:00:00Z");
    private static final OffsetDateTime T2 = OffsetDateTime.parse("2026-10-26T11:00:00Z");

    @Mock
    private WishlistRepository wishlistRepository;

    @Mock
    private WishlistItemRepository wishlistItemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CatalogService catalogService;

    @InjectMocks
    private WishlistService service;

    private User usuario() {
        return User.builder().id(1L).email(EMAIL).build();
    }

    private Product producto(long id) {
        return Product.builder().id(id).referenceCode("0432/021")
                .name("Blazer Cruzada").family("Blazers").build();
    }

    private WishlistItem item(long id, long productId, OffsetDateTime addedAt) {
        return WishlistItem.builder().id(id).product(producto(productId)).addedAt(addedAt).build();
    }

    private Wishlist listaCon(long id, WishlistItem... items) {
        Wishlist wishlist = Wishlist.builder().id(id).user(usuario()).build();
        wishlist.getItems().addAll(List.of(items));
        return wishlist;
    }

    private ProductResponse fichaDe(long productId) {
        return new ProductResponse(productId, "0432/021", "Blazer Cruzada",
                null, "Blazers", List.of(), null);
    }

    // ── GET ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET sin lista propia - devuelve items vacío y NO escribe (el lectura no crea filas)")
    void getSinFilaDevuelveVacioSinEscribir() {
        // GIVEN
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(usuario()));
        when(wishlistRepository.findByUserIdWithItems(1L)).thenReturn(Optional.empty());

        // WHEN
        WishlistResponse respuesta = service.getWishlist(EMAIL);

        // THEN
        assertThat(respuesta.items()).isEmpty();
        verify(wishlistRepository, never()).save(any());
        verify(wishlistRepository, never()).saveAndFlush(any());
        // El GET no toma bloqueo: sólo las escrituras lo piden.
        verify(userRepository, never()).findByEmailForUpdate(EMAIL);
    }

    @Test
    @DisplayName("GET con artículos - los devuelve ordenados por addedAt DESC, más reciente primero")
    void getOrdenaMasRecientePrimero() {
        // GIVEN - item antiguo (T1) y reciente (T2) metidos en orden «al revés»
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(usuario()));
        when(wishlistRepository.findByUserIdWithItems(1L)).thenReturn(
                Optional.of(listaCon(9L, item(11L, 5L, T1), item(12L, 6L, T2))));
        when(catalogService.mapToResponse(any(Product.class)))
                .thenAnswer(llamada -> fichaDe(((Product) llamada.getArgument(0)).getId()));

        // WHEN
        WishlistResponse respuesta = service.getWishlist(EMAIL);

        // THEN
        assertThat(respuesta.items())
                .extracting(item -> item.product().id())
                .containsExactly(6L, 5L);
        assertThat(respuesta.items().get(0).addedAt()).isEqualTo(T2);
    }

    // ── POST ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("ADD sin lista - crea la wishlist y el ítem (created = 201)")
    void addSinListaLaCrea() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(productRepository.findById(5L)).thenReturn(Optional.of(producto(5L)));
        when(wishlistRepository.findByUserIdWithItems(1L)).thenReturn(Optional.empty());
        when(catalogService.mapToResponse(any(Product.class)))
                .thenAnswer(llamada -> fichaDe(((Product) llamada.getArgument(0)).getId()));
        when(wishlistRepository.save(any(Wishlist.class)))
                .thenAnswer(llamada -> {
                    Wishlist wishlist = llamada.getArgument(0);
                    wishlist.setId(9L);
                    return wishlist;
                });

        // WHEN
        WishlistService.AddResult resultado = service.addItem(EMAIL, 5L);

        // THEN
        assertThat(resultado.created()).isTrue();
        assertThat(resultado.item().product().id()).isEqualTo(5L);
        assertThat(resultado.item().addedAt()).isNotNull();
        // El ítem se persiste directamente (no en cascada): el id del 201 sale aquí
        verify(wishlistItemRepository).save(any(WishlistItem.class));
    }

    @Test
    @DisplayName("ADD con lista previa - añade el ítem sin crear una segunda lista")
    void addConListaPreviaAnadeElItem() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(productRepository.findById(5L)).thenReturn(Optional.of(producto(5L)));
        when(wishlistRepository.findByUserIdWithItems(1L))
                .thenReturn(Optional.of(listaCon(9L)));
        when(catalogService.mapToResponse(any(Product.class)))
                .thenAnswer(llamada -> fichaDe(((Product) llamada.getArgument(0)).getId()));

        // WHEN
        WishlistService.AddResult resultado = service.addItem(EMAIL, 5L);

        // THEN
        assertThat(resultado.created()).isTrue();
        assertThat(resultado.item().product().id()).isEqualTo(5L);
        verify(wishlistRepository, never()).save(any(Wishlist.class));
        verify(wishlistItemRepository).save(any(WishlistItem.class));
    }

    @Test
    @DisplayName("ADD repetido - sirve el existente sin fila nueva (idempotente, nunca 409)")
    void addRepetidoNoCreaFila() {
        // GIVEN - el producto 5 ya está guardado a las 10:00
        WishlistItem previo = item(11L, 5L, T1);
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(productRepository.findById(5L)).thenReturn(Optional.of(producto(5L)));
        when(wishlistRepository.findByUserIdWithItems(1L))
                .thenReturn(Optional.of(listaCon(9L, previo)));

        // WHEN
        WishlistService.AddResult resultado = service.addItem(EMAIL, 5L);

        // THEN - responde el mismo ítem (200) y no toca la BD
        assertThat(resultado.created()).isFalse();
        assertThat(resultado.item().id()).isEqualTo(11L);
        assertThat(resultado.item().addedAt()).isEqualTo(T1);
        verify(wishlistItemRepository, never()).save(any(WishlistItem.class));
    }

    @Test
    @DisplayName("ADD de un producto inexistente - ResourceNotFoundException (404) sin tocar la lista")
    void addProductoInexistente404() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        // WHEN / THEN
        assertThatThrownBy(() -> service.addItem(EMAIL, 999L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Producto no encontrado");
        verify(wishlistItemRepository, never()).save(any(WishlistItem.class));
    }

    @Test
    @DisplayName("ADD con un token cuyo usuario no existe - IllegalArgumentException (patrón AddressService)")
    void addUsuarioDesconocido() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.empty());

        // WHEN / THEN
        assertThatThrownBy(() -> service.addItem(EMAIL, 5L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("QUITAR un artículo presente - lo borra (orphanRemoval) y guarda la lista")
    void removeQuitaYGuarda() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(wishlistRepository.findByUserIdWithItems(1L)).thenReturn(
                Optional.of(listaCon(9L, item(11L, 5L, T1), item(12L, 6L, T2))));

        // WHEN
        service.removeItem(EMAIL, 5L);

        // THEN
        verify(wishlistRepository).save(any(Wishlist.class));
    }

    @Test
    @DisplayName("QUITAR un artículo ausente - 204 igual (idempotente) y nada que guardar")
    void removeAusenteNoGuarda() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(wishlistRepository.findByUserIdWithItems(1L))
                .thenReturn(Optional.of(listaCon(9L, item(12L, 6L, T2))));

        // WHEN
        service.removeItem(EMAIL, 5L);

        // THEN
        verify(wishlistRepository, never()).save(any(Wishlist.class));
    }

    @Test
    @DisplayName("QUITAR sin lista propia - no falla (no hay nada que quitar)")
    void removeSinListaNoFalla() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(wishlistRepository.findByUserIdWithItems(1L)).thenReturn(Optional.empty());

        // WHEN / THEN - no lanza y no escribe
        service.removeItem(EMAIL, 5L);
        verify(wishlistRepository, never()).save(any(Wishlist.class));
    }

    // ── DELETE (vaciar) ────────────────────────────────────────────────────

    @Test
    @DisplayName("VACIAR - borra todos los ítems y conserva la fila de la lista")
    void clearVaciaLaLista() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(wishlistRepository.findByUserIdWithItems(1L)).thenReturn(
                Optional.of(listaCon(9L, item(11L, 5L, T1), item(12L, 6L, T2))));

        // WHEN
        service.clear(EMAIL);

        // THEN - la fila de wishlist NO se borra, sólo sus ítems
        verify(wishlistRepository).save(any(Wishlist.class));
        verify(wishlistRepository, never()).delete(any(Wishlist.class));
    }

    @Test
    @DisplayName("VACIAR una lista ya vacía - no escribe")
    void clearEnListaVaciaNoGuarda() {
        // GIVEN
        when(userRepository.findByEmailForUpdate(EMAIL)).thenReturn(Optional.of(usuario()));
        when(wishlistRepository.findByUserIdWithItems(1L))
                .thenReturn(Optional.of(listaCon(9L)));

        // WHEN
        service.clear(EMAIL);

        // THEN
        verify(wishlistRepository, never()).save(any(Wishlist.class));
    }
}
