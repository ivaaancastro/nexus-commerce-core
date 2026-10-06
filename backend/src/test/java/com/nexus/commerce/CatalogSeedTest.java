package com.nexus.commerce;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tarea 3.1, R8 — semilla de catálogo de {@code V12}.
 *
 * <p>{@code V12} añade 3 productos (uno por cada familia que el propio comentario
 * de V1 ya declaraba) para que el menú de familias y los filtros tengan con qué
 * trabajar. Este test comprueba tres propiedades:</p>
 *
 * <ol>
 *   <li><strong>Idempotencia</strong>: re-ejecutar la migración no duplica filas.
 *       Todos sus {@code INSERT} resuelven por clave natural
 *       ({@code reference_code}, {@code barcode}) y llevan {@code ON CONFLICT}.</li>
 *   <li><strong>Matriz de precios completa</strong>: cada SKU tiene precio en los
 *       4 mercados. Es la lección de V11 — allí faltaban 5 celdas y devolvía
 *       404/400.</li>
 *   <li><strong>Presencia de las 3 familias</strong> del dominio.</li>
 * </ol>
 *
 * <p>Ninguna aserción fija un recuento total de productos o de SKUs. Es
 * deliberado: el equivalente en {@code MarketPriceSeedTest} fijó {@code 2} y
 * dejó de funcionar en cuanto creció el catálogo, aunque la matriz siguiera
 * perfectamente completa. Aquí todo se expresa como <em>propiedad</em>
 * («todos los SKUs tienen 4 mercados», «las 3 familias existen»), que sigue
 * siendo cierta cuando se añadan productos.</p>
 */
@SpringBootTest
class CatalogSeedTest {

    private static final String V12_PATH = "db/migration/V12__catalog_navigation_seed.sql";

    /** Los 4 mercados que siembra V1 y que V12 debe cubrir. */
    private static final int MERCADOS = 4;

    private static final String[] FAMILIAS_DEL_DOMINIO = {"OUTERWEAR", "KNITWEAR", "FOOTWEAR"};

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("V12 es idempotente: re-ejecutarla no duplica ninguna fila")
    void v12EsIdempotente() throws Exception {
        // GIVEN
        int[] antes = contarFilas();

        // WHEN — la migración corre otra vez contra una BD ya poblada
        ejecutarV12();

        // THEN
        assertThat(contarFilas())
                .as("Re-ejecutar V12 no debe tocar productos, SKUs, precios ni stock")
                .isEqualTo(antes);
    }

    @Test
    @DisplayName("Cada SKU tiene precio en los 4 mercados (matriz completa)")
    void cadaSkuTienePrecioEnLosCuatroMercados() throws Exception {
        String sql = """
                SELECT count(*) FROM (
                    SELECT s.id
                    FROM skus s
                    LEFT JOIN market_prices mp ON mp.sku_id = s.id
                    GROUP BY s.id
                    HAVING count(DISTINCT mp.market_id) = %d
                ) skus_completos
                """.formatted(MERCADOS);

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            rs.next();
            int completos = rs.getInt(1);

            assertThat(completos)
                    .as("Todos los SKUs deben estar preciados en los %d mercados", MERCADOS)
                    .isEqualTo(contar("skus"));
        }
    }

    @Test
    @DisplayName("Las 3 familias del dominio tienen al menos un producto")
    void lasTresFamiliasDelDominioTienenProducto() throws Exception {
        String sql = """
                SELECT count(DISTINCT family) FROM products
                WHERE family IN ('OUTERWEAR', 'KNITWEAR', 'FOOTWEAR')
                """;

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            rs.next();
            assertThat(rs.getInt(1))
                    .as("Familias presentes: %s", String.join(", ", FAMILIAS_DEL_DOMINIO))
                    .isEqualTo(FAMILIAS_DEL_DOMINIO.length);
        }
    }

    /**
     * La comprobación literal de «desde una BD vacía hay 4 productos».
     *
     * <p>Se expresa como <em>presencia de las 4 referencias</em> y no como
     * {@code count(*) == 4} por la misma razón de siempre: un recuento fijo
     * acopla el test a los datos actuales y falla en cuanto otra migración añada
     * catálogo, aunque esta migración siga siendo correcta. Lo que V12 debe
     * garantizar es que <strong>sus</strong> 3 productos están — el de V1,
     * {@code 0432/021}, viene de una migración anterior.</p>
     */
    @Test
    @DisplayName("V12 siembra sus 3 productos: el catálogo inicial son 4 referencias")
    void v12AnadeSusTresProductos() throws Exception {
        String sql = """
                SELECT count(*) FROM products
                WHERE reference_code IN ('0432/021', '0611/018', '0815/004', '1240/007')
                """;

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            rs.next();
            assertThat(rs.getInt(1))
                    .as("Blazer (V1) + Abrigo, Jersey y Zapatilla (V12)")
                    .isEqualTo(4);
        }
    }

    @Test
    @DisplayName("El índice sobre family existe para que el GROUP BY no escanee la tabla")
    void elIndiceDeFamiliaExiste() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     "SELECT count(*) FROM pg_indexes WHERE tablename = 'products' AND indexname = 'idx_products_family'")) {
            rs.next();
            assertThat(rs.getInt(1)).isEqualTo(1);
        }
    }

    private int[] contarFilas() throws Exception {
        return new int[]{
                contar("products"),
                contar("skus"),
                contar("market_prices"),
                contar("stock_items")
        };
    }

    private int contar(String tabla) throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("SELECT count(*) FROM " + tabla)) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private void ejecutarV12() throws Exception {
        String sql;
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(V12_PATH)) {
            assertThat(in).as("La migración %s debe estar en el classpath", V12_PATH).isNotNull();
            sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
