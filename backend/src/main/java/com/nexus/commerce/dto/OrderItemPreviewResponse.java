package com.nexus.commerce.dto;

import java.math.BigDecimal;

/**
 * Línea resumida para la tarjeta del historial de pedidos (Tarea 5.5, R9).
 *
 * <p>El DTO anterior no traía ninguna línea —solo {@code itemCount}—, así que la
 * tarjeta no podía mostrar el nombre del producto. Va aparte de
 * {@link OrderItemResponse} porque la lista no necesita precios fiscales,
 * elegibilidad de devolución ni el almacén: solo lo que se pinta en la caja.</p>
 *
 * @param productName   nombre del producto, vía {@code OrderItem → Sku → Product}
 * @param productFamily familia textil
 * @param size          talla de la variante
 * @param color         color de la variante
 * @param quantity      unidades compradas
 * @param totalAmount   importe de la línea (con impuestos)
 */
public record OrderItemPreviewResponse(
        String productName,
        String productFamily,
        String size,
        String color,
        Integer quantity,
        BigDecimal totalAmount
) {}
