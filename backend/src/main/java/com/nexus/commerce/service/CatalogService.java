package com.nexus.commerce.service;

import com.nexus.commerce.dto.FamilyResponse;
import com.nexus.commerce.dto.ProductResponse;
import com.nexus.commerce.dto.ProductSortOption;
import com.nexus.commerce.dto.SkuResponse;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {

    private final ProductRepository productRepository;

    /**
     * Taxonomía del catálogo con el recuento de productos por familia (Tarea 3.1, R1).
     *
     * <p>Orden alfabético y no el que devuelva la base de datos: el menú de la
     * portada y el de la sección deben pintarse siempre en el mismo orden, aunque
     * cambie el plan de consulta del {@code GROUP BY}.</p>
     */
    public List<FamilyResponse> listarFamilias() {
        return productRepository.contarProductosPorFamilia()
                .stream()
                .map(fila -> new FamilyResponse((String) fila[0], Math.toIntExact((Long) fila[1])))
                .sorted(Comparator.comparing(FamilyResponse::family))
                .toList();
    }

    /**
     * Listado de catálogo con los filtros opcionales de la Tarea 3.1 (R2).
     *
     * <p>El orden se resuelve aquí y no en la consulta: el {@code ORDER BY}
     * condicional en JPQL obliga a escribir un {@code CASE} por opción y deja el
     * orden por defecto sin definir en base de datos. Aplicarlo en memoria sobre
     * una lista pequeña es más legible y, al ser {@code sorted()} estable de
     * Java, los empates por nombre conservan el orden de inserción que ya fija
     * la consulta.</p>
     *
     * <p>{@code sort} se valida <strong>antes</strong> de tocar la base de datos,
     * para que un valor inválido falle con 400 sin llegar a consultar.</p>
     *
     * @param family familia exacta o {@code null}; en blanco se trata como sin filtro
     * @param size   talla de SKU o {@code null}
     * @param color  color de SKU o {@code null}
     * @param sort   orden canónico o {@code null} para el orden por defecto
     * @throws IllegalArgumentException si {@code sort} no corresponde a ningún orden
     */
    public List<ProductResponse> listarProductos(String family, String size, String color, String sort) {
        ProductSortOption orden = ProductSortOption.from(sort);

        List<ProductResponse> productos = productRepository
                .buscarConFiltros(normalizar(family), normalizar(size), normalizar(color))
                .stream()
                .map(this::mapToResponse)
                .toList();

        if (orden == ProductSortOption.DEFAULT) {
            return productos;
        }

        Comparator<ProductResponse> porNombre =
                Comparator.comparing(ProductResponse::name, String.CASE_INSENSITIVE_ORDER);

        return productos.stream()
                .sorted(orden == ProductSortOption.NAME_ASC ? porNombre : porNombre.reversed())
                .toList();
    }

    /** Un parámetro en blanco significa «sin filtro», no una familia vacía. */
    private String normalizar(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor.trim();
    }

    public Optional<ProductResponse> getProductByReference(String referenceCode) {
        return productRepository.findByReferenceCode(referenceCode)
                .map(this::mapToResponse);
    }

    private ProductResponse mapToResponse(Product product) {
        List<SkuResponse> skuResponses = product.getSkus().stream()
                .map(this::mapSkuToResponse)
                .toList();

        return new ProductResponse(
                product.getId(),
                product.getReferenceCode(),
                product.getName(),
                product.getDescription(),
                product.getFamily(),
                skuResponses
        );
    }

    private SkuResponse mapSkuToResponse(Sku sku) {
        return new SkuResponse(
                sku.getId(),
                sku.getBarcode(),
                sku.getColor(),
                sku.getSize()
        );
    }
}