# Plan: Tarea 5.4 — Devoluciones de Productos

> **Estado**: ✅ APROBADO
> **Fecha**: 2026-10-01
> **Rama**: `feat/product-returns`
> **Origen**: requisito añadido por el usuario durante la revisión de la spec de la Tarea 5.3. Se separó en tarea propia por volumen (§3 del plan).

---

## 1. Objetivos

Permitir al usuario **solicitar la devolución de un producto** comprado, siempre que:

- han pasado **menos de 30 días desde la compra**, y
- el pedido está **`DELIVERED`**, y
- esa línea **aún no tiene devolución**.

---

## 2. Alcance

### Incluido

- Cálculo de **elegibilidad por línea de pedido** (3 condiciones).
- **Solicitud** de devolución con motivo.
- **Registro contable** del importe a reembolsar (`refundAmount`).
- Listado de devoluciones de un pedido.
- UI: botón *«Devolver»* por línea, formulario, y estado de la devolución.

### Excluido explícitamente

| Excluido | Motivo |
|:---|:---|
| **Movimiento real de dinero** | No existe pasarela de pago (PSP) en el proyecto. Ver §5.1 |
| **Aprobación / rechazo por backoffice** | No hay panel de administración. Las transiciones de estado quedan modeladas pero fuera de alcance |
| **Etiqueta de envío de devolución** | Requiere integración con transportista |
| **Reembolso parcial por unidades** | Se reembolsa la línea completa |

---

## 3. ¿Por qué una tarea aparte?

El requisito entró como adición a la **Tarea 5.3 (Historial de Pedidos)**, pero su alcance la duplica:

| | Tarea 5.3 | Tarea 5.4 |
|:---|:---|:---|
| Modelo | sin cambios de esquema | entidad + migración `V9` |
| Endpoints | 2 `GET` | 2 más (`POST`/`GET` returns) |
| Lógica | lectura | validación de 3 condiciones + cálculo monetario |
| UI | listado | botones, formulario, estados |

Dos PRs pequeños y revisables en lugar de uno enorme.

---

## 4. API Endpoints

| Método | Endpoint | Auth | Descripción |
|:---|:---|:---:|:---|
| `POST` | `/api/v1/users/me/orders/{orderNumber}/returns` | ✅ | Solicitar devolución |
| `GET` | `/api/v1/users/me/orders/{orderNumber}/returns` | ✅ | Devoluciones del pedido |

La elegibilidad viaja **dentro del detalle de pedido** (`returnEligible` + `returnIneligibleReason` por línea), sin endpoint propio.

---

## 5. Decisiones de Diseño

### 5.1. El reembolso es un registro contable, no mueve dinero

No hay PSP en el proyecto (`grep Payment|Stripe|PayPal|refund → nada`). Por tanto `refundAmount` es el **importe que se devolvería**, calculado y persistido al solicitar. La spec lo declara como fuera de alcance hasta que exista integración de pagos.

### 5.2. Fecha de referencia = fecha de compra

`Order.createdAt + 30 días`, no la fecha de entrega. Es lo que pide el enunciado literalmente (*«menos de 30 días de la compra»*) y no existe un campo de fecha de entrega.

### 5.3. Una devolución por línea se garantiza en BD

`CONSTRAINT uq_return_per_item UNIQUE (order_item_id)` — la base de datos es la última línea de defensa, igual que la unicidad de la `Idempotency-Key`.

### 5.4. La elegibilidad se calcula en servidor

Fuente única de verdad: el backend decide si una línea es devolvible. El frontend solo pinta lo que llega, evitando que la regla viva en dos sitios.

### 5.5. Ampliación de `OrderStatus` sin migración

`status VARCHAR(32)` es un `VARCHAR` plano, no un enum de Postgres → añadir `SHIPPED` y `DELIVERED` es **solo tocar el enum Java**.

---

## 6. Criterios de Aceptación

- [x] Solo las líneas de pedidos `DELIVERED` con menos de 30 días aparecen como devolvibles
- [x] Una línea ya devuelta no vuelve a ofrecerse
- [x] El importe se calcula con `BigDecimal` / `HALF_UP`
- [x] Un pedido de otro usuario devuelve `404`
- [x] Todo funciona sin mover dinero real
- [x] Tests pasando (backend y frontend)

> Verificado el 2026-10-05: 134 tests backend + 101 frontend en verde, ESLint en baseline.

---

## 7. Estimación

- **Backend**: 3-4 horas
- **Frontend**: 2-3 horas
- **Tests**: 2 horas
- **Total**: 7-10 horas
