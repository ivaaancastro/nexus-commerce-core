package com.nexus.commerce.service;

import com.nexus.commerce.dto.*;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.exception.CatalogConflictException;
import com.nexus.commerce.exception.ResourceNotFoundException;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.SkuRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * CRUD de catálogo para el panel de administración (Tarea 7.2,
 * spec specs/admin-product-crud/).
 *
 * <p>Sólo se invoca desde {@code AdminProductController}, bajo
 * {@code /api/v1/admin/products} — la protección {@code hasRole("ADMIN")} la
 * aplica {@code SecurityConfig} (la regla heredada de la 7.1), no este servicio.</p>
 *
 * <p>Reglas de negocio:</p>
 * <ul>
 *   <li><strong>Inmutabilidad</strong> (R2.4): ni la referencia del producto ni
 *       el código de barras del SKU cambian nunca — los DTOs de actualización
 *       ni siquiera los traen.</li>
 *   <li><strong>Borrado con guarda</strong> (R3): lo que alguien compró no se
 *       borra; devuelve {@code CatalogConflictException} (409) y no se borra
 *       nada. La carrera con un pedido simultáneo también es 409, jamás un 500
 *       por violación de FK.</li>
 *   <li><strong>Frontera con la 7.3</strong> (R5): crear un SKU no genera
 *       {@code market_prices} ni {@code stock_items}; precio y stock los pone
 *       la tarea 7.3.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminProductService {

    private final ProductRepository productRepository;
    private final SkuRepository skuRepository;

    // ── Productos ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProductResponse> listar() {
        return productRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse obtener(Long id) {
        return toResponse(buscarProducto(id));
    }

    @Transactional
    public ProductResponse crear(ProductCreateRequest request) {
        if (productRepository.existsByReferenceCode(request.referenceCode())) {
            throw new CatalogConflictException(
                    "Ya existe un producto con la referencia " + request.referenceCode());
        }

        Product product = Product.builder()
                .referenceCode(request.referenceCode())
                .name(request.name())
                .family(request.family())
                .description(normalizarDescripcion(request.description()))
                .build();

        try {
            productRepository.saveAndFlush(product);
        } catch (DataIntegrityViolationException e) {
            // Carrera contra otra escritura: la restricción UNIQUE de BD manda.
            throw new CatalogConflictException(
                    "Ya existe un producto con la referencia " + request.referenceCode());
        }

        log.info("Producto creado desde el panel: {} (id={})",
                product.getReferenceCode(), product.getId());
        return toResponse(product);
    }

    @Transactional
    public ProductResponse actualizar(Long id, ProductUpdateRequest request) {
        Product product = buscarProducto(id);
        product.setName(request.name());
        product.setFamily(request.family());
        product.setDescription(normalizarDescripcion(request.description()));
        // referenceCode no se toca: no viene en el DTO (R2.4).
        return toResponse(productRepository.save(product));
    }

    @Transactional
    public void borrar(Long id) {
        Product product = buscarProducto(id);
        String referencia = product.getReferenceCode();

        if (productRepository.tienePedidos(id)) {
            throw new CatalogConflictException(
                    "No se puede borrar el producto " + referencia + ": tiene pedidos asociados");
        }

        try {
            // Borra en cascada los SKUs; los precios y el stock los recoge la
            // BD (ON DELETE CASCADE). El flush obliga a que la FK de order_items
            // se comprueme aquí y no en el commit, para poder traducir la carrera.
            productRepository.delete(product);
            productRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new CatalogConflictException(
                    "No se puede borrar el producto " + referencia + ": tiene pedidos asociados");
        }

        log.info("Producto borrado desde el panel: {}", referencia);
    }

    // ── SKUs (variantes) ───────────────────────────────────────────────────

    @Transactional
    public SkuResponse crearSku(Long productId, SkuCreateRequest request) {
        Product product = buscarProducto(productId);

        if (skuRepository.existsByBarcode(request.barcode())) {
            throw new CatalogConflictException(
                    "Ya existe un SKU con el código de barras " + request.barcode());
        }

        Sku sku = Sku.builder()
                .product(product)
                .barcode(request.barcode())
                .color(request.color())
                .size(request.size())
                .build();

        try {
            skuRepository.saveAndFlush(sku);
        } catch (DataIntegrityViolationException e) {
            throw new CatalogConflictException(
                    "Ya existe un SKU con el código de barras " + request.barcode());
        }

        // Sin market_prices ni stock_items: frontera explícita con la 7.3 (R5.1).
        log.info("SKU creado desde el panel: {} del producto {}",
                sku.getBarcode(), product.getReferenceCode());
        return toResponse(sku);
    }

    @Transactional
    public SkuResponse actualizarSku(Long productId, Long skuId, SkuUpdateRequest request) {
        Sku sku = buscarSku(productId, skuId);
        sku.setColor(request.color());
        sku.setSize(request.size());
        // barcode no se toca: no viene en el DTO (R2.4).
        return toResponse(skuRepository.save(sku));
    }

    @Transactional
    public void borrarSku(Long productId, Long skuId) {
        Sku sku = buscarSku(productId, skuId);

        if (skuRepository.tienePedidos(skuId)) {
            throw new CatalogConflictException(
                    "No se puede borrar el SKU " + sku.getBarcode() + ": tiene pedidos asociados");
        }

        try {
            skuRepository.delete(sku);
            skuRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new CatalogConflictException(
                    "No se puede borrar el SKU " + sku.getBarcode() + ": tiene pedidos asociados");
        }

        log.info("SKU borrado desde el panel: {}", sku.getBarcode());
    }

    // ── Internos ───────────────────────────────────────────────────────────

    private Product buscarProducto(Long id) {
        return productRepository.findWithSkusById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Producto no encontrado con id " + id));
    }

    /** Un SKU de otro producto responde 404, no 403 — sin filtrar su existencia. */
    private Sku buscarSku(Long productId, Long skuId) {
        return skuRepository.findById(skuId)
                .filter(sku -> sku.getProduct().getId().equals(productId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "SKU no encontrado con id " + skuId));
    }

    private String normalizarDescripcion(String descripcion) {
        return (descripcion == null || descripcion.isBlank()) ? null : descripcion.trim();
    }

    private ProductResponse toResponse(Product product) {
        List<SkuResponse> skus = product.getSkus().stream()
                .map(this::toResponse)
                .toList();
        return new ProductResponse(
                product.getId(),
                product.getReferenceCode(),
                product.getName(),
                product.getDescription(),
                product.getFamily(),
                skus);
    }

    private SkuResponse toResponse(Sku sku) {
        return new SkuResponse(
                sku.getId(),
                sku.getBarcode(),
                sku.getColor(),
                sku.getSize());
    }
}
