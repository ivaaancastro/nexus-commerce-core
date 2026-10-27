# Plan: V3 — Wishlist / favoritos

> **Estado**: ⏳ **PENDIENTE DE APROBACIÓN del usuario**
> **Fecha**: 2026-10-26
> **Rama**: `feat/wishlist`
> **Spec**: `specs/wishlist/spec.md`
> **Tarea de la hoja de ruta**: V3 del bloque «Mejoras de vitrina» — *«Wishlist / favoritos — "Guardar" en ficha y catálogo + página de favoritos»*.

---

## 1. Objetivos

- **O1** — **Guardar productos en favoritos con sesión**: una lista por usuario,
  **persistida en el servidor** (sobrevive a otro navegador o dispositivo; sin
  sesión no hay favoritos).
- **O2** — **Corazón en la ficha y en el catálogo**: un botón «Guardar»
  reutilizable en el panel de compra de la PDP **y** en `ProductCard` (catálogo y
  búsqueda heredan el mismo componente), con estado en vivo sincronizado con la
  lista.
- **O3** — **Página `/wishlist`**: listado editorial (imagen por referencia,
  nombre, familia, **precio «desde» del mercado activo**, enlace a la ficha,
  «Quitar»), «Vaciar favoritos» con confirmación, estado vacío y toasts — con
  `ProtectedRoute` (sin sesión → `/login`, patrón de `/orders`, `/profile` y
  `/addresses`).
- **O4** — **Cabecera**: enlace «Favoritos» (con contador `(n)` cuando hay
  artículos) junto a Pedidos/Cuenta, sólo con sesión iniciada.
- **O5** — **Accesibilidad medida**: botones con `aria-pressed` y nombre
  accesible en español, focus visible, iconos lineales de la casa; el gate axe
  **gana** una ruta (**15 → 16**) y el de humo una prueba (**26 → 27**).
- **O6** — **Fronteras limpias**: backend por capas existente con migración
  **V18** (sólo tablas nuevas), **sin ADR** (patrón ya aprobado 7.2–7.6/V15/V17),
  sin tocar checkout, stock, precios ni el panel de administración.

---

## 2. No-Objetivos

- **Favoritos de invitado en `localStorage`**: descartado — creara **dos fuentes
  de verdad** y exigiría un merge al iniciar sesión (¿conflictos?, ¿orden?).
  La sesión ya es requisito del checkout; la lista la es también aquí.
- **Guardar precios en la BD (snapshot)**: el usuario aprobó la spec pidiendo
  que los precios **aparezcan** en la lista (2026-10-26) y aparecen — pero
  **frescos**, pedidos a `/pricing` con el mercado activo al abrir la página y
  al cambiar de mercado (D13). Lo que queda prohibido es congelarlos: es la
  lección del re-precificado del carrito.
- **Mover a la bolsa directamente desde la lista**: añadir exige elegir
  talla/color (y eso lo resuelve la PDP); el CTA de la fila es «Ver producto».
- **`?next=` de retorno tras el login**: `ProtectedRoute` redirige a `/login`
  sin parámetro y añadirlo tocaría el flujo de autenticación completo.
- Notificaciones de reposición, listas compartidas/públicas, cap de artículos,
  paginación, sincronía offline, admin de favoritos desde el panel.
- Corazón en resultados de la búsqueda **semántica de texto suelto** cuando no
  use `ProductCard` (donde no hay tarjeta no hay corazón; se documenta).

---

## 3. Decisiones de Diseño

### D1 — Persistencia en servidor: una wishlist por usuario (V18)

- **`V18__wishlist.sql`** crea `wishlists` y `wishlist_items` (**nada existente
  se modifica**: sin `UPDATE`, sin tocar usuarios/pedidos; `IF NOT EXISTS`
  reejecutable, patrón V13–V17).
- `wishlists`: `id`, `user_id UNIQUE NOT NULL` (FK → `users` **ON DELETE
  CASCADE**), `created_at`. La unicidad de `user_id` **es** la garantía de «una
  lista por usuario» — la última línea de defensa contra duplicados (patrón
  idempotencia §4.3).
- `wishlist_items`: `id`, `wishlist_id` (FK CASCADE), `product_id` (FK →
  `products` **ON DELETE CASCADE**), `added_at`, **`UNIQUE(wishlist_id,
  product_id)`** — un producto no puede estar dos veces en la misma lista.
- **`ON DELETE CASCADE` en producto** (no `RESTRICT`): el panel ya puede borrar
  productos que alguien guardó (7.2) y bloquear el catálogo por un favorito
  sería peor mal; el cascade deja la lista siempre coherente y **sin fantasmas**.
- **El `GET` no crea la fila** (lectura sin efectos): un usuario que nunca
  guardó nada recibe `items: []` sin escribir en BD. El `POST` crea la wishlist
  si no existe (*get-or-create* perezoso).

### D2 — Se guarda el **producto** (la referencia), no el SKU/variante

- Tallas, colores y su stock cambian; guardar un SKU congelaría un estado que el
  catálogo puede retirar. La PDP ya resuelve variante + precio al añadir a la
  bolsa (selector de color/talla de `color-and-care`).
- Consecuencias coherentes: dos tallas de la misma prenda son **un** favorito, y
  el corazón de la tarjeta (que no tiene tallas) apunta al mismo nivel.

### D3 — Seguridad: `/api/v1/wishlist/**` autenticada (1 línea, patrón `/users`)

- `SecurityConfig` gana `.requestMatchers("/api/v1/wishlist/**").authenticated()`
  **antes** de `anyRequest().denyAll()` — sin esa regla el `denyAll` de la 6.4
  la cerraría también a sesión iniciada (lección 7.1).
- **Usuario actual = `Authentication.getName()` (email)**, patrón exacto de
  `UserOrderController`/`OrderService`: el servicio resuelve el `User` por email
  (`UserRepository`). Sin token → **401** (entry point JSON existente).
- **Sin cambios de rol**: USER y ADMIN guardan favoritos como clientes; el
  admin no gestiona favoritos ajenos (fuera de alcance).

### D4 — API: 4 endpoints, idempotencia amable, sin 409

| Método y ruta | Comportamiento |
|:---|:---|
| `GET /api/v1/wishlist` | `200` con los items (**`addedAt` DESC**); sin fila propia devuelve lista vacía; **sin efectos secundarios** |
| `POST /api/v1/wishlist/items` `{productId}` | Producto nuevo → **`201`** con el item; **ya existente → `200` con el mismo item y sin fila nueva** (idempotente); producto inexistente → **`404`** (`ResourceNotFoundException` existente) |
| `DELETE /api/v1/wishlist/items/{productId}` | **`204` siempre** — quitar algo que no está no es un estado que al usuario le importe; el botón de corazón nunca necesita comprobar antes |
| `DELETE /api/v1/wishlist` | **`204`** — vacía la lista (idempotente) |

- **Por qué no `409` en el duplicado** (a diferencia de stock/pedidos): la
  wishlist es una **preferencia**, no un recurso transaccional; un conflicto
  obligaría al cliente a gestionar un estado inexistente. La unicidad real está
  en BD (`UNIQUE`) y el `POST` la traduce a idempotencia.
- **Sin paginación** (el catálogo tampoco la tiene, D10 de la 3.1) y **sin
  cap**: una lista de favoritos real es pequeña; se documenta como límite.
- Respuesta de item: `{ id, addedAt, product: ProductResponse }` — **sin
  importes en la API**: el precio se pide fresco a `/pricing` por SKU con el
  mercado activo (D13), nunca se snapshota.

### D5 — Se reutiliza `ProductResponse` completo; un DTO mínimo sería una segunda definición

- Mismo precedente que `AdminOrderDetailResponse` componiendo `OrderResponse`:
  **una sola definición** de la ficha de producto (con `skus` y
  `careInstructions`), y el cliente reutiliza el tipo `Product` existente sin
  duplicar contratos. El catálogo es pequeño: el peso extra es irrelevante.

### D6 — `WishlistContext`: server-backed al patrón de `AuthContext`, **sin `localStorage`**

- Estado: `items` + `isHydrated`. **Se carga con `GET` cuando hay sesión**
  (`isAuthenticated && !isLoading`) y **se vacía al `logout`**; sin sesión, la
  lista vive vacía y el corazón redirige a login (D7).
- **Sin `setState` síncrono en el cuerpo del efecto** (regla
  `react-hooks/set-state-in-effect`): cadena de promesa como `AuthContext`
  (`.then/.catch/.finally`).
- **Sin localStorage**: el servidor es la única fuente de verdad (D1); un caché
  local sería exactamente el merge que D2-No-Objetivos descarta.
- **Sin actualizaciones optimistas**: las mutaciones esperan la respuesta y
  pintan el estado que devolvió el servidor (el estado queda exacto aunque otra
  pestaña haya cambiado la lista); un fallo **deja el estado anterior** y el
  componente pinta el toast de error (`getFriendlyErrorMessage`, regla de casa).
- Fallo de hidratación (p. ej. token caducado): lista vacía **sin romper** la
  página; `/wishlist` ofrece «Reintentar» (R7).

### D7 — `WishlistButton`: un solo componente para PDP y tarjeta

- Cliente, botón con **`aria-pressed`** (true = guardado), nombre accesible en
  español («Guardar {nombre} en favoritos» / «Quitar {nombre} de favoritos»),
  icono lineal stroke 1.5 de la casa, **relleno cuando está guardado**,
  `transition-all duration-300` y focus visible.
- **PDP**: en el panel de compra, junto a «Añadir a la bolsa» (misma fila en
  escritorio, envuelve en móvil — el panel ya usa `flex-wrap`).
- **Tarjeta**: corazón **superpuesto arriba-derecha de la imagen** como
  **hermano** del enlace — **nunca un botón dentro de un `<Link>`** (interactividad
  anidada inválida y trampa de a11y). Como vive en `ProductCard`, catálogo y
  búsqueda lo heredan sin duplicar nada.
- **Sin sesión → `router.push("/login")`** (mismo trato que el checkout, que
  exige sesión); tras entrar, el usuario vuelve a la ficha a mano (sin `?next=`,
  No-Objetivos).
- El botón se renderiza siempre y su estado sale del contexto (ya en memoria):
  **sin destellos de red** ni *hydration mismatch* (el servidor no conoce la
  sesión).

### D8 — `/wishlist`: cliente con `ProtectedRoute`, patrón del historial de pedidos

- Título editorial **«FAVORITOS»** + lista vertical: miniatura con `ProductImage`
  (**aspecto reservado**, resuelta por referencia desde el manifiesto — **cero
  404**), nombre, familia, referencia, enlace **«Ver producto»** a la PDP
  (**URL codificada**: `0432/021` → `0432%2F021`, lección medida de
  `color-and-care`) y botón «Quitar».
- **«Vaciar favoritos» con `window.confirm`** (patrón 7.4/7.5) y **toast en la
  propia página** (estado local, patrón `orders/[orderNumber]` — no hay
  `ToastProvider` global y no hace falta uno).
- Estado vacío editorial con enlace a `/catalog`. Errores de red → mensaje
  amigable + «Reintentar»; nunca un crash.
- **Sin paginación**; el orden lo manda el servidor (`addedAt` DESC).

### D9 — Cabecera: «Favoritos» con contador, sólo con sesión

- Enlace en el grupo de sesión junto a Pedidos/Cuenta, con **«(n)» cuando
  n > 0** (contador del contexto, sin peticiones nuevas). El `flex-wrap` de la
  6.1 ya absorbe el ancho; el **E2E responsive de 390 px se re-mide** con el
  enlace puesto (regla: la medición manda).

### D10 — Gates ampliados, sin supresiones

- **axe 15 → 16**: `a11y.spec.ts` añade `/wishlist` al grupo «sesión iniciada».
- **E2E 26 → 27**: humo de la lista — login → PDP → corazón → `/wishlist` lo
  lista → «Quitar» → vacío. Sin `waitForTimeout` en specs (estilo de casa).
- **Lighthouse intacto** (4 rutas, sin rutas nuevas auditadas).

### D11 — Tests (medidos, no supuestos)

- **Backend** (~+30 → ≈410): `WishlistServiceTest` (unitario, Mockito: sin fila
  → vacío · add crea wishlist+item · **add duplicado no crea fila** · delete
  idempotente · producto inexistente → `ResourceNotFoundException` · orden
  `addedAt` DESC) · `WishlistControllerTest` (MockMvc: 4 endpoints + validación
  del body) · **integración contra PostgreSQL real** (`@SpringBootTest`,
  patrón `EmailOutboxTransaccionalTest`: unicidad del `UNIQUE` medida, cascade
  al borrar producto) · **`SecurityRulesTest` +2** (GET/POST sin token → 401).
- **Frontend** (~+18 → ≈509): `WishlistContext.test` (hidrata con sesión, se
  vacía al logout, mutaciones, error) · `WishlistButton.test` (estado/aria,
  sin sesión → login, error → toast) · `WishlistPage.test` (lista, vaciar con
  confirm, vacío, reintentar, **precios: «desde» con mínimo, re-fetch al
  cambiar de mercado y «No disponible en este mercado»**) · `ProductCard`
  **aditivo** (corazón presente, no anidado en el enlace; aserciones
  preexistentes intactas, R8.3 declarada si toca) · **`api.ts` ≥ 99 % por
  fichero** (umbral congelado 6.3): los 4 métodos nuevos cubiertos.

### D12 — Fronteras y proceso

- **Sin ADR**: capas/stack existentes; es una decisión de producto sobre un
  patrón ya aprobado (precedente: 7.2–7.6, V15, V17 — todos «sin ADR»).
- Sin cambios en checkout, stock, precios, catálogo admin, búsqueda ni
  imágenes; `git diff main` lo prueba al cierre.
- **Guía de Next 16.3.7 leída antes de código** (bloque
  `frontend/AGENTS.md` obligatorio).
- Estado redactado **en la feature PR** (verdad tras el merge, sin PR/SHA)
  ⇒ **sin PR de documentación de cierre** (convención D11).
- Ciclo SDD completo: plan + spec **aquí** → **aprobación** ⛔ → tasks → código
  → `/spec-check` → gates → docs.

### D13 — Precios en la lista: frescos por mercado, nunca guardados *(decisión del usuario, 2026-10-26)*

- El usuario aprobó la spec pidiendo que **los precios aparezcan** en la lista.
  La decisión de producto es **mostrarlos sin guardarlos**: la wishlist sigue sin
  tener columnas de importes ni la API envía precios (D5 íntegro).
- **Fuente**: el endpoint público **ya existente**
  `GET /api/v1/pricing/{skuId}?market=` (`api.getPrice`), el mismo del carrito —
  **cero cambios de backend** por este requisito.
- **Regla de producto**: precio **«desde»** = **mínimo `finalPrice` entre los
  SKUs del producto** en el mercado activo (convención retail para producto
  multivariante; si todas las tallas cuestan lo mismo, «desde» es inocuo y,
  cuando difieren, **nunca miente**).
- **Dónde se piden**: en **`/wishlist` (la página)**, no en el contexto global —
  el corazón y el contador de la cabecera no necesitan precio, y así una sesión
  con favoritos no dispara N peticiones en cada carga de página.
- **Cambio de mercado ⇒ re-fetch** (patrón 3.2/R6): el efecto depende de
  `marketCode`, igual que el re-precificado del carrito.
- **Sin precio en el mercado activo** para ningún SKU → la fila muestra
  **«No disponible en este mercado»** (mismo trato que `priceUnavailable` del
  carrito); imagen, nombre y acciones siguen operativos.
- Presentación: **`Intl.NumberFormat` + la moneda del mercado** (regla de casa:
  jamás el símbolo `€` literal en `src/`, lección `TaxCopy`), con
  **`currencyDisplay: "narrowSymbol"`** — medido en Node y Chromium: por defecto
  `es-ES` imprime GBP como **código** («79,99 GBP») y EUR como símbolo («79,95 €»),
  quedando la lista a mixtas; `narrowSymbol` unifica a símbolo en todos los
  mercados («79,99 £») sin escribir un solo símbolo en el código
  (**aprobado por el usuario 2026-10-26**), **sin desglose
  impositivo** en la lista (la nota «Impuestos incluidos» vive en la PDP y el
  carrito; la lista es un resumen).
- Mientras el precio no resuelve, la línea muestra un **«…»** estable (hueco
  sin CLS — la fila ya está fijada por la miniatura de aspecto reservado); al
  responder se pinta el importe o el aviso de mercado.

---

## 4. Ficheros previstos

| Fichero | Acción |
|:---|:---|
| `backend/.../db/migration/V18__wishlist.sql` | **nuevo** — `wishlists` + `wishlist_items` (D1) |
| `backend/.../entity/Wishlist.java`, `WishlistItem.java` | **nuevos** |
| `backend/.../repository/WishlistRepository.java` | **nuevo** — con `JOIN FETCH` de items+producto (sin N+1) |
| `backend/.../dto/WishlistResponse.java`, `WishlistItemResponse.java`, `WishlistAddRequest.java` | **nuevos** (D4/D5) |
| `backend/.../service/WishlistService.java` | **nuevo** — get-or-create, idempotencia, cascade (D1/D4) |
| `backend/.../controller/WishlistController.java` | **nuevo** — 4 endpoints, `@Tag`/`@Operation` (D3/D4) |
| `backend/.../config/SecurityConfig.java` | **modificado** — 1 línea `authenticated()` (D3) |
| `backend/.../security/SecurityRulesTest.java` | **ampliado** — +2 (401 sin token) |
| `backend/src/test/.../WishlistServiceTest.java`, `WishlistControllerTest.java`, `WishlistTransaccionalTest.java` | **nuevos** (D11) |
| `frontend/src/types/commerce.ts` | **modificado** — `WishlistItem`/`Wishlist` |
| `frontend/src/lib/api.ts` | **modificado** — `getWishlist`, `addWishlistItem`, `removeWishlistItem`, `clearWishlist` |
| `frontend/src/context/WishlistContext.tsx` | **nuevo** (D6) |
| `frontend/src/components/WishlistButton.tsx` | **nuevo** (D7) |
| `frontend/src/components/ProductCard.tsx` | **modificado** — corazón superpuesto, hermano del enlace (D7) |
| `frontend/src/app/wishlist/page.tsx` | **nuevo** (D8/D13 — pinta y re-pide precios por mercado activo) |
| `frontend/src/components/Header.tsx` | **modificado** — enlace + contador (D9) |
| `frontend/src/__tests__/WishlistContext.test.tsx`, `WishlistButton.test.tsx`, `WishlistPage.test.tsx` | **nuevos**; `ProductCard`/`api` **ampliados** (D11) |
| `frontend/e2e/a11y.spec.ts` (+1), `e2e/smoke.spec.ts` (+1) | **ampliados** (D10) |
| `CHANGELOG.md`, `AGENTS.md`, `MEMORY.md` | al cierre |

**Sin tocar**: `ProductImage`, `ProductGallery`/`ProductLightbox`, checkout,
stock, precios, `next.config`, manifiesto/imágenes, `public/`.

---

## 5. Estimación

- Tamaño: **M** (recurso nuevo de usuario completo: backend + frontend + página).
- Bloques: V18 + backend (D1–D5) · contexto + botón (D6/D7) · página + cabecera
  (D8/D9) · tests (D11) · gates axe/E2E (D10) · docs de cierre.
- Riesgos: **cabecera a 390 px** (re-medida del E2E responsive) · **`ProductCard`
  sin regresión** (los tests de catálogo deben pasar intactos) · **umbral
  `api.ts` ≥ 99** (los 4 métodos nuevos van cubiertos) · **carrera del
  get-or-create** (serializada con **bloqueo pesimista de la fila de usuario**,
  §4.2 — el `UNIQUE(user_id)` es la última línea de defensa; nunca un 500).
