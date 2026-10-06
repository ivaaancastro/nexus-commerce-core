package com.nexus.commerce.controller;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 3.1, R1 y R2 — familias y filtros del catálogo.
 *
 * <p>Es de integración y no {@code standaloneSetup} porque hay tres cosas que
 * sólo se demuestran contra la base de datos real y la cadena de seguridad real:</p>
 *
 * <ul>
 *   <li>la <strong>semántica SKU estricta</strong> vive dentro de un subconsulta
 *       {@code EXISTS} en JPQL — un mock no puede comprobarla;</li>
 *   <li>la <strong>no-regresión</strong> sin parámetros y la ausencia de
 *       duplicados con {@code DISTINCT + JOIN FETCH} sólo se ven con datos reales;</li>
 *   <li>«accesible sin sesión» exige pasar por el filtro de Spring Security.</li>
 * </ul>
 *
 * <p>Cada test limpia su propio dato. El caso trampa de R2 no puede apoyarse en
 * el {@code rollback} de {@code @Transactional}: el {@code INSERT} se hace con
 * {@code dataSource.getConnection()}, que abre una conexión <strong>fuera</strong>
 * de la transacción del test y por tanto se confirma sola — por eso la limpieza
 * es explícita en {@code @AfterEach} y corre aunque el test falle.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class ProductCatalogFilterTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DataSource dataSource;

    /**
     * Borra el producto trampa por si el test que lo crea no llegó a terminar.
     * Los SKUs caen con él por el {@code ON DELETE CASCADE} de {@code skus}.
     */
    @AfterEach
    void limpiarProductoTrampa() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM products WHERE reference_code = 'TRAMP/001'");
        }
    }

    @Test
    @DisplayName("R1 - GET /families devuelve cada familia con su número de productos, ordenado")
    void lasFamiliasDevuelvenSuRecuentoOrdenado() throws Exception {
        mockMvc.perform(get("/api/v1/products/families"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].family").value("FOOTWEAR"))
                .andExpect(jsonPath("$[0].productCount").value(1))
                .andExpect(jsonPath("$[1].family").value("KNITWEAR"))
                .andExpect(jsonPath("$[1].productCount").value(1))
                // OUTERWEAR cuenta productos, no SKUs: Blazer + Abrigo = 2
                .andExpect(jsonPath("$[2].family").value("OUTERWEAR"))
                .andExpect(jsonPath("$[2].productCount").value(2));
    }

    @Test
    @DisplayName("R1 - GET /families es público para anónimos")
    void elEndpointDeFamiliasEsPublico() throws Exception {
        // Control: si la seguridad estuviera desactivada, /orders también daría 200
        // y este test no demostraría nada.
        mockMvc.perform(get("/api/v1/orders"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/products/families"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    @DisplayName("R2 - Sin parámetros devuelve el catálogo completo y sin duplicados")
    void sinParametrosDevuelveTodoElCatalogo() throws Exception {
        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                // 4 productos reales. Si DISTINCT + fetch de skus duplicara filas,
                // el Blazer (2 SKUs) y la Zapatilla (2 SKUs) aparecerían dos veces y
                // esta cifra saltaría a 6.
                .andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    @DisplayName("R2 - La respuesta es una lista, no un envoltorio paginado")
    void laRespuestaNoSePagina() throws Exception {
        // Si la respuesta fuera un objeto Page tendría 'content'/'totalElements'
        // y $[0] no existiría.
        mockMvc.perform(get("/api/v1/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].referenceCode").exists())
                .andExpect(jsonPath("$.content").doesNotExist())
                .andExpect(jsonPath("$.totalElements").doesNotExist());
    }

    @Test
    @DisplayName("R2 - family devuelve sólo productos de esa familia")
    void filtraPorFamilia() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("family", "OUTERWEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].family").value("OUTERWEAR"))
                .andExpect(jsonPath("$[1].family").value("OUTERWEAR"));
    }

    @Test
    @DisplayName("R2 - size devuelve los productos que tienen esa talla")
    void filtraPorTalla() throws Exception {
        // Blazer (M), Abrigo (M) y Zapatilla (M); el Jersey sólo tiene L
        mockMvc.perform(get("/api/v1/products").param("size", "M"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    @DisplayName("R2 - color devuelve los productos de ese color")
    void filtraPorColor() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("color", "Camel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].referenceCode").value("0611/018"));
    }

    @Test
    @DisplayName("R2 - family y size se combinan con AND")
    void combinaFamiliaYTallaConY() throws Exception {
        // OUTERWEAR y M: Blazer y Abrigo. Sin el AND, size=M daría 3.
        mockMvc.perform(get("/api/v1/products")
                        .param("family", "OUTERWEAR")
                        .param("size", "M"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].family").value("OUTERWEAR"))
                .andExpect(jsonPath("$[1].family").value("OUTERWEAR"));
    }

    /**
     * El requisito central de R2.
     *
     * <p>Si la consulta usara dos subconsultas {@code EXISTS} independientes,
     * este producto temporal pasaría el filtro: tiene un SKU en talla M (Camel) y
     * <em>otro</em> SKU en color Negro (talla L), pero <strong>nunca</strong> un
     * SKU que sea Negro <em>y</em> M — es decir, no se puede comprar con esa
     * selección y no debe enseñarse.</p>
     */
    @Test
    @DisplayName("R2 - size y color se exigen sobre el MISMO SKU (caso trampa)")
    void tallaYColorSeExigenEnElMismoSku() throws Exception {
        // GIVEN un producto con dos SKUs: (Camel, M) y (Negro, L)
        sembrarProductoTrampa();

        // Control 1: sí tiene un SKU en talla M
        mockMvc.perform(get("/api/v1/products").param("size", "M"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].referenceCode").value(hasItem("TRAMP/001")));

        // Control 2: sí tiene un SKU en color Negro
        mockMvc.perform(get("/api/v1/products").param("color", "Negro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].referenceCode").value(hasItem("TRAMP/001")));

        // THEN juntos, sobre el mismo SKU, no aparece
        mockMvc.perform(get("/api/v1/products")
                        .param("size", "M")
                        .param("color", "Negro"))
                .andExpect(status().isOk())
                // Sí aparece la Zapatilla, que sí tiene un SKU (Negro, M)
                .andExpect(jsonPath("$[*].referenceCode").value(hasItem("1240/007")))
                .andExpect(jsonPath("$[*].referenceCode").value(not(hasItem("TRAMP/001"))));
    }

    @Test
    @DisplayName("R2 - sort ordena por nombre ascendente y descendente")
    void ordenaPorNombre() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("sort", "name-asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Abrigo Lana Oversize"))
                .andExpect(jsonPath("$[3].name").value("Zapatilla Piel Minimal"));

        mockMvc.perform(get("/api/v1/products").param("sort", "name-desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Zapatilla Piel Minimal"))
                .andExpect(jsonPath("$[3].name").value("Abrigo Lana Oversize"));
    }

    @Test
    @DisplayName("R2 - sort desconocido responde 400 con estructura de error")
    void sortDesconocidoDevuelve400() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("sort", "precio"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("R2 - family desconocida responde 200 con lista vacía, no 400")
    void familyDesconocidaDevuelve200Vacio() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("family", "NOEXISTE")
                        .param("size", "XL")
                        .param("color", "Rosa"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("R2 - Los parámetros en blanco se tratan como sin filtro")
    void parametrosEnBlancoNoFiltran() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("family", "")
                        .param("sort", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));
    }

    /** Crea el producto de dos colores que hace observable la semántica estricta. */
    private void sembrarProductoTrampa() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    INSERT INTO products (reference_code, name, description, family)
                    VALUES ('TRAMP/001', 'Producto Trampa Semantica', 'Dos SKUs con colores distintos.', 'OUTERWEAR')
                    """);
            statement.execute("""
                    INSERT INTO skus (product_id, barcode, color, size)
                    SELECT id, 'TRAMP001M', 'Camel', 'M' FROM products WHERE reference_code = 'TRAMP/001'
                    """);
            statement.execute("""
                    INSERT INTO skus (product_id, barcode, color, size)
                    SELECT id, 'TRAMP001L', 'Negro', 'L' FROM products WHERE reference_code = 'TRAMP/001'
                    """);
        }
    }
}
