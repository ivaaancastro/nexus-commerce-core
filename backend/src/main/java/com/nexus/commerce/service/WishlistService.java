package com.nexus.commerce.service;

import com.nexus.commerce.dto.WishlistItemResponse;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Favoritos del usuario autenticado (spec V3 wishlist, plan D1–D5/D13).
 *
 * <p>Reglas del dominio, medidas contra BD en {@code WishlistTransaccionalTest}:</p>
 * <ul>
 *   <li><strong>Una lista por usuario</strong>: get-or-create perezoso en el
 *       primer {@code POST}; el {@code GET} <strong>no escribe</strong> (D1).</li>
 *   <li><strong>Idempotencia amable, sin 409</strong>: repetir un guardado
 *       devuelve el ítem existente con {@code 200} y sin fila nueva; quitar
 *       algo ausente responde {@code 204} (D4).</li>
 *   <li><strong>Get-or-create serializado</strong>: las escrituras toman la
 *       fila del usuario con bloqueo pesimista (§4.2), así que dos pestañas
 *       a la vez no pueden crear dos listas — el {@code UNIQUE(user_id)} de
 *       la V18 es la última línea de defensa.</li>
 *   <li><strong>Sin importes</strong>: la respuesta lleva el
 *       {@code ProductResponse} de la vitrina; los precios se piden frescos a
 *       {@code /pricing} con el mercado activo (D13).</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final WishlistItemRepository wishlistItemRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CatalogService catalogService;

    /**
     * Resultado del guardado: {@code created} distingue el {@code 201} del
     * {@code 200} idempotente sin exponer el DTO interno del ítem.
     */
    public record AddResult(boolean created, WishlistItemResponse item) {}

    @Transactional(readOnly = true)
    public WishlistResponse getWishlist(String email) {
        User user = usuarioPorEmail(email);
        return wishlistRepository.findByUserIdWithItems(user.getId())
                .map(this::toResponse)
                .orElseGet(() -> new WishlistResponse(List.of()));
    }

    @Transactional
    public AddResult addItem(String email, Long productId) {
        User user = bloquearUsuario(email);
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));

        Wishlist wishlist = wishlistRepository.findByUserIdWithItems(user.getId())
                .orElseGet(() -> wishlistRepository.save(Wishlist.builder().user(user).build()));

        Optional<WishlistItem> existente = wishlist.getItems().stream()
                .filter(item -> item.getProduct().getId().equals(productId))
                .findFirst();
        if (existente.isPresent()) {
            // Ya estaba: 200 sin fila nueva (R3.2) — el UNIQUE de V18 nunca
            // llega a discutir porque lo comprobamos aquí con la fila tomada.
            return new AddResult(false, toItemResponse(existente.get()));
        }

        WishlistItem item = WishlistItem.builder()
                .wishlist(wishlist)
                .product(product)
                .addedAt(OffsetDateTime.now(ZoneOffset.UTC))
                .build();
        wishlist.getItems().add(item);
        // Persistimos el ÍTEM directamente, no en cascada desde la wishlist:
        // `save(wishlist)` sobre una lista ya persistida hace un `merge` que,
        // con un ítem nuevo, crea una COPIA y la instancia original se quedaría
        // con el id a `null` (medido en WishlistTransaccionalTest). El `save`
        // directo de una entidad nueva va a `persist` y con IDENTITY el id
        // queda en esta misma instancia para el `201`.
        wishlistItemRepository.save(item);
        return new AddResult(true, toItemResponse(item));
    }

    @Transactional
    public void removeItem(String email, Long productId) {
        User user = bloquearUsuario(email);
        wishlistRepository.findByUserIdWithItems(user.getId()).ifPresent(wishlist -> {
            boolean quitado = wishlist.getItems()
                    .removeIf(item -> item.getProduct().getId().equals(productId));
            if (quitado) {
                // orphanRemoval borra la fila de wishlist_items en el flush.
                wishlistRepository.save(wishlist);
            }
            // No quitado → 204 igual (idempotente, R3.3): nada que reportar.
        });
    }

    @Transactional
    public void clear(String email) {
        User user = bloquearUsuario(email);
        wishlistRepository.findByUserIdWithItems(user.getId()).ifPresent(wishlist -> {
            if (!wishlist.getItems().isEmpty()) {
                wishlist.getItems().clear();
                wishlistRepository.save(wishlist);
            }
        });
    }

    private WishlistResponse toResponse(Wishlist wishlist) {
        List<WishlistItemResponse> items = wishlist.getItems().stream()
                .sorted(Comparator.comparing(WishlistItem::getAddedAt).reversed())
                .map(this::toItemResponse)
                .toList();
        return new WishlistResponse(items);
    }

    /** Mismo {@code ProductResponse} de la vitrina (D5): mapper de {@code CatalogService}. */
    private WishlistItemResponse toItemResponse(WishlistItem item) {
        return new WishlistItemResponse(
                item.getId(),
                item.getAddedAt(),
                catalogService.mapToResponse(item.getProduct()));
    }

    /** Sólo lectura (GET): sin bloqueo — el bloqueo es de escritura. */
    private User usuarioPorEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
    }

    /** Escrituras: fila del usuario tomada para serializar el get-or-create (D1). */
    private User bloquearUsuario(String email) {
        return userRepository.findByEmailForUpdate(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
    }
}
