package com.nexus.commerce.service;

import com.nexus.commerce.entity.Gender;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.entity.Wishlist;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.UserRepository;
import com.nexus.commerce.repository.WishlistRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <strong>Unicidad y cascade medidos, no supuestos</strong> (gates de la spec
 * §4): corre contra PostgreSQL real con el contexto entero, patrón
 * {@code EmailOutboxTransaccionalTest}.
 *
 * <p>Los datos son desechables y propios: usuario {@code wishlist-it@nexus.test}
 * e producto {@code IT-WISHLIST-1} se borran en cada pasada — jamás se toca el
 * catálogo sembrado (el E2E y el resto de la suite dependen de él).</p>
 */
@SpringBootTest
@DisplayName("V3 wishlist - unicidad y cascade contra PostgreSQL real")
class WishlistTransaccionalTest {

    private static final String EMAIL = "wishlist-it@nexus.test";
    private static final String REFERENCIA = "IT-WISHLIST-1";

    @Autowired
    private WishlistService service;

    @Autowired
    private WishlistRepository wishlistRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    private User usuario;
    private Product producto;

    @BeforeEach
    void preparar() {
        limpiar();
        usuario = userRepository.save(User.builder()
                .email(EMAIL)
                .passwordHash("$2a$12$placeholderplaceholderplaceholderplaceholderplac")
                .firstName("Wish")
                .lastName("List")
                .birthDate(LocalDate.of(1990, 1, 1))
                .gender(Gender.OTHER)
                .emailVerified(true)
                .build());
        producto = productRepository.save(Product.builder()
                .referenceCode(REFERENCIA)
                .name("Producto de prueba wishlist")
                .family("Pruebas")
                .build());
    }

    @AfterEach
    void desmontar() {
        limpiar();
    }

    /** Borra producto (cascade limpia los ítems) y usuario (cascade limpia la lista). */
    private void limpiar() {
        productRepository.findByReferenceCode(REFERENCIA).ifPresent(productRepository::delete);
        userRepository.findByEmail(EMAIL).ifPresent(userRepository::delete);
        productRepository.flush();
        userRepository.flush();
    }

    @Test
    @DisplayName("Guardar el mismo producto dos veces - UNA sola fila en BD (el UNIQUE manda)")
    void agregarDosVecesCreaUnaSolaFila() {
        // GIVEN una lista inexistente
        var primero = service.addItem(EMAIL, producto.getId());

        // WHEN se vuelve a guardar el mismo producto (doble clic, dos pestañas)
        var segundo = service.addItem(EMAIL, producto.getId());

        // THEN el primero crea (201) y el segundo sirve el existente (200)
        assertThat(primero.created()).isTrue();
        assertThat(segundo.created()).isFalse();
        assertThat(segundo.item().id()).isEqualTo(primero.item().id());

        // AND en BD hay exactamente UN favorito
        Wishlist recargada = wishlistRepository.findByUserIdWithItems(usuario.getId())
                .orElseThrow(() -> new IllegalStateException("El add debió crear la lista"));
        assertThat(recargada.getItems()).hasSize(1);
    }

    @Test
    @DisplayName("GET de un usuario sin lista - items vacío y SIN crear fila (lectura pura)")
    void getNoCreaFila() {
        // WHEN
        var respuesta = service.getWishlist(EMAIL);

        // THEN
        assertThat(respuesta.items()).isEmpty();
        assertThat(wishlistRepository.findByUserIdWithItems(usuario.getId()))
                .as("el GET no debe crear la fila de la wishlist")
                .isEmpty();
    }

    @Test
    @DisplayName("Borrar el producto desde el catálogo - el cascade limpia los favoritos (sin fantasmas)")
    void borrarProductoLimpiaLosFavoritos() {
        // GIVEN un favorito guardado
        service.addItem(EMAIL, producto.getId());
        assertThat(service.getWishlist(EMAIL).items()).hasSize(1);

        // WHEN el operador borra el producto (7.2)
        productRepository.delete(producto);
        productRepository.flush();

        // THEN la lista queda sin el ítem y el GET no devuelve fantasmas
        assertThat(service.getWishlist(EMAIL).items()).isEmpty();
    }

    @Test
    @DisplayName("Quitar y vaciar contra BD - idempotentes de verdad (204 sin drama)")
    void quitarYVaciarSonIdempotentes() {
        // GIVEN un favorito
        service.addItem(EMAIL, producto.getId());

        // WHEN se quita dos veces
        service.removeItem(EMAIL, producto.getId());
        service.removeItem(EMAIL, producto.getId());

        // THEN la lista queda vacía y vaciar otra vez tampoco estorba
        assertThat(service.getWishlist(EMAIL).items()).isEmpty();
        service.clear(EMAIL);
        service.clear(EMAIL);
        assertThat(service.getWishlist(EMAIL).items()).isEmpty();
    }
}
