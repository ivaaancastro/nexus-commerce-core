package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Product;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    // Resuelve el problema N+1 cargando las variantes (skus) en una sola consulta JOIN
    @EntityGraph(attributePaths = {"skus"})
    Optional<Product> findByReferenceCode(String referenceCode);

    @EntityGraph(attributePaths = {"skus"})
    Optional<Product> findWithSkusById(Long id);

    @EntityGraph(attributePaths = {"skus"})
    List<Product> findAll();

    /**
     * Taxonomía del catálogo: cada familia con su número de productos (Tarea 3.1, R1).
     *
     * <p>Se agrupa en base de datos y no en el cliente — la portada y el menú se
     * pintan de esta respuesta. Se cuenta {@code Product}, nunca {@code Sku}: una
     * familia con un producto de dos tallas es «1», no «2».</p>
     *
     * <p>Se devuelve como pares en bruto y no como {@code Map} porque Spring Data
     * JPA no acepta un mapa como tipo de retorno de un {@code @Query} de varias
     * filas: interpreta el método como una consulta de resultado único y lanza
     * {@code IncorrectResultSizeDataAccessException} en cuanto hay más de una
     * familia. Tampoco se usa expresión de constructor, porque {@code COUNT}
     * devuelve {@code long} y el registro de la spec declara {@code int} — el
     * estrechamiento no puede resolverse en la instanciación dinámica. El mapeo
     * queda concentrado en {@code CatalogService#listarFamilias()}.</p>
     *
     * <p>El índice {@code idx_products_family} (V12) evita escanear la tabla
     * entera en el {@code GROUP BY}.</p>
     *
     * @return pares {@code [familia, número de productos]}
     */
    @Query("SELECT p.family, COUNT(p) FROM Product p GROUP BY p.family")
    List<Object[]> contarProductosPorFamilia();

    /**
     * Consulta derivada sin {@code @Query}: resuelve a
     * {@code SELECT count(*) > 0 FROM products p WHERE p.family = ?} y aprovecha
     * {@code idx_products_family}.
     *
     * <p>Existe para poder <strong>validar</strong> el parámetro {@code family} de
     * la búsqueda semántica antes de meterlo dentro de una expresión de filtro —
     * ver {@code ProductSearchService}.</p>
     */
    boolean existsByFamily(String family);

    /**
     * Filtros de catálogo (Tarea 3.1, R2).
     *
     * <p>Los tres parámetros son opcionales y se combinan con <strong>AND</strong>.
     * Cualquiera de ellos puede venir {@code null}, que significa «sin filtro».</p>
     *
     * <p><strong>Semántica SKU estricta</strong>: {@code size} y {@code color} se
     * evalúan <em>dentro del mismo subconsulta {@code EXISTS}</em>, de modo que un
     * producto sólo pasa si existe <strong>un único SKU que cumpla todos los
     * criterios a la vez</strong>. Es intencional que no sean dos {@code EXISTS}
     * independientes — con {@code size=M&color=Negro}, dos {@code EXISTS}
     * separados aceptarían un producto cuyo SKU en M fuese Marino y el de color
     * Negro fuese talla L, es decir, uno que <em>no se puede comprar</em> con la
     * selección hecha.</p>
     *
     * <p>{@code ORDER BY p.id} fija el orden por defecto (inserción) para que
     * {@code sort=default} sea determinista; los órdenes por nombre se aplican
     * después, en el servicio.</p>
     */
    @EntityGraph(attributePaths = {"skus"})
    @Query("""
            SELECT DISTINCT p FROM Product p
            WHERE (:family IS NULL OR p.family = :family)
              AND ( (:size IS NULL AND :color IS NULL)
                    OR EXISTS (SELECT 1 FROM Sku s
                               WHERE s.product = p
                                 AND (:size IS NULL OR s.size = :size)
                                 AND (:color IS NULL OR s.color = :color)) )
            ORDER BY p.id
            """)
    List<Product> buscarConFiltros(@Param("family") String family,
                                   @Param("size") String size,
                                   @Param("color") String color);
}
