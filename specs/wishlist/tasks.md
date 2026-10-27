# Tasks: V3 — Wishlist / favoritos

> **Estado**: EN CURSO
> **Fecha**: 2026-10-26
> **Rama**: `feat/wishlist`
> **Spec aprobada**: `specs/wishlist/spec.md` (R1–R11) · plan D1–D13 (D13 = precios
> por decisión del usuario, confirmada 2026-10-26)

## Backend

- [x] B1 — `V18__wishlist.sql`: `wishlists` (user_id UNIQUE FK CASCADE) + `wishlist_items` (FK CASCADE ×2 + `UNIQUE(wishlist_id, product_id)`), `IF NOT EXISTS`, comentario de cabecera al estilo V15/V17
- [x] B2 — Entidades `Wishlist` y `WishlistItem` (patrón `@Getter/@Setter/@Builder`, `@Builder.Default` donde haga falta)
- [x] B3 — `WishlistRepository` con carga **sin N+1** (`JOIN FETCH` de items+product) y `findByUserId`
- [x] B4 — DTOs: `WishlistAddRequest` (`@NotNull productId`), `WishlistItemResponse { id, addedAt, product }`, `WishlistResponse { items }`
- [x] B5 — `WishlistService`: `get` sin efectos · `add` get-or-create serializado con **bloqueo pesimista de la fila de usuario** (`findByEmailForUpdate`, §4.2) + idempotencia (existente → 200 sin fila nueva) · `removeItem` 204 idempotente · `clear`; orden `addedAt` DESC; `ResourceNotFoundException` si el producto no existe
- [x] B6 — Mapeo a `ProductResponse` **reutilizado** (localizar el mapper existente y exponerlo package-visible si hace falta, patrón `mapToOrderResponse`)
- [x] B7 — `WishlistController`: 4 endpoints con `Authentication.getName()` (email), `@Tag`/`@Operation`, códigos 201/200/204 (D4)
- [x] B8 — `SecurityConfig`: `.requestMatchers("/api/v1/wishlist/**").authenticated()` **antes** del `denyAll` (1 línea, D3)
- [x] B9 — `./mvnw test` verde con lo que haya nuevo hasta el momento

## Frontend

- [x] F0 — Leer las guías de Next 16.3.7 relevantes (`node_modules/next/dist/docs/`) — obligatorio del bloque `frontend/AGENTS.md` (R11.2)
- [x] F1 — `types/commerce.ts`: `WishlistItem` (con `product: Product`) y `Wishlist`
- [x] F2 — `api.ts`: `getWishlist`, `addWishlistItem(productId)`, `removeWishlistItem(productId)`, `clearWishlist` (con `getAuthHeaders`; 204 ya tolerado por `handleResponse`)
- [x] F3 — `WishlistContext.tsx` (D6): hidrata con `GET` al tener sesión (cadena de promesa, sin setState síncrono), se vacía al logout, mutaciones **sin optimistas** que lanzan al fallar
- [x] F4 — Montar `WishlistProvider` en `layout.tsx` (orden con Market/Cart/Auth, patrón existente)
- [x] F5 — `WishlistButton.tsx` (D7): `aria-pressed`, nombre accesible «Guardar/Quitar … en favoritos», icono lineal 1.5 relleno al guardado, sin sesión → `router.push("/login")`, error → propaga para toast
- [x] F6 — PDP: `WishlistButton` en el panel de compra junto a «Añadir a la bolsa» (envuelve en móvil)
- [x] F7 — `ProductCard.tsx`: corazón **hermano** del enlace (nunca dentro), superpuesto arriba-derecha de la imagen; catálogo y búsqueda heredan (R6)
- [x] F8 — `/wishlist/page.tsx` (D8/D13): `ProtectedRoute`, lista con `ProductImage` por manifiesto, precios «desde» (mínimo por SKU, re-fetch al cambiar de mercado, «No disponible en este mercado»), «Ver producto» `%2F`, «Quitar», «Vaciar» con `window.confirm`, vacío con enlace a `/catalog`, «Reintentar», toasts locales
- [x] F9 — `Header.tsx`: enlace «Favoritos» + «(n)» cuando n > 0, sólo con sesión (D9)

## Tests backend

- [x] T1 — `WishlistServiceTest`: get sin fila → vacío · add crea wishlist+item · **add duplicado no crea fila** · remove idempotente · clear · producto inexistente → 404 · orden DESC
- [x] T2 — `WishlistControllerTest` (MockMvc): 4 endpoints, códigos 201/200/204, `400` sin `productId`, 401 sin token vía SecurityRules
- [x] T3 — `WishlistTransaccionalTest` (`@SpringBootTest`, PG real): unicidad medida (duplicado → 1 fila), cascade al borrar producto, get sin side effects
- [x] T4 — `SecurityRulesTest` +2: `GET` y `POST /api/v1/wishlist/**` sin token → **401**
- [x] T5 — `./mvnw test` verde (~410)

## Tests frontend

- [x] T6 — `WishlistContext.test`: hidrata con sesión · sin sesión no pide · logout limpia · mutaciones reflejan la respuesta · error propaga sin romper
- [x] T7 — `WishlistButton.test`: guardar/quitar (aria-pressed) · sin sesión → `/login` sin `POST` · error de red → el caller recibe la excepción (toast)
- [x] T8 — `WishlistPage.test`: lista pintada · «Quitar» · «Vaciar» con confirm · estado vacío · «Reintentar» · **precios: «desde» = mínimo, re-fetch con mercado nuevo, «No disponible en este mercado»**
- [x] T9 — `ProductCard` ampliado: corazón presente y **fuera** del `<a>`; aserciones preexistentes intactas (R8.3 declarada si cambia un import)
- [x] T10 — `api.ts`: los 4 métodos cubiertos (umbral por fichero ≥ 99)
- [x] T11 — `npm run test:coverage` verde, umbrales ≥ congelados

## Gates

- [x] G1 — `npx tsc` 0 · `npm run lint` 0/0 · `npm run build` 0
- [x] G2 — cobertura frontend EXIT 0 (77/76/74/79 + api 99)
- [x] G3 — backend `./mvnw test` en verde medido: **405 tests** (380 → 405, +25)
- [x] G4 — stack levantado: `npm run audit:a11y` **16/16** · `npm run test:e2e:quick` **28/28** (medido: el plan estimaba 27 = 26 + 1 humo, pero +1 axe también entra en quick: 26 + 1 + 1)
- [x] G5 — verificación medida en navegador (script temporal, borrado): 18/18 OK — corazón fuera de <a> · round-trip en tarjeta · contador (1)→vacío · misma fila en PDP (add y=793 · corazón y=793) · «Desde 79,95 €» → UK «Desde 79,99 £» (narrowSymbol, re-fetch medido) → vuelta a ES · quitar + vacío tras recarga · móvil 390 px sin scroll en /catalog, PDP y /wishlist (desborde=0px, corazón cabe: x=315 w=38)
- [x] G6 — `/spec-check wishlist` → **APROBADO** (47/47 requisitos, 2026-10-26: backend 405 · frontend 518)

## Docs

- [x] H1 — `CHANGELOG.md` (entrada V3 arriba de la V2 dentro de `[Unreleased]`, con cifras medidas)
- [x] H2 — `AGENTS.md` (tabla: 405/518, humo 6 + axe 16, V4 siguiente; bloque «Decisiones V3 `wishlist`»; línea «Mergeado»)
- [x] H3 — `MEMORY.md` (tabla: 405/518, V3 completada; entrada V3 en el bloque de vitrina)
- [ ] H4 — Pedir permiso commit/push/PR (regla de oro) y mergear al verde
