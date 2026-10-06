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
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tarea 3.2, R7 — cobertura de precios por mercado.
 *
 * <p>Antes de V11 la semilla de V1 solo preció la talla M en ES, UK y CH:
 * elegir US o la talla L en UK/CH devolvía 404 en {@code /pricing} y un 400 en
 * el checkout. Este test comprueba tanto el resultado (la matriz queda completa)
 * como la propiedad que hace segura la migración en una BD ya poblada: que se
 * puede ejecutar dos veces sin duplicar filas.</p>
 */
@SpringBootTest
class MarketPriceSeedTest {

    private static final String V11_PATH = "db/migration/V11__complete_market_price_matrix.sql";

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("La matriz de precios queda completa: cada mercado tiene los 2 SKUs")
    void laMatrizDePreciosQuedaCompleta() throws Exception {
        // GIVEN / WHEN
        Map<String, Integer> porMercado = preciosPorMercado();

        // THEN
        assertThat(porMercado)
                .containsEntry("CH", 2)
                .containsEntry("ES", 2)
                .containsEntry("UK", 2)
                .containsEntry("US", 2);
    }

    @Test
    @DisplayName("V11 es idempotente: re-ejecutarla no duplica filas")
    void v11EsIdempotente() throws Exception {
        // GIVEN
        int antes = contarPrecios();

        // WHEN — la migración corre otra vez contra una BD ya poblada
        ejecutarV11();

        // THEN — uk_sku_market y el ON CONFLICT impiden el duplicado
        assertThat(contarPrecios()).isEqualTo(antes);
        assertThat(preciosPorMercado().values()).allMatch(n -> n == 2);
    }

    private int contarPrecios() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("SELECT count(*) FROM market_prices")) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private Map<String, Integer> preciosPorMercado() throws Exception {
        String sql = """
                SELECT m.code, count(*)
                FROM market_prices mp
                JOIN markets m ON m.id = mp.market_id
                GROUP BY m.code
                ORDER BY m.code
                """;
        Map<String, Integer> result = new LinkedHashMap<>();
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                result.put(rs.getString(1), rs.getInt(2));
            }
        }
        return result;
    }

    private void ejecutarV11() throws Exception {
        String sql;
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(V11_PATH)) {
            assertThat(in).as("La migración %s debe estar en el classpath", V11_PATH).isNotNull();
            sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
