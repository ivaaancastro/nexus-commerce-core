# ADR-0003: Motor Transaccional de Pedidos, Snapshot Fiscal e Idempotencia

* **Estado:** Aprobado
* **Fecha:** 2026-09-28
* **Decisores:** Equipo Nexus Core

---

## 1. Contexto y Problema

El proceso de compra (*checkout*) es el punto más sensible de una plataforma de comercio electrónico. Presenta tres riesgos operativos críticos:
1. **Doble reserva o cobro por reintentos de red:** Si la conexión del cliente experimenta latencia o el usuario pulsa repetidamente el botón de pago, pueden emitirse múltiples peticiones con la misma intención de compra.
2. **Corrupción histórica de facturación:** Si el precio o el IVA de un producto cambia en el catálogo tras la compra, los pedidos antiguos no deben recalcularse bajo ninguna circunstancia.
3. **Inconsistencias por fallos parciales:** Si un pedido contiene tres prendas y la tercera no tiene stock suficiente, el sistema debe revertir automáticamente las reservas de las dos anteriores.

---

## 2. Decisiones Tomadas

### 2.1 Garantía de Idempotencia vía Cabecera HTTP (`Idempotency-Key`)
* **Decisión:** Exigir y persistir una clave única por intento de checkout (`orders.idempotency_key` con restricción `UNIQUE` e índice B-Tree).
* **Motivo:** Si entra una petición con una clave ya procesada, `OrderService` intercepta la llamada antes de mutar inventario y retorna de inmediato la orden existente (`201/200 OK`) sin duplicar cargos ni reservas.

### 2.2 Congelación de Datos Financieros (*Line-Item Snapshot*)
* **Decisión:** La tabla `order_items` almacena copias inmutables de `unit_price`, `tax_rate`, `tax_amount` y `total_amount` calculadas en el instante de la transacción mediante `BigDecimal`.
* **Motivo:** Protege la validez contable y fiscal frente a futuras modificaciones en `market_prices` o cambios regulatorios de IVA en la tabla `markets`.

### 2.3 Orquestación Transaccional Unificada (`@Transactional`)
* **Decisión:** Ejecutar la reserva pesimista de stock (`PESSIMISTIC_WRITE`) y la persistencia de la orden bajo un único contexto transaccional de Spring.
* **Motivo:** Si cualquier validación falla (stock insuficiente, precio no parametrizado en el mercado o error de base de datos), el motor relacional ejecuta un `ROLLBACK` total, liberando los bloqueos sin dejar reservas huérfanas.

---

## 3. Consecuencias

### Positivas
* Protección contra peticiones duplicadas a nivel de infraestructura.
* Trazabilidad fiscal inmutable independiente de la evolución del catálogo.
* Atomicidad absoluta entre la deducción de existencias y la emisión del pedido.

### Compromisos Asumidos
* Los clientes API deben generar identificadores universales únicos (UUID v4) para cada intento de compra.