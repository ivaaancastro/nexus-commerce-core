# Spec — Tarea 7.2: CRUD de productos, SKUs, variantes e imágenes

> **Fase 7 · Panel de administración** · requisitos (R1–R8) y criterios de aceptación.
> Decisiones de diseño en `plan.md` (D1–D10) · checklist en `tasks.md`.

---

## Resumen

El panel de administración gana su **primera sección real**: la gestión del
catálogo.

- **8 endpoints** bajo `/api/v1/admin/products/**` — heredan `hasRole("ADMIN")`
  de la 7.1 **sin tocar `SecurityConfig`**.
- **«Variante» == SKU** (plan D2): no se crea entidad nueva.
- Borrado **duro con guarda `409`** contra pedidos (plan D4); sin soft-delete.
- Imágenes **siguen estáticas** (3.3): el panel previsualiza y documenta el
  flujo `public/products/` + `npm run images` (plan D5).
- Frontend: `app/admin/layout.tsx` con `AdminRoute` compartido, listado,
  crear, editar + SKUs, y dashboard navegable.

---

## R1 — API de escritura bajo `/api/v1/admin/products`

**Criterio**: la única forma de escribir el catálogo desde HTTP pasa por la
zona admin; los endpoints públicos de lectura no cambian.

| Método y ruta | Éxito | Cuerpo |
|:--|:--|:--|
| `GET /api/v1/admin/products` | `200` | `ProductResponse[]` (con sus `skus`) |
| `POST /api/v1/admin/products` | `201` | `ProductCreateRequest` → `ProductResponse` |
| `GET /api/v1/admin/products/{id}` | `200` | `ProductResponse` |
| `PUT /api/v1/admin/products/{id}` | `200` | `ProductUpdateRequest` (name, family, description) → `ProductResponse` |
| `DELETE /api/v1/admin/products/{id}` | `204` | sin cuerpo |
| `POST /api/v1/admin/products/{id}/skus` | `201` | `SkuCreateRequest` → `SkuResponse` |
| `PUT /api/v1/admin/products/{id}/skus/{skuId}` | `200` | `SkuUpdateRequest` (color, size) → `SkuResponse` |
| `DELETE /api/v1/admin/products/{id}/skus/{skuId}` | `204` | sin cuerpo |

**Criterios de aceptación**

1. Los 8 endpoints responden bajo `/api/v1/admin/products/**` y **las lecturas
   devuelven los DTOs existentes** `ProductResponse`/`SkuResponse` (sin entities).
2. `POST /productos` crea la fila y su producto es visible en el catálogo
   público `GET /api/v1/products` (mismas tablas).
3. `PUT /productos/{id}` cambia `name`, `family` y `description`, y el cambio
   se refleja en `GET /api/v1/admin/products/{id}` y en la vitrina.
4. `POST .../skus` crea el SKU **sin** filas nuevas en `market_prices` ni
   `stock_items` (frontera R5).
5. `SecurityConfig` **no contiene ningún cambio** para esta tarea: los endpoints
   heredan la regla `/api/v1/admin/**` → `hasRole("ADMIN")` (7.1, ADR-0006).
6. `GET /api/v1/products`, `/products/families`, `/products/search` y el
   buscador semántico responden **idéntico a antes** (regresión).
7. **Enmienda de verificación (2026-10-14, R1.2/R1.3)**: la vitrina soporta
   el estado nuevo que habilita esta tarea — un producto **sin SKUs** (nace
   así al crearlo, D9) muestra su ficha con el placeholder y el aviso
   «Sin variantes disponibles todavía», **sin botón de compra**. Sin esto la
   ficha crasheaba con `TypeError: Cannot read properties of null (reading 'id')`
   en `selectedSku!.id`, así que «el producto es visible en la vitrina» no se
   cumplía. Corrección acotada en `products/[reference]/page.tsx` + test de
   regresión; **la R4 «la vitrina no se toca» es de seguridad** (401/403),
   esta enmienda no añade reglas alguna.

---

## R2 — Validación, unicidad e inmutabilidad

**Criterio**: los datos inválidos no llegan a la BD y las claves naturales no
se pueden romper desde un formulario.

- `referenceCode`: `^\d{4}/\d{3}$` · `name`: 1–100 · `family`: `^[A-Z][A-Z0-9_]{1,49}$`
- `barcode`: `^\d{8,20}$`, único · `color`: 1–30 · `size`: 1–10
- `description`: opcional, ≤2000

**Criterios de aceptación**

1. `referenceCode` inválido o fuera de patrón en `POST` → `400` con mensaje claro.
2. `name` vacío o `family` en minúsculas → `400` (validación `jakarta.validation`).
3. `referenceCode` duplicado → `409`; `barcode` duplicado → `409`.
4. **`PUT` de producto no acepta `referenceCode`** y **`PUT` de SKU no acepta
   `barcode`**: los DTOs de actualización **no incluyen** esos campos (inmutabilidad, D3).
5. Recurso inexistente (`{id}` de producto o SKU ajeno) → `404`.
6. Ninguna respuesta expone una entidad JPA (sólo records DTO).

---

## R3 — Borrado seguro contra pedidos

**Criterio**: lo que alguien compró no se puede borrar; lo que nadie compró,
se borra de verdad.

**Criterios de aceptación**

1. `DELETE` de un producto **sin pedidos** → `204` y sus SKUs, precios y stock
   quedan **borrados** por cascada (verificable en BD).
2. `DELETE` de un producto **con algún SKU vendido** (`order_items` referencing)
   → `409` y **no se borra nada** (ni producto ni SKUs ni precios).
3. `DELETE` de un SKU vendido → `409`; de uno no vendido → `204`.
4. Una carrera (pedido entre la guarda y el borrado) se traduce en `409`
   (`DataIntegrityViolationException`), **jamás un `500`** por violación de FK.
5. El mensaje del `409` es claro y en español («no se puede borrar: tiene
   pedidos» o equivalente), sin volcado técnico.

---

## R4 — Seguridad heredada, sin reglas nuevas

**Criterio**: la puerta de la 7.1 protege el CRUD; la vitrina pública no se toca.

**Criterios de aceptación**

1. Cualquiera de los 8 endpoints **sin token** → `401`.
2. Cualquiera de los 8 endpoints **con rol `USER`** → `403`.
3. Cualquiera de los 8 endpoints **con rol `ADMIN`** → su código de éxito.
4. `SecurityRulesTest` cubre los tres caminos al menos en `GET /admin/products`
   y en `POST /admin/products`.
5. Los endpoints públicos (`health`, `markets`, `GET /products/**`, pricing,
   inventory, SpringDoc) siguen respondiendo sin token.

---

## R5 — Frontera con la 7.3: el SKU nuevo no es comprable aún

**Criterio**: declarado, no escondido — el producto es visible y navegable, el
SKU no compra hasta que 7.3 asigne precio y stock.

**Criterios de aceptación**

1. Tras crear un SKU por el panel, `SELECT COUNT(*) FROM market_prices` y
   `stock_items` **no aumentan** (test backend).
2. La ficha pública de ese producto carga **sin error**: sin precio muestra el
   estado «precio no disponible» (comportamiento ya existente del PDP).
3. El catálogo público lista el producto creado con su familia y sus filtros.

---

## R6 — Frontend del panel de administración

**Criterio**: el CRUD se opera desde `/admin` en el navegador, con la
convención editorial y las reglas de frontend (inputs `text-neutral-900`,
errores con `getFriendlyErrorMessage()`, respuestas 204 sin `res.json()`).

- `app/admin/layout.tsx` → `AdminRoute` + `Header` para **todas** las rutas `/admin/**`.
- `/admin/products` → listado (referencia, nombre, familia, nº de SKUs, acciones).
- `/admin/products/new` → formulario de creación.
- `/admin/products/[id]/edit` → edición del producto + sección de SKUs
  (crear, editar, borrar con confirmación).

**Criterios de aceptación**

1. `/admin` muestra el saludo y un **enlace a Productos**; el aviso honesto
   queda sólo para lo que aún no existe (stock, pedidos, usuarios, dashboard).
2. El listado se carga desde `GET /admin/products` y cada «Editar» navega a
   `/admin/products/{id}/edit`.
3. El formulario de crear valida en cliente (patrón de referencia, familia en
   mayúsculas) **antes** de llamar a la API y muestra errores amigables.
4. Guardar muestra **toast de éxito** y actualizar la lista; borrar pide
   confirmación y traduce un `409` a mensaje legible (no crudo).
5. Las rutas `/admin/**` sin sesión → `/login`; con sesión `USER` → `/`
   (`AdminRoute` compartido en el layout, sin duplicarlo por página).
6. La edición muestra `referenceCode` y `barcode` **deshabilitados** (R2.4).
7. `tsc` 0 · ESLint 0/0 · `api.ts` mantiene **≥99** de cobertura.

---

## R7 — Imágenes: previsualización y flujo documentado

**Criterio**: el panel refleja la realidad del manifiesto; nunca inventa imágenes.

**Criterios de aceptación**

1. El detalle de producto muestra su galería desde `getProductImages()`
   (manifiesto) y el **placeholder editorial** cuando no hay entradas — cero 404.
2. La spec no incluye endpoint de subida de imágenes (hereda 3.3 D1/D4).
3. El README documenta el flujo: soltar ficheros en `frontend/public/products/`
   y ejecutar `npm run images`.

---

## R8 — Tests y documentación

**Criterio**: la feature se prueba entera y deja el repositorio en verde.

**Criterios de aceptación**

1. **Backend**: controller MockMvc de los 8 endpoints (códigos de éxito),
   service con guardas de unicidad y borrado (`204`/`409`), seguridad
   `401`/`403`/`200`, y `400` de validación.
2. **Los tests de escritura no ensucian la BD compartida**: ejecutan con
   rollback (`@Transactional`) o limpieza explícita — `CatalogSeedTest`
   («catálogo = 4 referencias») y los E2E siguen pasando.
3. **Frontend**: páginas del panel, formulario (validación y errores), gestión
   de SKUs, y las funciones nuevas de `api.ts` (umbral ≥99).
4. **R8 del proyecto**: ningún test preexistente cambia su aserción **salvo el
   cambio declarado**: `AdminPage.test` se actualiza porque el contenido de
   `/admin` evoluciona a propósito (R6.1).
5. `CHANGELOG.md` en es-ES · bloque «ESTADO ACTUAL» de `AGENTS.md` dentro de la
   feature PR (verdad tras el merge, sin PR/SHA) · `MEMORY.md` actualizado ·
   **sin ADR** (plan D10) · **sin PR de documentación de cierre** (plan D10).
