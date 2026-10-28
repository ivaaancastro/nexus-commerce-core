package com.nexus.commerce.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<Map<String, Object>> handleInsufficientStock(InsufficientStockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.CONFLICT.value(),
                "error", "Conflict",
                "message", ex.getMessage()
        ));
    }

    /**
     * 409 de devoluciones (Tarea 5.4). Lleva {@code code} para que el frontend
     * pueda distinguirlo del 409 de stock: ambos son «Conflict», pero el mensaje
     * a mostrar es completamente distinto.
     */
    @ExceptionHandler(ReturnNotAllowedException.class)
    public ResponseEntity<Map<String, Object>> handleReturnNotAllowed(ReturnNotAllowedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.CONFLICT.value(),
                "error", "Conflict",
                "code", "RETURN_NOT_ALLOWED",
                "message", ex.getMessage()
        ));
    }

    /**
     * 503 de IA (Tarea 6.2): falta la clave de OpenAI y la funcionalidad
     * (indexación vectorial o enriquecimiento) no puede ejecutarse. Lleva
     * {@code code} para que el cliente distinga cuál de las dos es, igual
     * que el 409 de devoluciones se distingue del de stock.
     */
    @ExceptionHandler(AiFeatureUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handleAiFeatureUnavailable(AiFeatureUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.SERVICE_UNAVAILABLE.value(),
                "error", "Service Unavailable",
                "code", ex.getCode(),
                "message", ex.getMessage()
        ));
    }

    /**
     * 409 de catálogo (Tarea 7.2): borrado bloqueado por pedidos existentes o
     * unicidad violada (referencia de producto / código de barras). Lleva
     * {@code code} para que el panel pueda distinguirlo de otros 409.
     */
    @ExceptionHandler(CatalogConflictException.class)
    public ResponseEntity<Map<String, Object>> handleCatalogConflict(CatalogConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.CONFLICT.value(),
                "error", "Conflict",
                "code", "CATALOG_CONFLICT",
                "message", ex.getMessage()
        ));
    }

    /**
     * 409 de stock del panel (Tarea 7.3): disponible por debajo de las
     * unidades reservadas, o carrera de upsert sobre {@code uk_sku_warehouse}.
     * Lleva {@code code} para que el frontend lo traduzca distinto del 409
     * de catálogo y del de devoluciones.
     */
    @ExceptionHandler(StockConflictException.class)
    public ResponseEntity<Map<String, Object>> handleStockConflict(StockConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.CONFLICT.value(),
                "error", "Conflict",
                "code", "STOCK_CONFLICT",
                "message", ex.getMessage()
        ));
    }

    /**
     * 409 de transición de estado (Tarea 7.4, R3): la máquina de transiciones
     * del pedido no permite el movimiento pedido — o se repite el estado actual
     * (doble clic). Lleva {@code code} para que el frontend lo traduzca distinto
     * del 409 de stock y así no confundir «movimiento inválido» con «sin
     * existencias».
     */
    @ExceptionHandler(OrderStateConflictException.class)
    public ResponseEntity<Map<String, Object>> handleOrderStateConflict(OrderStateConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.CONFLICT.value(),
                "error", "Conflict",
                "code", "ORDER_CONFLICT",
                "message", ex.getMessage()
        ));
    }

    /**
     * 409 de guardas de usuarios (Tarea 7.5, R2/R3): suspender/degradar al
     * último admin activo o auto-suspenderse. Lleva {@code code} para que el
     * panel lo traduzca distinto del 409 de pedidos/stock/catálogo — el
     * mensaje se muestra bajo la fila sin toast de éxito (patrón 7.3/7.4).
     */
    @ExceptionHandler(UserConflictException.class)
    public ResponseEntity<Map<String, Object>> handleUserConflict(UserConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.CONFLICT.value(),
                "error", "Conflict",
                "code", "USER_CONFLICT",
                "message", ex.getMessage()
        ));
    }

    /**
     * 403 de cuenta suspendida (Tarea 7.5, R4): el chequeo va tras validar la
     * contraseña en {@code login} y tras recargar el usuario en {@code refresh}
     * (anti enumeración, plan D3). Mensaje amigable en español — no es un
     * «No tienes permiso», es «esta cuenta está bloqueada».
     */
    @ExceptionHandler(UserSuspendedException.class)
    public ResponseEntity<Map<String, Object>> handleUserSuspended(UserSuspendedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.FORBIDDEN.value(),
                "error", "Forbidden",
                "message", ex.getMessage()
        ));
    }

    /**
     * 400 de cuerpo ilegible (Tarea 7.5, R2): JSON malformado o valor que
     * Jackson no convierte — p. ej. un rol fuera de la enumeración. Sin este
     * handler la respuesta por defecto de Spring no trae {@code message}
     * ({@code server.error.include-message = never}) y el panel no podría
     * traducir el error (mismo motivo que el handler de validación de abajo).
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.BAD_REQUEST.value(),
                "error", "Bad Request",
                "message", "Cuerpo de la petición ilegible: formato o valor no válido"
        ));
    }

    /**
     * 400 de validación de DTO: sin este handler la respuesta por defecto de
     * Spring no incluye {@code message} (server.error.include-message nunca),
     * y el frontend no podría traducir el error. Devuelve el primer fallo de
     * campo, ya redactado en español por la anotación.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String mensaje = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .orElse("Datos inválidos");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.BAD_REQUEST.value(),
                "error", "Bad Request",
                "message", mensaje
        ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.BAD_REQUEST.value(),
                "error", "Bad Request",
                "message", ex.getMessage()
        ));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.NOT_FOUND.value(),
                "error", "Not Found",
                "message", ex.getMessage()
        ));
    }

    /**
     * 404 de cupón inexistente (V5): el mensaje ya viene redactado en español
     * («Cupón no encontrado: …»).
     */
    @ExceptionHandler(CouponNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleCouponNotFound(CouponNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.NOT_FOUND.value(),
                "error", "Not Found",
                "code", "COUPON_NOT_FOUND",
                "message", ex.getMessage()
        ));
    }

    /**
     * 409 de unicidad de código al crear cupón (V5, §2.2). Con {@code code}
     * para que el formulario lo traduzca como conflicto, no como stock.
     */
    @ExceptionHandler(CouponCodeExistsException.class)
    public ResponseEntity<Map<String, Object>> handleCouponCodeExists(CouponCodeExistsException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.CONFLICT.value(),
                "error", "Conflict",
                "code", "COUPON_CONFLICT",
                "message", ex.getMessage()
        ));
    }

    /**
     * 409 de borrar un cupón ya usado (V5, §2.2): el panel muestra el mensaje
     * del servidor bajo la fila, sin toast de éxito (patrón 7.3/7.4).
     */
    @ExceptionHandler(CouponHasUsagesException.class)
    public ResponseEntity<Map<String, Object>> handleCouponHasUsages(CouponHasUsagesException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.CONFLICT.value(),
                "error", "Conflict",
                "code", "COUPON_HAS_USAGES",
                "message", ex.getMessage()
        ));
    }

    /**
     * 400 de rechazo del cupón en el canje atómico del checkout (V5, §2.3):
     * inactivo, fechas, límites o mínimo. El mensaje («El cupón ha expirado»…)
     * ya viene redactado para el cliente; el carrito lo muestra y retira el
     * código. Sin este handler la respuesta por defecto de Spring no trae
     * {@code message} y el usuario vería un genérico.
     */
    @ExceptionHandler({
            CouponInactiveException.class,
            CouponNotYetValidException.class,
            CouponExpiredException.class,
            CouponUsageLimitExceededException.class,
            CouponPerUserLimitExceededException.class,
            CouponMinOrderNotMetException.class
    })
    public ResponseEntity<Map<String, Object>> handleCouponRejected(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "timestamp", OffsetDateTime.now().toString(),
                "status", HttpStatus.BAD_REQUEST.value(),
                "error", "Bad Request",
                "code", "COUPON_INVALID",
                "message", ex.getMessage()
        ));
    }
}