package com.nexus.commerce.repository;

import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @EntityGraph(attributePaths = {"items", "items.sku", "items.sku.product"})
    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = {"items", "items.sku", "items.sku.product"})
    Optional<Order> findByOrderNumber(String orderNumber);

    /**
     * Detalle de un pedido comprobando la propiedad en la propia consulta.
     * Devolver vacío cubre a la vez «no existe» y «es de otro usuario» → 404.
     * Sin paginación, así que el EntityGraph no trunca la colección.
     */
    @EntityGraph(attributePaths = {"items", "items.sku", "items.sku.product"})
    Optional<Order> findByUserIdAndOrderNumber(Long userId, String orderNumber);

    /**
     * Historial paginado. <strong>Sin</strong> EntityGraph: hacer fetch de una
     * colección junto a una paginación truncaría los items en el corte de página.
     * Los items se cargan en lote por {@code @BatchSize}, igual que cada
     * {@code sku} y su {@code product} (Tarea 5.5, plan §5.9).
     */
    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /**
     * Listado del panel (Tarea 7.4, R1): <strong>todos</strong> los pedidos, de
     * todos los usuarios (y con {@code user_id} NULL), ordenados por
     * {@code createdAt DESC}.
     *
     * <p>Filtros opcionales combinables — el {@code NULL} en el parámetro
     * desactiva esa rama, así que una sola query sirve para las 4 combinaciones
     * sin construir SQL dinámico.</p>
     *
     * <p>El {@code LEFT JOIN FETCH} de {@code user} es a una asociación
     * <em>to-one</em> que no multiplica filas, así que la paginación no se
     * trunca y el email viaja en la misma consulta (sin N+1 de cabeceras, R1.4);
     * el {@code countQuery} se escribe <strong>a mano sin FETCH</strong> porque
     * derivarlo de la query de filas dejaría el {@code JOIN FETCH} en el
     * recuento. Los items se resuelven por {@code @BatchSize} (mismo criterio
     * que el historial de usuario).</p>
     *
     * <p><strong>{@code CAST(:q AS string)} es obligatorio</strong>: con
     * {@code q = null} PostgreSQL recibe el parámetro sin tipar y resuelve
     * {@code lower(bytea)} → {@code function lower(bytea) does not exist}
     * aunque la rama del LIKE nunca se ejecute (PG compila igual el plan).</p>
     */
    @Query(value = """
            SELECT o FROM Order o
            LEFT JOIN FETCH o.user u
            WHERE (:status IS NULL OR o.status = :status)
              AND (:q IS NULL
                   OR LOWER(o.orderNumber) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            ORDER BY o.createdAt DESC
            """,
            countQuery = """
            SELECT count(o) FROM Order o
            LEFT JOIN o.user u
            WHERE (:status IS NULL OR o.status = :status)
              AND (:q IS NULL
                   OR LOWER(o.orderNumber) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    Page<Order> findAllForAdmin(@Param("status") OrderStatus status,
                                @Param("q") String q,
                                Pageable pageable);

    /**
     * Cambio de estado del panel (Tarea 7.4, R3): la fila del pedido se toma con
     * <strong>lock pesimista de escritura</strong> para serializar dos cambios
     * concurrentes — el segundo ve el estado ya aplicado y recibe el
     * {@code 409} de «mismo estado» en lugar de aplicar los efectos de stock dos
     * veces. Sin EntityGraph: los items se cargan por {@code @BatchSize} dentro
     * de la transacción.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.orderNumber = :orderNumber")
    Optional<Order> findByOrderNumberForUpdate(@Param("orderNumber") String orderNumber);

    /**
     * Dashboard 7.6 (R2): recuento de pedidos <strong>por estado</strong>
     * creados desde {@code from}. Sólo escalares — el service rellena las 5
     * claves con 0 donde no haya filas, para que {@code byStatus} no tenga
     * huecos (R4).
     *
     * @return pares {@code [estado, nº de pedidos]}
     */
    @Query("SELECT o.status, COUNT(o) FROM Order o WHERE o.createdAt >= :from GROUP BY o.status")
    List<Object[]> contarPedidosPorEstadoDesde(@Param("from") Instant from);

    /**
     * Dashboard 7.6 (R2): ingresos <strong>por moneda</strong> de los pedidos
     * <strong>no cancelados</strong> creados desde {@code from}. El filtro de
     * estado se pasa como parámetro (evita literales de enum en JPQL) y el
     * {@code ORDER BY currency} fija el orden de las filas (determinismo en
     * tests). <strong>Nunca se agrupan monedas distintas</strong>: el sistema
     * no tiene tipo de cambio (plan D3).
     *
     * <p>{@code SUM} sobre {@code total_amount NOT NULL} con al menos una fila
     * por grupo nunca devuelve {@code null}; por eso no hace falta
     * {@code COALESCE} (y el tipo de la suma queda {@code BigDecimal} limpio).</p>
     *
     * @param excluded estado que no suma — {@link OrderStatus#CANCELLED}
     * @return pares {@code [moneda, suma total, nº de pedidos]}
     */
    @Query("""
           SELECT o.currency, SUM(o.totalAmount), COUNT(o)
           FROM Order o
           WHERE o.createdAt >= :from AND o.status <> :excluded
           GROUP BY o.currency
           ORDER BY o.currency
           """)
    List<Object[]> contarIngresosPorMonedaDesde(@Param("from") Instant from,
                                                 @Param("excluded") OrderStatus excluded);
}
