# Spec: V3 — Wishlist / favoritos

> **Estado**: ⏳ **PENDIENTE DE APROBACIÓN del usuario**
> **Fecha**: 2026-10-26
> **Plan**: `specs/wishlist/plan.md` (D1–D12)
> **Rama**: `feat/wishlist`

---

## 1. Requisitos

### R1 — Persistencia en servidor: una wishlist por usuario (V18)

- **R1.1** — `V18__wishlist.sql` crea `wishlists` y `wishlist_items` con
  `IF NOT EXISTS` (reejecutable). **Ninguna tabla existente se modifica**: sin
  `ALTER` de datos ni `UPDATE`.
- **R1.2** — `wishlists.user_id` es **`UNIQUE NOT NULL`** con FK → `users` y
  **`ON DELETE CASCADE`**; `wishlist_items` tiene FK a `wishlist` y a `products`
  **ambas `ON DELETE CASCADE`**, y **`UNIQUE(wishlist_id, product_id)`**.
- **R1.3** — `GET /wishlist` **no crea fila** (lectura sin efectos): usuario sin
  wishlist → `items: []`. El `POST` crea la wishlist si no existe.
- **R1.4** — Borrar un producto desde el panel (7.2) **limpia sus favoritos** por
  cascade; el `GET` jamás devuelve un producto inexistente.

### R2 — Se guarda el producto, no el SKU

- **R2.1** — El ítem identifica un **`productId`** (la referencia comercial);
  no se guarda talla/color/precio ni ningún dato de SKU.
- **R2.2** — Guardar el mismo producto dos veces **no duplica** el ítem (unicidad
  medida en BD y servida como idempotencia, D4).

### R3 — API (4 endpoints, idempotencia amable)

- **R3.1** — `GET /api/v1/wishlist` → `200` `WishlistResponse { items }` con
  `WishlistItemResponse { id, addedAt, product: ProductResponse }`, ordenado por
  **`addedAt` DESC. Sin importes en la API**: el precio que se ve en la página
  se pide fresco a `/pricing` con el mercado activo (R7.6) — la wishlist
  **jamás snapshota precios**.
- **R3.2** — `POST /api/v1/wishlist/items` con body `{ productId }`:
  ítem nuevo → **`201`**; **ya existente → `200` con el ítem existente y sin fila
  nueva**; producto inexistente → **`404`**.
- **R3.3** — `DELETE /api/v1/wishlist/items/{productId}` → **`204` siempre**
  (idempotente: exista o no el ítem).
- **R3.4** — `DELETE /api/v1/wishlist` → **`204`**; vacía la lista sin borrar la
  fila de `wishlists` (idempotente).
- **R3.5** — Sin paginación y sin cap de artículos (el catálogo tampoco pagina,
  D10 de la 3.1); queda **escrito como límite conocido**.
- **R3.6** — Los 4 endpoints llevan `@Tag` y `@Operation` (documentación OpenAPI
  de casa, §9.4).

### R4 — Seguridad: autenticada, sin cambios de rol

- **R4.1** — `SecurityConfig` declara
  `.requestMatchers("/api/v1/wishlist/**").authenticated()` **antes** de
  `anyRequest().denyAll()`.
- **R4.2** — Sin token → **`401`** en los 4 endpoints (entry point JSON
  existente); **`SecurityRulesTest` lo cubre** con +2 pruebas.
- **R4.3** — El usuario actual sale de **`Authentication.getName()` (email)**
  y se resuelve a `User` en el servicio (patrón `UserOrderController`). Un
  usuario **nunca** lee ni escribe la lista de otro (no hay endpoint por id de
  usuario).
- **R4.4** — `USER` y `ADMIN` usan el mismo flujo (el rol no cambia nada aquí);
  no existe ninguna operación admin sobre favoritos ajenos.

### R5 — `WishlistButton` en la ficha (PDP)

- **R5.1** — El panel de compra de `/products/[reference]` incluye el botón
  **junto a «Añadir a la bolsa»** (misma fila en escritorio, envuelve en móvil).
- **R5.2** — Con sesión: pulso ⇒ `POST` ⇒ rellena; pulso relleno ⇒ `DELETE` ⇒
  vacía; estado **`aria-pressed`** siempre correcto y nombre accesible en
  español («Guardar {nombre} en favoritos» / «Quitar {nombre} de favoritos»).
- **R5.3** — **Sin sesión ⇒ `router.push("/login")`** y ningún `POST` se emite.
- **R5.4** — Fallo de red: el estado **no cambia** y se pinta un **toast** con
  `getFriendlyErrorMessage()`; el botón queda operativo para reintentar.

### R6 — `WishlistButton` en la tarjeta (catálogo y búsqueda)

- **R6.1** — `ProductCard` muestra el corazón **superpuesto arriba-derecha de la
  imagen**, implementado como **hermano** del enlace — **nunca** un `<button>`
  dentro de un `<Link>`/`<a>`.
- **R6.2** — Catálogo (`/catalog`) y búsqueda (`/search`) heredan el botón por
  usar `ProductCard`; sin sesión el pulso lleva a `/login` igual que en la PDP.
- **R6.3** — La imagen, el enlace, los `sizes`, el `eager` de la primera fila y
  todo el comportamiento de tarjeta **quedan intactos**: los tests de catálogo
  preexistentes pasan **sin tocar aserciones** (R8.3 declarada si un import
  cambia).

### R7 — Página `/wishlist`

- **R7.1** — `/wishlist` es una ruta de cliente envuelta en **`ProtectedRoute`**
  (sin sesión → `/login`, carga visible mientras resuelve, patrón de
  `/orders`/`/profile`).
- **R7.2** — Cada fila pinta: miniatura con **`ProductImage`** (aspecto
  reservado, fuente del manifiesto por referencia — **cero 404**), nombre,
  familia, referencia, **«Ver producto»** → la PDP con la URL **codificada**
  (`%2F`) y **«Quitar»** (borrón de la fila con su toast).
- **R7.3** — **«Vaciar favoritos»** con **`window.confirm`** (patrón 7.4/7.5);
  confirmado ⇒ `DELETE` total ⇒ toast y lista vacía.
- **R7.4** — Estado vacío editorial con enlace a **`/catalog`**; el orden visible
  es el del servidor (`addedAt` DESC), **sin ordenar ni paginar en cliente**.
- **R7.5** — Error de red en la carga: mensaje amigable + botón **«Reintentar»**
  (la hidratación del contexto no rompe la página, D6); toasts **en la propia
  página** (estado local, patrón `orders/[orderNumber]` — sin `ToastProvider`).
- **R7.6** — **Precios en la lista** *(decisión del usuario, 2026-10-26)*:
  - **R7.6.1** — Cada fila muestra el precio **«desde»** del producto en el
    **mercado activo**: **mínimo `finalPrice` entre sus SKUs**, pedido al
    endpoint existente `GET /api/v1/pricing/{skuId}?market=`
    (`api.getPrice`) — **cero endpoints nuevos** y la API de wishlist sigue
    sin enviar importes (R3.1).
  - **R7.6.2** — Los precios se piden **en la página `/wishlist`** (no en el
    contexto global) y se **re-piden al cambiar de mercado** (dependencia de
    `marketCode`, patrón de re-precificado del carrito, 3.2 R6).
  - **R7.6.3** — Presentación con **`Intl.NumberFormat` + moneda del
    mercado** (prohibido el símbolo `€` literal en `src/`, regla `TaxCopy`);
    **sin desglose impositivo** en la lista.
  - **R7.6.4** — Ningún SKU con precio en ese mercado → **«No disponible en
    este mercado»** en esa fila; imagen, nombre y acciones siguen operativos.
  - **R7.6.5** — **Sin importes congelados en ningún sitio**: ni en BD, ni en
    `localStorage`, ni en el estado del contexto (sólo en el estado de la
    página, que se descarta al navegar).

### R8 — Cabecera

- **R8.1** — Con sesión iniciada, el grupo Pedidos/Cuenta gana el enlace
  **«Favoritos»** (ruta `/wishlist`) con **«(n)» cuando n > 0** — contador
  derivado del contexto, **sin peticiones nuevas**.
- **R8.2** — Sin sesión no aparece el enlace (la ruta, protegida, ya redirige).
- **R8.3** — **A 390 px no hay scroll horizontal** con el enlace puesto: el E2E
  responsive existente pasa con la cabecera modificada (la medición manda).

### R9 — Accesibilidad y gates ampliados

- **R9.1** — Todos los controles nuevos con nombre accesible en español,
  `aria-pressed` donde aplica, focus visible y `transition-all duration-300` de
  la casa; iconos lineales `stroke-width` 1.5; **`text-neutral-900`** en
  cualquier input (si lo hubiera — no lo hay).
- **R9.2** — **axe 15 → 16**: `a11y.spec.ts` añade `/wishlist` (con sesión) al
  mismo estilo que las rutas actuales, **sin supresiones** (`axe.exclude()` y
  `disableRules` prohibidos).
- **R9.3** — **E2E 26 → 27**: prueba de humo login → PDP → corazón →
  `/wishlist` → «Quitar» → vacío; localizadores por rol/label y **sin
  `waitForTimeout`**.
- **R9.4** — Lighthouse **sin cambios** (las 4 rutas auditadas no se tocan).

### R10 — Sin regresiones

- **R10.1** — `git diff main` **sin cambios** en checkout, stock, precios,
  panel admin, imágenes/manifiesto ni `ProductLightbox`.
- **R10.2** — **Backend 380 → ≈410** y **frontend 491 → ≈509** tests; ESLint
  **0/0**, `tsc` 0, build 0 y cobertura **≥ umbrales congelados**
  (77/76/74/79 + `api.ts` ≥ 99 por fichero).
- **R10.3** — `/spec-check wishlist` → **APROBADO** antes del cierre.

### R11 — Fronteras de proceso

- **R11.1** — **Sin ADR**: patrón por capas y stack existentes (precedente
  7.2–7.6, V15, V17).
- **R11.2** — Guía de **Next 16.3.7** leída antes de código (bloque
  `frontend/AGENTS.md`).
- **R11.3** — Estado redactado en la feature PR ⇒ **sin PR de documentación de
  cierre**; CI intocado (los gates de E2E/axe corren en los jobs existentes).

---

## 2. API

| Método | Ruta | Auth | Éxito | Errores |
|:---|:---|:---|:---|:---|
| `GET` | `/api/v1/wishlist` | sesión | `200` `WishlistResponse` | `401` |
| `POST` | `/api/v1/wishlist/items` | sesión | `201` (nuevo) · `200` (ya existente) | `401` · `400` (body inválido: sin `productId`) · `404` (producto inexistente) |
| `DELETE` | `/api/v1/wishlist/items/{productId}` | sesión | `204` siempre | `401` |
| `DELETE` | `/api/v1/wishlist` | sesión | `204` | `401` |

```jsonc
// GET /api/v1/wishlist · 200
{
  "items": [
    { "id": 7, "addedAt": "2026-10-26T12:00:00Z",
      "product": { "id": 1, "referenceCode": "0432/021", "name": "Blazer Cruzada Estructura",
                   "description": "…", "family": "Blazers", "skus": [ /* SkuResponse[] */ ],
                   "careInstructions": "…" } }
  ]
}

// POST /api/v1/wishlist/items · body
{ "productId": 1 }
```

## 3. Modelo de Datos (V18)

```sql
CREATE TABLE IF NOT EXISTS wishlists (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id          BIGSERIAL PRIMARY KEY,
    wishlist_id BIGINT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wishlist_product UNIQUE (wishlist_id, product_id)
);
```

## 4. Criterios de Aceptación (gates medidos)

| Gate | Cómo se mide | Resultado esperado |
|:--|:--|:--|
| Backend tests | `./mvnw test` | ≈410 (380 + ≈30), verdes |
| Frontend tests | `npm run test:coverage` | ≈509 (491 + ≈18), umbrales ≥ 77/76/74/79 y `api.ts` ≥ 99, EXIT 0 |
| ESLint / tsc / build | `npm run lint` · `npx tsc` · `npm run build` | 0 / 0 / 0 |
| axe | `npm run audit:a11y` | **16/16** |
| E2E | `npm run test:e2e:quick` | **27/27** |
| Seguridad medida | `SecurityRulesTest` | +2 pruebas `401` sin token |
| Unicidad medida | integración PG real | `POST` duplicado ⇒ **1 fila**; borrar producto ⇒ favoritos limpios |
| Fronteras | `git diff main --name-only` | sin checkout/stock/precios/admin/imágenes |
| Cabecera móvil | E2E responsive 390 px | sin scroll horizontal |

## 5. Casos de Error

| Caso | Comportamiento |
|:--|:--|
| Sin token (los 4 endpoints) | `401` JSON (entry point existente); en cliente, el corazón redirige a `/login` antes de emitir nada |
| `POST` con `productId` inexistente | `404` (`ResourceNotFoundException` existente) → toast amigable, estado intacto |
| `POST` con body ausente o sin `productId` | `400` (validación jakarta `@NotNull` + handler existente) |
| Doble `POST` (doble clic, dos pestañas) | segundo → `200` con el ítem existente; **1 fila** en BD (m medida) |
| `DELETE` de un ítem que no existe | `204` (idempotente); el cliente no asume nada |
| Producto borrado por el admin con favoritos | cascade: los ítems desaparecen; el `GET` no los devuelve |
| Logout con la lista cargada | el contexto se vacía; otro usuario que entre **no** ve la lista anterior (hidratación por sesión) |
| Token caducado en la hidratación | `catch` silencioso → lista vacía; `/wishlist` ofrece «Reintentar» |
| Fallo de red en mutación | estado previo intacto + toast con `getFriendlyErrorMessage()` |
| Producto sin ningún SKU con precio en el mercado activo | la fila de `/wishlist` muestra «No disponible en este mercado»; el resto sigue operativo (R7.6.4) |
| Cambio de mercado con la lista abierta | los precios se re-piden con el nuevo mercado (R7.6.2); ninguno queda congelado |
| Carrera del get-or-create (2 pestañas) | serializada con **bloqueo pesimista de la fila de usuario** (§4.2): no se crean dos listas; el `UNIQUE(user_id)` queda como última línea de defensa; **nunca un 500** |
