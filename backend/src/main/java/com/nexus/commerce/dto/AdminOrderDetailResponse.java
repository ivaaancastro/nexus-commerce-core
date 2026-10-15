package com.nexus.commerce.dto;

/**
 * Detalle de un pedido en el panel (Tarea 7.4, R2). <strong>Compone</strong> el
 * {@link OrderResponse} que ya ve el cliente (estado, montos, líneas, tracking…)
 * y añade lo que sólo el admin necesita: de quién es el pedido y si tiene
 * devolución solicitada. Cero duplicación de campos (plan D5/D6).
 *
 * @param userEmail       email del comprador; {@code null} sin usuario (V7 nullable)
 * @param returnRequested {@code true} si alguna línea tiene devolución solicitada;
 *                        informativo — el backoffice de devoluciones está fuera
 *                        de alcance (decisión del usuario en la 7.4)
 */
public record AdminOrderDetailResponse(
        OrderResponse order,
        String userEmail,
        boolean returnRequested
) {}
