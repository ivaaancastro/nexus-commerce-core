package com.nexus.commerce.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.commerce.entity.Order;
import com.nexus.commerce.entity.OrderItem;
import com.nexus.commerce.entity.OrderStatus;
import com.nexus.commerce.entity.Product;
import com.nexus.commerce.entity.ProductReturn;
import com.nexus.commerce.entity.ReturnStatus;
import com.nexus.commerce.entity.Role;
import com.nexus.commerce.entity.Sku;
import com.nexus.commerce.entity.StockItem;
import com.nexus.commerce.entity.User;
import com.nexus.commerce.entity.Warehouse;
import com.nexus.commerce.repository.OrderRepository;
import com.nexus.commerce.repository.ProductRepository;
import com.nexus.commerce.repository.ProductReturnRepository;
import com.nexus.commerce.repository.SkuRepository;
import com.nexus.commerce.repository.StockItemRepository;
import com.nexus.commerce.repository.UserRepository;
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

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tarea 7.4 (spec specs/admin-orders/, R1–R5) — gestión de pedidos bajo
 * {@code /api/v1/admin/orders}, con <strong>backend real</strong>: PostgreSQL +
 * Flyway V14 + Spring Security.
 *
 * <p><strong>BD compartida limpia (tasks C.6)</strong>: mismo criterio que
 * {@code AdminStockControllerTest} — sin {@code @Transactional} de clase (haría
 * invisible el commit de los lock pesimistas), datos propios con clave fija
 * ({@code 7401/001} y pedidos {@code ORD-7401*}) y borrado en {@code @Before}
 * <em>y</em> {@code @After} (returns → pedidos → producto). Ni el catálogo
 * sembrado ni el stock de V1 se tocan: el stock de prueba es una fila propia
 * que la cascada {@code sku_id ON DELETE CASCADE} elimina con el producto.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Tarea 7.4 - Gestión de pedidos en la zona admin")
class AdminOrderControllerTest {

    private static final String BASE = "/api/v1/admin/orders";
    private static final String REF_PRUEBA = "7401/001";
    private static final String BARCODE_PRUEBA = "740100000001";
    private static final String ALMACEN = "WH_ARTEIXO";
    private static final String PREFIJO_PEDIDO = "ORD-7401";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private ProductRepository productRepository;
    @Autowired private SkuRepository skuRepository;
    @Autowired private StockItemRepository stockItemRepository;
    @Autowired private WarehouseRepository warehouseRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private ProductReturnRepository productReturnRepository;
    @Autowired private UserRepository userRepository;

    private String adminToken;
    private String userToken;
    private User adminUser;
    private Warehouse warehouse;
    private Sku sku;

    @BeforeEach
    void preparar() {
        limpiarDatos();
        adminToken = jwtService.generateToken(999L, "admin-orders@nexus.test", Role.ADMIN);
        userToken = jwtService.generateToken(998L, "user-orders@nexus.test", Role.USER);
        adminUser = userRepository.findByEmail("admin@nexus.dev")
                .orElseThrow(() -> new IllegalStateException("V13 debió sembrar admin@nexus.dev"));
        warehouse = warehouseRepository.findByCode(ALMACEN)
                .orElseThrow(() -> new IllegalStateException("V1 debió sembrar " + ALMACEN));

        Product producto = productRepository.saveAndFlush(Product.builder()
                .referenceCode(REF_PRUEBA)
                .name("Blazer Prueba 74")
                .family("OUTERWEAR")
                .description("Producto de prueba 7.4")
                .build());
        sku = skuRepository.saveAndFlush(Sku.builder()
                .product(producto)
                .barcode(BARCODE_PRUEBA)
                .color("Marino")
                .size("M")
                .build());
        // Reserva base de 2 unidades: la de un pedido de 2 piezas en curso.
        guardarStock(10, 2);
    }

    @AfterEach
    void despuesDeCadaTest() {
        limpiarDatos();
    }

    // ── R1: listado ────────────────────────────────────────────────────────

    @Test
    @DisplayName("R1 - GET devuelve la página con su shape y los pedidos propios, con cliente y totales")
    void listado200ConShapeYPedidosPropios() throws Exception {
        crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.PENDING, 2, adminUser);
        crearPedido(PREFIJO_PEDIDO + "B", OrderStatus.SHIPPED, 1, null);

        MvcResult resultado = mockMvc.perform(get(BASE)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orders").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andReturn();

        JsonNode json = leerJson(resultado);
        assertThat(json.get("totalElements").asLong()).isGreaterThanOrEqualTo(2);
        assertThat(json.get("totalPages").asInt()).isGreaterThanOrEqualTo(1);

        JsonNode filaA = filaDe(json, PREFIJO_PEDIDO + "A");
        assertThat(filaA).as("el pedido A debe aparecer en la lista").isNotNull();
        assertThat(filaA.get("userEmail").asText()).isEqualTo("admin@nexus.dev");
        assertThat(filaA.get("itemCount").asInt()).isEqualTo(1);
        assertThat(filaA.get("returnRequested").asBoolean()).isFalse();
        assertThat(filaA.get("marketCode").asText()).isEqualTo("ES");
        assertThat(filaA.get("totalAmount").decimalValue())
                .isEqualByComparingTo(new BigDecimal("96.80"));

        // Pedido sin usuario (V7 nullable): el flag existe y es null
        JsonNode filaB = filaDe(json, PREFIJO_PEDIDO + "B");
        assertThat(filaB).isNotNull();
        assertThat(filaB.get("userEmail").isNull()).isTrue();
    }

    @Test
    @DisplayName("R1 - filtro status: sólo esa página de estados, conteniendo el pedido esperado")
    void filtroPorStatus() throws Exception {
        crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.PENDING, 2, adminUser);
        crearPedido(PREFIJO_PEDIDO + "B", OrderStatus.SHIPPED, 1, adminUser);

        JsonNode json = leerJson(mockMvc.perform(get(BASE + "?status=SHIPPED")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn());

        assertThat(numerosDe(json)).contains(PREFIJO_PEDIDO + "B")
                .doesNotContain(PREFIJO_PEDIDO + "A");
        for (JsonNode fila : json.get("orders")) {
            assertThat(fila.get("status").asText()).isEqualTo("SHIPPED");
        }
    }

    @Test
    @DisplayName("R1 - filtro q por nº de pedido y por email, case-insensitive; vacío = sin filtro")
    void filtroPorQNumeroYEmail() throws Exception {
        crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.PENDING, 2, adminUser);
        crearPedido(PREFIJO_PEDIDO + "B", OrderStatus.CONFIRMED, 1, null);

        // Por número, en minúsculas (el LOWER del servidor normaliza)
        JsonNode porNumero = leerJson(mockMvc.perform(get(BASE + "?q=ord-7401a")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn());
        assertThat(numerosDe(porNumero)).contains(PREFIJO_PEDIDO + "A")
                .doesNotContain(PREFIJO_PEDIDO + "B");

        // Por email del cliente
        JsonNode porEmail = leerJson(mockMvc.perform(get(BASE + "?q=admin@nexus.dev")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn());
        assertThat(numerosDe(porEmail)).contains(PREFIJO_PEDIDO + "A");

        // Blanco o en blanco = sin filtro (R1.3): los dos siguen ahí
        // .param() en vez de %20%20 en la URL: MockMvc re-codificaría la plantilla
        JsonNode enBlanco = leerJson(mockMvc.perform(get(BASE).param("q", "  ")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn());
        assertThat(numerosDe(enBlanco)).contains(PREFIJO_PEDIDO + "A", PREFIJO_PEDIDO + "B");
    }

    @Test
    @DisplayName("R1 - sin resultados devuelve lista vacía y totalElements 0")
    void busquedaSinResultados() throws Exception {
        JsonNode json = leerJson(mockMvc.perform(get(BASE + "?q=ORD-NADA-QUE-BUSCAR")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orders").isArray())
                .andReturn());

        assertThat(json.get("orders").isEmpty()).isTrue();
        assertThat(json.get("totalElements").asLong()).isZero();
        assertThat(json.get("totalPages").asInt()).isZero();
    }

    @Test
    @DisplayName("R1.2 - status desconocido -> 400; page negativo -> 400 (R8 de 7.3)")
    void parametrosInvalidos400() throws Exception {
        mockMvc.perform(get(BASE + "?status=ZOMBIE")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(BASE + "?page=-1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Seguridad: 401 sin sesión, 403 con rol USER (hereda /admin/** de la 7.1)")
    void seguridadDeLaZonaAdmin() throws Exception {
        mockMvc.perform(get(BASE))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get(BASE).header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        String pedido = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.PENDING, 2, adminUser);
        mockMvc.perform(put(BASE + "/" + pedido + "/status")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isForbidden());
    }

    // ── R2: detalle ────────────────────────────────────────────────────────

    @Test
    @DisplayName("R2 - detalle compone OrderResponse + userEmail + returnRequested")
    void detalleComponeClienteYAdmin() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.CONFIRMED, 2, adminUser);

        MvcResult resultado = mockMvc.perform(get(BASE + "/" + numero)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userEmail").value("admin@nexus.dev"))
                .andExpect(jsonPath("$.returnRequested").value(false))
                .andExpect(jsonPath("$.order.orderNumber").value(numero))
                .andExpect(jsonPath("$.order.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.order.items.length()").value(1))
                .andExpect(jsonPath("$.order.items[0].productName").value("Blazer Prueba 74"))
                .andReturn();

        JsonNode json = leerJson(resultado);
        assertThat(json.get("order").get("trackingNumber").isNull()).isTrue();
        assertThat(json.get("order").get("carrier").isNull()).isTrue();
    }

    @Test
    @DisplayName("R2 - pedido sin usuario: userEmail null en el detalle (V7 nullable)")
    void detalleSinUsuarioUserEmailNull() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "S", OrderStatus.PENDING, 1, null);

        MvcResult resultado = mockMvc.perform(get(BASE + "/" + numero)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(leerJson(resultado).get("userEmail").isNull())
                .as("sin usuario el email viaja null, no una cadena vacía")
                .isTrue();
    }

    @Test
    @DisplayName("R2.4 / R1.5 - devolución en una línea: returnRequested true en detalle Y en lista")
    void returnRequestedEnDetalleYLista() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "D", OrderStatus.DELIVERED, 1, adminUser);
        Order pedido = orderRepository.findByOrderNumber(numero).orElseThrow();
        productReturnRepository.saveAndFlush(ProductReturn.builder()
                .orderItem(pedido.getItems().getFirst())
                .user(adminUser)
                .status(ReturnStatus.REQUESTED)
                .reason("Talla incorrecta")
                .currency("EUR")
                .refundAmount(new BigDecimal("48.40"))
                .requestedAt(Instant.now())
                .build());

        mockMvc.perform(get(BASE + "/" + numero)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.returnRequested").value(true));

        JsonNode lista = leerJson(mockMvc.perform(get(BASE + "?q=" + numero)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(filaDe(lista, numero).get("returnRequested").asBoolean())
                .as("el listado también debe marcar la devolución (R1.5)")
                .isTrue();
    }

    @Test
    @DisplayName("R2.4 - pedido inexistente -> 404")
    void detalle404() throws Exception {
        mockMvc.perform(get(BASE + "/ORD-NOEXISTE")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    // ── R3/R4: máquina de transiciones y efectos de stock ──────────────────

    @Test
    @DisplayName("R3.1 - PENDING -> CONFIRMED con el stock intacto (R4.5)")
    void pendienteAConfirmadoNoTocaStock() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.PENDING, 2, adminUser);

        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.userEmail").value("admin@nexus.dev"));

        StockItem stock = stockActual();
        assertThat(stock.getQuantityAvailable()).isEqualTo(10);
        assertThat(stock.getQuantityReserved()).isEqualTo(2);
    }

    @Test
    @DisplayName("R4.3 - CONFIRMED -> SHIPPED descuenta disponible y consume reserva en la misma transacción")
    void enviadoDescuentaStock() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.CONFIRMED, 2, adminUser);

        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SHIPPED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("SHIPPED"));

        StockItem stock = stockActual();
        assertThat(stock.getQuantityAvailable()).isEqualTo(8);
        assertThat(stock.getQuantityReserved()).isZero();
    }

    @Test
    @DisplayName("R4.1 - CONFIRMED -> CANCELLED libera exactamente la reserva, disponible intacto")
    void canceladoLiberaReserva() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.CONFIRMED, 2, adminUser);

        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("CANCELLED"));

        StockItem stock = stockActual();
        assertThat(stock.getQuantityReserved()).isZero();
        assertThat(stock.getQuantityAvailable()).isEqualTo(10);
    }

    @Test
    @DisplayName("R3.1 - SHIPPED -> DELIVERED completa la ruta feliz")
    void enviadoAEntregado() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.SHIPPED, 1, adminUser);

        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DELIVERED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("DELIVERED"));
    }

    @Test
    @DisplayName("R3.3/R3.4 - transición inválida y mismo estado -> 409 ORDER_CONFLICT con mensaje")
    void conflictoDeTransicion409() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.PENDING, 2, adminUser);

        // Inválida: saltar de PENDING a SHIPPED
        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SHIPPED\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDER_CONFLICT"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString(
                        "Transición no permitida")));

        // Mismo estado: la guarda anti doble clic
        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PENDING\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDER_CONFLICT"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString(
                        "ya está en estado")));

        // El pedido no se movió y el stock sigue intacto (R3.5)
        mockMvc.perform(get(BASE + "/" + numero)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(jsonPath("$.order.status").value("PENDING"));
        StockItem stock = stockActual();
        assertThat(stock.getQuantityReserved()).isEqualTo(2);
    }

    @Test
    @DisplayName("R3.3 - estados terminales DELIVERED y CANCELLED no se mueven (409)")
    void estadosTerminales409() throws Exception {
        String entregado = crearPedido(PREFIJO_PEDIDO + "E", OrderStatus.DELIVERED, 1, adminUser);
        String cancelado = crearPedido(PREFIJO_PEDIDO + "C", OrderStatus.CANCELLED, 1, adminUser);

        mockMvc.perform(put(BASE + "/" + entregado + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDER_CONFLICT"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString(
                        "estado final")));

        mockMvc.perform(put(BASE + "/" + cancelado + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SHIPPED\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("R4.4 - enviar sin existencias -> 409 STOCK_CONFLICT y el estado NO cambia")
    void envioSinStock409YEstadoIntacto() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.CONFIRMED, 2, adminUser);
        // Fila propia con menos disponibles que las 2 unidades del pedido
        StockItem stock = stockActual();
        stock.setQuantityAvailable(1);
        stockItemRepository.saveAndFlush(stock);

        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SHIPPED\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STOCK_CONFLICT"));

        // Rollback total: ni estado ni inventario se movieron
        mockMvc.perform(get(BASE + "/" + numero)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(jsonPath("$.order.status").value("CONFIRMED"));
        StockItem trasFallo = stockActual();
        assertThat(trasFallo.getQuantityAvailable()).isEqualTo(1);
        assertThat(trasFallo.getQuantityReserved()).isEqualTo(2);
    }

    @Test
    @DisplayName("R4.2 - cancelar con la fila de stock ausente completa el pedido igualmente")
    void cancelarSinFilaStock200() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.CONFIRMED, 2, adminUser);
        stockItemRepository.delete(stockActual());
        stockItemRepository.flush();

        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("CANCELLED"));
    }

    @Test
    @DisplayName("R3.5 - body sin estado, estado desconocido o pedido inexistente -> 400/404")
    void validacionDeCambioDeEstado() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.PENDING, 1, adminUser);

        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put(BASE + "/" + numero + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ZOMBIE\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put(BASE + "/ORD-NOEXISTE/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isNotFound());
    }

    // ── R5: tracking ───────────────────────────────────────────────────────

    @Test
    @DisplayName("R5.3 - guardar transportista y nº de seguimiento persiste y vuelve en el detalle")
    void guardarTracking() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.SHIPPED, 1, adminUser);

        mockMvc.perform(put(BASE + "/" + numero + "/tracking")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"carrier\":\"SEUR\",\"trackingNumber\":\"SEUR-7401-A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.carrier").value("SEUR"))
                .andExpect(jsonPath("$.order.trackingNumber").value("SEUR-7401-A"));

        mockMvc.perform(get(BASE + "/" + numero)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(jsonPath("$.order.carrier").value("SEUR"))
                .andExpect(jsonPath("$.order.trackingNumber").value("SEUR-7401-A"));
    }

    @Test
    @DisplayName("R5.2 - full-replace: vacíos limpian el tracking y es editable en estado terminal")
    void limpiarTrackingEnEstadoTerminal() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.CANCELLED, 1, adminUser);
        mockMvc.perform(put(BASE + "/" + numero + "/tracking")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"carrier\":\"Nacex\",\"trackingNumber\":\"NX-1\"}"))
                .andExpect(status().isOk());

        MvcResult limpiado = mockMvc.perform(put(BASE + "/" + numero + "/tracking")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"carrier\":\"\",\"trackingNumber\":\" \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("CANCELLED"))
                .andReturn();

        JsonNode cuerpo = leerJson(limpiado).get("order");
        assertThat(cuerpo.get("carrier").isNull()).as("vacío -> null (full-replace)").isTrue();
        assertThat(cuerpo.get("trackingNumber").isNull()).as("espacios -> null (trim)").isTrue();
    }

    @Test
    @DisplayName("R5.4 - carrier de 65 caracteres -> 400; pedido inexistente -> 404")
    void trackingValidacion() throws Exception {
        String numero = crearPedido(PREFIJO_PEDIDO + "A", OrderStatus.PENDING, 1, adminUser);

        String muyLargo = "X".repeat(65);
        mockMvc.perform(put(BASE + "/" + numero + "/tracking")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"carrier\":\"" + muyLargo + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());

        mockMvc.perform(put(BASE + "/ORD-NOEXISTE/tracking")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"carrier\":\"SEUR\"}"))
                .andExpect(status().isNotFound());
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private String crearPedido(String orderNumber, OrderStatus estado, int cantidad, User usuario) {
        Order order = Order.builder()
                .orderNumber(orderNumber)
                .idempotencyKey("idem-" + orderNumber)
                .marketCode("ES")
                .currency("EUR")
                .status(estado)
                .subtotalAmount(new BigDecimal("80.00"))
                .taxAmount(new BigDecimal("16.80"))
                .totalAmount(new BigDecimal("96.80"))
                .user(usuario)
                .build();
        order.addItem(OrderItem.builder()
                .sku(sku)
                .warehouseCode(ALMACEN)
                .quantity(cantidad)
                .unitPrice(new BigDecimal("40.00"))
                .taxRate(new BigDecimal("21.00"))
                .taxAmount(new BigDecimal("8.40"))
                .totalAmount(new BigDecimal("48.40"))
                .build());
        orderRepository.saveAndFlush(order);
        return order.getOrderNumber();
    }

    private void guardarStock(int disponibles, int reservadas) {
        stockItemRepository.saveAndFlush(StockItem.builder()
                .sku(sku)
                .warehouse(warehouse)
                .quantityAvailable(disponibles)
                .quantityReserved(reservadas)
                .build());
    }

    private StockItem stockActual() {
        return stockItemRepository.findBySkuIdWithWarehouse(sku.getId()).stream()
                .filter(s -> ALMACEN.equals(s.getWarehouse().getCode()))
                .findFirst()
                .orElseThrow();
    }

    private JsonNode leerJson(MvcResult resultado) throws Exception {
        return objectMapper.readTree(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private JsonNode filaDe(JsonNode lista, String orderNumber) {
        for (JsonNode fila : lista.get("orders")) {
            if (orderNumber.equals(fila.get("orderNumber").asText())) {
                return fila;
            }
        }
        return null;
    }

    private List<String> numerosDe(JsonNode lista) {
        List<String> numeros = new java.util.ArrayList<>();
        for (JsonNode fila : lista.get("orders")) {
            numeros.add(fila.get("orderNumber").asText());
        }
        return numeros;
    }

    /**
     * Borra TODO lo propio de este test, en orden de dependencia FK:
     * devoluciones → pedidos (cascada a líneas) → producto (cascada a SKU y,
     * por {@code ON DELETE CASCADE} de V1, a su stock).
     */
    private void limpiarDatos() {
        List<Order> propias = orderRepository.findAll().stream()
                .filter(o -> o.getOrderNumber() != null && o.getOrderNumber().startsWith(PREFIJO_PEDIDO))
                .toList();
        for (Order orden : propias) {
            productReturnRepository.findByOrderItemOrderId(orden.getId())
                    .forEach(productReturnRepository::delete);
        }
        if (!propias.isEmpty()) {
            productReturnRepository.flush();
        }
        orderRepository.deleteAll(propias);
        orderRepository.flush();
        productRepository.findByReferenceCode(REF_PRUEBA).ifPresent(productRepository::delete);
        productRepository.flush();
    }
}
