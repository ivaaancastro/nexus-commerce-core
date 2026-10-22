package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.entity.*;
import com.nexus.commerce.repository.*;
import com.nexus.commerce.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.hamcrest.Matchers.hasItem;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 7.2 (spec specs/admin-product-crud/, R1–R5) — CRUD de catálogo bajo
 * {@code /api/v1/admin/products}.
 *
 * <p><strong>BD compartida limpia (tasks C.6)</strong>: la clase corre sobre el
 * PostgreSQL real de desarrollo <em>sin</em> {@code @Transactional} de clase —
 * cada petición MockMvc es su propia transacción (si una lanza una excepción de
 * negocio, no deja marcada la transacción de la siguiente). Por eso los datos
 * de prueba se crean con claves fijas ({@code 7201/…}, {@code TEST-72-…}) y se
 * borran en {@code @Before} <em>y</em> {@code @After}: una ejecución abortada
 * no deja restos para {@code CatalogSeedTest} ni para los E2E.</p>
 *
 * <p>El token ADMIN se mintea con el {@code JwtService} real (mismo patrón que
 * {@code SecurityRulesTest}): el filtro sólo valida firma y claims.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Tarea 7.2 - CRUD de productos y SKUs en la zona admin")
class AdminProductControllerTest {

    private static final String BASE = "/api/v1/admin/products";
    private static final String REF_PRUEBA = "7201/001";
    private static final String REF_PRUEBA_B = "7201/002";
    private static final String REF_SEMBRADA = "0432/021";
    private static final String BARCODE_PRUEBA = "720100000001";
    private static final String IDEM_PEDIDO_A = "TEST-72-IDEM-A";
    private static final String IDEM_PEDIDO_B = "TEST-72-IDEM-B";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private ProductRepository productRepository;
    @Autowired private SkuRepository skuRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private MarketRepository marketRepository;
    @Autowired private WarehouseRepository warehouseRepository;
    @Autowired private MarketPriceRepository marketPriceRepository;
    @Autowired private StockItemRepository stockItemRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private String adminToken;

    @BeforeEach
    void preparar() {
        limpiar();
        adminToken = jwtService.generateToken(999L, "admin-productos@nexus.test", Role.ADMIN);
    }

    @AfterEach
    void limpiar() {
        // 1) Pedidos de prueba primero: sus items referencian SKUs.
        for (String key : List.of(IDEM_PEDIDO_A, IDEM_PEDIDO_B)) {
            orderRepository.findByIdempotencyKey(key).ifPresent(orderRepository::delete);
        }
        // 2) Productos de prueba (cascada: SKUs → precios → stock).
        for (String ref : List.of(REF_PRUEBA, REF_PRUEBA_B)) {
            productRepository.findByReferenceCode(ref).ifPresent(productRepository::delete);
        }
        productRepository.flush();
    }

    // ── R1: los 8 endpoints con sus códigos de éxito ───────────────────────

    @Test
    @DisplayName("C.1 - POST crea (201) y el listado lo incluye junto al catálogo real")
    void crearProducto201YListadoLoIncluye() throws Exception {
        // GIVEN / WHEN — crear
        long id = crearProducto(REF_PRUEBA);

        // THEN — 201 con el cuerpo y el catálogo intacto dentro del listado
        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].referenceCode", hasItem(REF_PRUEBA)))
                .andExpect(jsonPath("$[*].referenceCode", hasItem(REF_SEMBRADA)));

        mockMvc.perform(get(BASE + "/" + id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.referenceCode").value(REF_PRUEBA))
                .andExpect(jsonPath("$.family").value("OUTERWEAR"))
                .andExpect(jsonPath("$.skus").isEmpty());
    }

    @Test
    @DisplayName("C.1 - PUT actualiza nombre/familia/descripción y NO toca la referencia (R2.4)")
    void actualizarProducto200SinTocarReferencia() throws Exception {
        long id = crearProducto(REF_PRUEBA);

        // El cuerpo intenta cambiar la referencia: se ignora (no está en el DTO)
        mockMvc.perform(put(BASE + "/" + id)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"9999/999\",\"name\":\"Blazer Actualizado\","
                                + "\"family\":\"KNITWEAR\",\"description\":\"Ahora con descripción\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Blazer Actualizado"))
                .andExpect(jsonPath("$.family").value("KNITWEAR"))
                .andExpect(jsonPath("$.description").value("Ahora con descripción"))
                .andExpect(jsonPath("$.referenceCode").value(REF_PRUEBA));
    }

    @Test
    @DisplayName("C.1/R5 - POST SKU crea (201) SIN filas de precio ni stock (frontera 7.3)")
    void crearSku201SinPreciosNiStock() throws Exception {
        long productoId = crearProducto(REF_PRUEBA);

        MvcResult resultado = mockMvc.perform(post(BASE + "/" + productoId + "/skus")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barcode\":\"" + BARCODE_PRUEBA + "\",\"color\":\"Marino\",\"size\":\"M\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.barcode").value(BARCODE_PRUEBA))
                .andExpect(jsonPath("$.color").value("Marino"))
                .andExpect(jsonPath("$.size").value("M"))
                .andReturn();

        long skuId = leerId(resultado);

        // R5.1 — ni market_prices ni stock_items: la 7.3 es la dueña
        org.junit.jupiter.api.Assertions.assertEquals(0, contar("SELECT COUNT(*) FROM market_prices WHERE sku_id = ?", skuId));
        org.junit.jupiter.api.Assertions.assertEquals(0, contar("SELECT COUNT(*) FROM stock_items WHERE sku_id = ?", skuId));
    }

    @Test
    @DisplayName("C.1 - PUT de SKU cambia color/talla y NO toca el código de barras (R2.4)")
    void actualizarSku200SinTocarBarcode() throws Exception {
        long productoId = crearProducto(REF_PRUEBA);
        long skuId = crearSku(productoId);

        mockMvc.perform(put(BASE + "/" + productoId + "/skus/" + skuId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barcode\":\"999999999999\",\"color\":\"Camel\",\"size\":\"L\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.color").value("Camel"))
                .andExpect(jsonPath("$.size").value("L"))
                .andExpect(jsonPath("$.barcode").value(BARCODE_PRUEBA));
    }

    @Test
    @DisplayName("C.1 - DELETE de SKU (204) lo retira y el producto sigue")
    void borrarSku204() throws Exception {
        long productoId = crearProducto(REF_PRUEBA);
        long skuId = crearSku(productoId);

        mockMvc.perform(delete(BASE + "/" + productoId + "/skus/" + skuId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        org.junit.jupiter.api.Assertions.assertEquals(0, contar("SELECT COUNT(*) FROM skus WHERE id = ?", skuId));
        org.junit.jupiter.api.Assertions.assertEquals(1, contar("SELECT COUNT(*) FROM products WHERE id = ?", productoId));
    }

    // ── R3: borrado seguro ─────────────────────────────────────────────────

    @Test
    @DisplayName("C.3 - DELETE sin pedidos (204): producto, SKUs, precios y stock borrados en BD")
    void borrarProducto204ConCascadasVerificadas() throws Exception {
        long productoId = crearProducto(REF_PRUEBA);
        long skuId = crearSku(productoId);
        insertarPrecioYStock(skuId);

        mockMvc.perform(delete(BASE + "/" + productoId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        // Cascadas verificadas directamente en BD
        org.junit.jupiter.api.Assertions.assertEquals(0, contar("SELECT COUNT(*) FROM products WHERE id = ?", productoId));
        org.junit.jupiter.api.Assertions.assertEquals(0, contar("SELECT COUNT(*) FROM skus WHERE id = ?", skuId));
        org.junit.jupiter.api.Assertions.assertEquals(0, contar("SELECT COUNT(*) FROM market_prices WHERE sku_id = ?", skuId));
        org.junit.jupiter.api.Assertions.assertEquals(0, contar("SELECT COUNT(*) FROM stock_items WHERE sku_id = ?", skuId));
    }

    @Test
    @DisplayName("C.3 - DELETE de producto con pedidos -> 409 y NO se borra nada")
    void borrarProductoConPedido409() throws Exception {
        long productoId = crearProducto(REF_PRUEBA);
        long skuId = crearSku(productoId);
        insertarPrecioYStock(skuId);
        crearPedido(IDEM_PEDIDO_A, "TEST-72-ORD-A", skuId);

        mockMvc.perform(delete(BASE + "/" + productoId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATALOG_CONFLICT"))
                .andExpect(jsonPath("$.message").exists());

        // Ni producto, ni SKUs, ni precios, ni stock
        org.junit.jupiter.api.Assertions.assertEquals(1, contar("SELECT COUNT(*) FROM products WHERE id = ?", productoId));
        org.junit.jupiter.api.Assertions.assertEquals(1, contar("SELECT COUNT(*) FROM skus WHERE id = ?", skuId));
        org.junit.jupiter.api.Assertions.assertEquals(1, contar("SELECT COUNT(*) FROM market_prices WHERE sku_id = ?", skuId));
        org.junit.jupiter.api.Assertions.assertEquals(1, contar("SELECT COUNT(*) FROM stock_items WHERE sku_id = ?", skuId));
    }

    @Test
    @DisplayName("C.3 - DELETE de SKU con pedidos -> 409 y el SKU sigue")
    void borrarSkuConPedido409() throws Exception {
        long productoId = crearProducto(REF_PRUEBA);
        long skuId = crearSku(productoId);
        crearPedido(IDEM_PEDIDO_B, "TEST-72-ORD-B", skuId);

        mockMvc.perform(delete(BASE + "/" + productoId + "/skus/" + skuId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATALOG_CONFLICT"));

        org.junit.jupiter.api.Assertions.assertEquals(1, contar("SELECT COUNT(*) FROM skus WHERE id = ?", skuId));
    }

    // ── R2: validación, unicidad y 404 ─────────────────────────────────────

    @Test
    @DisplayName("C.2 - Unicidad violada -> 409 (referencia y código de barras)")
    void unicidadViolada409() throws Exception {
        // Referencia ya sembrada en V1
        mockMvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"" + REF_SEMBRADA + "\",\"name\":\"Duplicado\","
                                + "\"family\":\"OUTERWEAR\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATALOG_CONFLICT"));

        // Código de barras de un SKU sembrado
        String barcodeSembrado = productRepository.findByReferenceCode(REF_SEMBRADA)
                .orElseThrow().getSkus().get(0).getBarcode();
        long idSembrado = productRepository.findByReferenceCode(REF_SEMBRADA).orElseThrow().getId();

        mockMvc.perform(post(BASE + "/" + idSembrado + "/skus")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barcode\":\"" + barcodeSembrado + "\",\"color\":\"Otro\",\"size\":\"S\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATALOG_CONFLICT"));
    }

    @Test
    @DisplayName("C.2 - Validación de DTO -> 400 con message claro (R2.1/R2.2)")
    void validacion400ConMensaje() throws Exception {
        // Referencia fuera de patrón
        mockMvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"ABC-123\",\"name\":\"Blazer\",\"family\":\"OUTERWEAR\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());

        // Familia en minúsculas
        mockMvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"7201/009\",\"name\":\"Blazer\",\"family\":\"outerwear\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());

        // Nombre en blanco
        mockMvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"7201/010\",\"name\":\"  \",\"family\":\"OUTERWEAR\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("C.1/R4 - cuidados: se guardan recortados y el en blanco se vuelve NULL")
    void cuidadosSeGuardanYElBlancoVuelveNull() throws Exception {
        // GIVEN / WHEN — crear con cuidado (con espacios sobrantes y saltos de línea)
        MvcResult creado = mockMvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"" + REF_PRUEBA + "\",\"name\":\"Blazer Prueba 72\","
                                + "\"family\":\"OUTERWEAR\","
                                + "\"careInstructions\":\"  No lavar con lejía\\nSecar a la sombra  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.careInstructions")
                        .value("No lavar con lejía\nSecar a la sombra"))
                .andReturn();
        long id = leerId(creado);

        // THEN — el catálogo público lo lleva en el mismo contrato que la descripción
        mockMvc.perform(get("/api/v1/products/search").param("reference", REF_PRUEBA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.careInstructions")
                        .value("No lavar con lejía\nSecar a la sombra"));

        // WHEN — el operador lo borra dejándolo en blanco
        mockMvc.perform(put(BASE + "/" + id)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Blazer Prueba 72\",\"family\":\"OUTERWEAR\","
                                + "\"careInstructions\":\"   \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.careInstructions").isEmpty());

        // THEN — en BD es NULL y no cadena vacía: la vitrina no pinta la sección (R5)
        String guardado = jdbcTemplate.queryForObject(
                "SELECT care_instructions FROM products WHERE id = ?", String.class, id);
        assertThat(guardado).isNull();
    }

    @Test
    @DisplayName("C.2/R4 - cuidado de más de 2000 caracteres -> 400 con message")
    void cuidadosDemasiadoLargos400() throws Exception {
        // GIVEN — 2001 caracteres, uno por encima del límite del DTO
        String largo = "x".repeat(2001);

        // WHEN / THEN
        mockMvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"" + REF_PRUEBA + "\",\"name\":\"Blazer\",\"family\":\"OUTERWEAR\","
                                + "\"careInstructions\":\"" + largo + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("C.2 - Recurso inexistente o SKU ajeno -> 404 (R2.5)")
    void noEncontrado404() throws Exception {
        mockMvc.perform(get(BASE + "/999999").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").exists());

        mockMvc.perform(put(BASE + "/999999")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\",\"family\":\"OUTERWEAR\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete(BASE + "/999999").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());

        // SKU que existe pero pertenece a OTRO producto -> 404 (sin filtrar su existencia)
        long productoA = crearProducto(REF_PRUEBA);
        long skuDeA = crearSku(productoA);
        long productoB = crearProducto(REF_PRUEBA_B);

        mockMvc.perform(put(BASE + "/" + productoB + "/skus/" + skuDeA)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"color\":\"Camel\",\"size\":\"L\"}"))
                .andExpect(status().isNotFound());
    }

    // ── Internos ───────────────────────────────────────────────────────────

    private long crearProducto(String referencia) throws Exception {
        MvcResult resultado = mockMvc.perform(post(BASE)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenceCode\":\"" + referencia + "\",\"name\":\"Blazer Prueba 72\","
                                + "\"family\":\"OUTERWEAR\",\"description\":\"Producto de prueba\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    private long crearSku(long productoId) throws Exception {
        MvcResult resultado = mockMvc.perform(post(BASE + "/" + productoId + "/skus")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barcode\":\"" + BARCODE_PRUEBA + "\",\"color\":\"Marino\",\"size\":\"M\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    /** Inserta una fila de precio y otra de stock del SKU, como si ya los hubiera puesto la 7.3. */
    private void insertarPrecioYStock(long skuId) {
        Sku sku = skuRepository.findById(skuId).orElseThrow();
        Market market = marketRepository.findByCode("ES").orElseThrow();
        Warehouse warehouse = warehouseRepository.findAll().get(0);

        marketPriceRepository.save(MarketPrice.builder()
                .sku(sku).market(market)
                .basePrice(new BigDecimal("99.99"))
                .isActive(true)
                .build());
        stockItemRepository.save(StockItem.builder()
                .sku(sku).warehouse(warehouse)
                .quantityAvailable(5).quantityReserved(0)
                .build());
    }

    /** Pedido real (con {@code order_items} sobre el SKU) para activar las guardas de borrado. */
    private void crearPedido(String idempotencyKey, String orderNumber, long skuId) {
        Sku sku = skuRepository.findById(skuId).orElseThrow();

        Order pedido = Order.builder()
                .orderNumber(orderNumber)
                .idempotencyKey(idempotencyKey)
                .marketCode("ES")
                .currency("EUR")
                .status(OrderStatus.CONFIRMED)
                .subtotalAmount(new BigDecimal("10.00"))
                .taxAmount(new BigDecimal("2.10"))
                .totalAmount(new BigDecimal("12.10"))
                .build();
        pedido.addItem(OrderItem.builder()
                .sku(sku)
                .warehouseCode("WH_ZARAGOZA")
                .quantity(1)
                .unitPrice(new BigDecimal("10.00"))
                .taxRate(new BigDecimal("21.00"))
                .taxAmount(new BigDecimal("2.10"))
                .totalAmount(new BigDecimal("12.10"))
                .build());

        orderRepository.save(pedido);
    }

    private long leerId(MvcResult resultado) throws Exception {
        JsonNode json = objectMapper.readTree(
                resultado.getResponse().getContentAsString(StandardCharsets.UTF_8));
        return json.get("id").asLong();
    }

    private int contar(String sql, Object... args) {
        Integer n = jdbcTemplate.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }
}
