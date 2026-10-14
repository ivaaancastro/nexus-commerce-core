package com.nexus.commerce.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
}