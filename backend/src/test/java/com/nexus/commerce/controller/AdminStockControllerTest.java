package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.entity.StockItem;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.StockItemRepository;
import com.nexus.commerce.repository.WarehouseRepository;
import com.nexus.commerce.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 7.3 (spec specs/admin-stock-pricing/, R1–R2) — matriz de stock bajo
 * {@code /api/v1/admin/stock}.
 *
 * <p><strong>BD compartida limpia (tasks C.5)</strong>: mismo criterio que
 * {@code AdminProductControllerTest} — sin {@code @Transactional} de clase,
 * datos de prueba con clave fija ({@code 7301/001}) y borrado en
 * {@code @Before} <em>y</em> {@code @After} (cascada SKU → stock). Las
 * filas <strong>sembradas</strong> nunca se modifican: los PUTs con éxito
 * sólo tocan el SKU de prueba, y la guarda 409 se provoca sobre una fila
 * propia creada en el test (determinista en cualquier entorno).</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Tarea 7.3 - Matriz de stock en la zona admin")
class AdminStockControllerTest {

    private static final String BASE = "/api/v1/admin/stock";
    private static final String REF_PRUEBA = "7301/001";
    private static final String BARCODE_PRUEBA = "730100000001";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private ProductRepository productRepository;
    @Autowired private SkuRepository skuRepository;
    @Autowired private StockItemRepository stockItemRepository;
    @Autowired private WarehouseRepository warehouseRepository;

    private String adminToken;
    private long skuPrueba;

    @BeforeEach
    void preparar() throws Exception {
        limpiar();
        adminToken = jwtService.generateToken(999L, "admin-stock@nexus.test", Role.ADMIN);
        long productoId = crearProducto();
        skuPrueba = crearSku(productoId);
    }

    @AfterEach
    void limpiar() {
        productRepository.findByReferenceCode(REF_PRUEBA).ifPresent(productRepository::delete);
        productRepository.flush();
    }

    // ── R1: la matriz ──────────────────────────────────────────────────────

    @Test
    @DisplayName("C.1 - GET devuelve almacenes ordenados y TODOS los SKUs (11 filas = 10 sembrados + 1 de prueba)")
    void matrizCompleta() throws Exception {
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.warehouses.length()").value(2))
                .andExpect(jsonPath("$.warehouses[0].code").value("WH_ARTEIXO"))
                .andExpect(jsonPath("$.warehouses[0].name").isNotEmpty())
                .andExpect(jsonPath("$.warehouses[0].countryCode").value("ES"))
                .andExpect(jsonPath("$.warehouses[1].code").value("WH_ZARAGOZA"))
                .andExpect(jsonPath("$.rows.length()").value(11))
                // Orden por referenceCode: el catálogo sembrado va primero…
                .andExpect(jsonPath("$.rows[0].referenceCode").value("0432/021"))
                .andExpect(jsonPath("$.rows[0].skuId").isNumber())
                .andExpect(jsonPath("$.rows[0].productId").isNumber())
                // …y el de prueba (7301/…) al final, con celdas por almacén
                .andExpect(jsonPath("$.rows[10].referenceCode").value(REF_PRUEBA))
                .andExpect(jsonPath("$.rows[10].color").value("Marino"))
                .andExpect(jsonPath("$.rows[10].size").value("M"))
                .andExpect(jsonPath("$.rows[10].cells.length()").value(2));
    }

    @Test
    @DisplayName("C.1 - SKU sin stock_items aparece con celdas 0/0/0: cierra la frontera 7.2 D9")
    void skuSinStockApareceEnCeros() throws Exception {
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[10].skuId").value(skuPrueba))
                .andExpect(jsonPath("$.rows[10].cells[0].warehouseCode").value("WH_ARTEIXO"))
                .andExpect(jsonPath("$.rows[10].cells[0].quantityAvailable").value(0))
                .andExpect(jsonPath("$.rows[10].cells[0].quantityReserved").value(0))
                .andExpect(jsonPath("$.rows[10].cells[0].netAvailable").value(0))
                .andExpect(jsonPath("$.rows[10].cells[1].warehouseCode").value("WH_ZARAGOZA"))
                .andExpect(jsonPath("$.rows[10].cells[1].netAvailable").value(0));
    }

    // ── R2: escritura con guarda ───────────────────────────────────────────

    @Test
    @DisplayName("C.2 - PUT crea la fila (upsert), ignora quantityReserved del body y la matriz lo refleja")
    void putCreaFilaYActualiza() throws Exception {
        // WHEN — crear en WH_ARTEIXO (el body intenta traer reserved: se ignora, R1.4)
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/WH_ARTEIXO")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityAvailable\":12,\"quantityReserved\":99}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.warehouseCode").value("WH_ARTEIXO"))
                .andExpect(jsonPath("$.quantityAvailable").value(12))
                .andExpect(jsonPath("$.quantityReserved").value(0))
                .andExpect(jsonPath("$.netAvailable").value(12));

        // THEN — la matriz lo ve, y el otro almacén sigue en 0
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[10].cells[0].quantityAvailable").value(12))
                .andExpect(jsonPath("$.rows[10].cells[0].quantityReserved").value(0))
                .andExpect(jsonPath("$.rows[10].cells[1].quantityAvailable").value(0));

        // WHEN — segunda escritura: actualiza la misma fila
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/WH_ARTEIXO")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityAvailable\":7}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantityAvailable").value(7))
                .andExpect(jsonPath("$.netAvailable").value(7));
    }

    @Test
    @DisplayName("C.2 - 409 STOCK_CONFLICT si el disponible queda por debajo de las reservadas (R2.2)")
    void putDebajoDeReservadas409() throws Exception {
        // GIVEN — una fila mía con 3 reservadas (semilla determinista del test)
        var warehouse = warehouseRepository.findByCode("WH_ZARAGOZA").orElseThrow();
        var sku = skuRepository.findById(skuPrueba).orElseThrow();
        stockItemRepository.save(StockItem.builder()
                .sku(sku)
                .warehouse(warehouse)
                .quantityAvailable(5)
                .quantityReserved(3)
                .build());
        stockItemRepository.flush();

        // WHEN — fijar 2 (< 3 reservadas)
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/WH_ZARAGOZA")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityAvailable\":2}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STOCK_CONFLICT"))
                .andExpect(jsonPath("$.message", containsString("3 reservadas")));

        // THEN — exactamente en el límite (== reservadas) es válido: net 0
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/WH_ZARAGOZA")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityAvailable\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantityAvailable").value(3))
                .andExpect(jsonPath("$.quantityReserved").value(3))
                .andExpect(jsonPath("$.netAvailable").value(0));
    }

    @Test
    @DisplayName("C.2 - 400 si el cuerpo no valida: negativo, nulo o ausente (R2.1)")
    void putValidacion400() throws Exception {
        mockMvc.perform(put(BASE + "/" + skuPrueba + "/WH_ARTEIXO")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityAvailable\":-1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());

        mockMvc.perform(put(BASE + "/" + skuPrueba + "/WH_ARTEIXO")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityAvailable\":null}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put(BASE + "/" + skuPrueba + "/WH_ARTEIXO")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("C.2 - 404 para SKU o almacén desconocidos, sin tocar nada (R2.5)")
    void put404() throws Exception {
        mockMvc.perform(put(BASE + "/999999/WH_ARTEIXO")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityAvailable\":10}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(BASE + "/" + skuPrueba + "/WH_INVENTO")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityAvailable\":10}"))
                .andExpect(status().isNotFound());
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private long crearProducto() throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/v1/admin/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"" + REF_PRUEBA + "\",\"name\":\"Blazer Prueba 73\","
                                + "\"family\":\"OUTERWEAR\",\"description\":\"Producto de prueba 7.3\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    private long crearSku(long productoId) throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/v1/admin/products/" + productoId + "/skus")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barcode\":\"" + BARCODE_PRUEBA + "\",\"color\":\"Marino\",\"size\":\"M\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    private long leerId(MvcResult resultado) throws Exception {
        return objectMapper.readTree(
                        resultado.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .get("id").asLong();
    }
}
