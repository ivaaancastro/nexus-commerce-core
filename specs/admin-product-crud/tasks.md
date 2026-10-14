# Tasks — Tarea 7.2: CRUD de productos, SKUs, variantes e imágenes

> **Fase 7 · Panel de administración** · spec `spec.md` (R1–R8) · plan `plan.md` (D1–D10).
> Un checkbox por unidad terminada; las decisiones y hallazgos quedan como nota
> debajo de su bloque. **Regla**: marcar al completar; nada de código fuera de
> este checklist.

---

## A — DTOs, validación y excepción de conflicto (R2, plan D7/D8)

- [x] **A.1** `ProductCreateRequest` (record + `jakarta.validation`): `referenceCode` `^\d{4}/\d{3}$`, `name` 1–100, `family` `^[A-Z][A-Z0-9_]{1,49}$`, `description` opcional ≤2000
- [x] **A.2** `ProductUpdateRequest`: **sin `referenceCode`** (inmutable, D3) — sólo `name`, `family`, `description`
- [x] **A.3** `SkuCreateRequest`: `barcode` `^\d{8,20}$`, `color` 1–30, `size` 1–10
- [x] **A.4** `SkuUpdateRequest`: **sin `barcode`** (inmutable, D3) — sólo `color`, `size`
- [x] **A.5** Excepción de dominio `CatalogConflictException` + handler en `GlobalExceptionHandler` → `409` con mensaje claro en español (patrón de `InsufficientStockException`)

## B — Servicio y controller admin (R1, R2, R3, R5)

- [x] **B.1** `AdminProductService.listar()` → todos los productos con SKUs (`@Transactional(readOnly = true)`)
- [x] **B.2** `crear(ProductCreateRequest)`: unicidad de `referenceCode` (previa → `CatalogConflictException`; carrera `DataIntegrityViolationException` → mismo 409)
- [x] **B.3** `obtener(id)` → `404` si no existe · `actualizar(id, ProductUpdateRequest)` sólo `name`/`family`/`description`
- [x] **B.4** `borrar(id)`: guarda de `order_items` sobre los SKUs del producto → `409` si vendido; si no, DELETE real (cascadas SKUs → precios → stock)
- [x] **B.5** SKUs: `crearSku(productId, …)` (404 producto · 409 barcode dup · **sin tocar `market_prices`/`stock_items`**), `actualizarSku` (404 sku ajeno/inexistente), `borrarSku` (guarda `order_items` → 409)
- [x] **B.6** `AdminProductController` con los 8 endpoints bajo `/api/v1/admin/products` (`@Tag`, `@Operation`, devuelven DTOs existentes `ProductResponse`/`SkuResponse`)
- [x] **B.7** `SecurityConfig` **sin ningún cambio** — verificar por diff que la ruta hereda `hasRole("ADMIN")` (plan D1)

## C — Tests backend (R4, R8)

- [x] **C.1** `AdminProductControllerTest` (MockMvc, `@SpringBootTest`): 8 endpoints con sus códigos de éxito (`200/201/204`)
- [x] **C.2** Validación → `400` (referencia mal formada, familia en minúsculas, name vacío) · `404` (id inexistente, SKU ajeno) · unicidad → `409` (reference duplicada, barcode duplicado)
- [x] **C.3** Borrado: sin pedidos → `204` + cascadas verificadas en BD · con pedidos → `409` sin borrar nada · SKU vendido → `409`
- [x] **C.4** Frontera 7.3: crear SKU no aumenta `market_prices` ni `stock_items` (R5.1)
- [x] **C.5** `SecurityRulesTest` (+3): `GET` y `POST /admin/products` → `401` sin token, `403` USER, `200`/`201` ADMIN · públicos intactos
- [x] **C.6** **BD compartida limpia**: los tests de escritura usan `@Transactional` (rollback) o limpieza en `@AfterEach` — `CatalogSeedTest` y E2E siguen verdes sin restos
- [x] **C.7** `./mvnw test` en verde con la suite completa (204+)

## D — Frontend: cliente y tipos (R6, R8.7)

- [x] **D.1** `types/commerce.ts`: tipos admin (`ProductAdminSummary`/form payloads) sin duplicar `Product`/`Sku` existentes
- [x] **D.2** `lib/api.ts`: 8 funciones admin (`listAdminProducts`, `createAdminProduct`, `updateAdminProduct`, `deleteAdminProduct`, `createAdminSku`, `updateAdminSku`, `deleteAdminSku`, `getAdminProduct`) con `getAuthHeaders()`; toleran `204`/body vacío (regla frontend 8)

## E — Frontend: panel (R6, R7)

- [x] **E.1** `app/admin/layout.tsx`: `AdminRoute` + `Header` para **todas** las rutas `/admin/**` (sin duplicar por página); simplificar `admin/page.tsx`
- [x] **E.2** `/admin`: saludo + enlace a Productos + aviso honesto sólo para lo que falta (stock/pedidos/usuarios/dashboard) — **cambio declarado** respecto a la 7.1 (R8.4)
- [x] **E.3** `/admin/products`: listado (referencia, nombre, familia, nº SKUs, acciones Editar/Borrar con confirmación) + «Nuevo producto»
- [x] **E.4** `/admin/products/new`: formulario con validación espejo en cliente, toast de éxito, errores con `getFriendlyErrorMessage()`
- [x] **E.5** `/admin/products/[id]/edit`: edición del producto (**referencia deshabilitada**) + sección de SKUs (crear/editar/borrar con confirmación; **barcode deshabilitado** en edición) + traducción de `409` a mensaje legible
- [x] **E.6** Galería de imágenes del producto en modo sólo lectura desde `getProductImages()` con placeholder (R7.1)
- [x] **E.7** Inputs con `text-neutral-900`, estilo editorial, `tsc` 0, ESLint 0/0

## F — Tests frontend (R6, R8.3)

- [x] **F.1** `AdminProductsPage.test.tsx`: carga el listado, navega a editar, borra con confirmación, traduce `409`
- [x] **F.2** `AdminProductForm.test.tsx`: validación en cliente, envío válido → toast + navegación, error API → mensaje amigable
- [x] **F.3** `AdminProductEditPage.test.tsx` (o integrada): SKUs crear/editar/borrar, campos inmutables deshabilitados
- [x] **F.4** `Api.test.ts`: URLs, métodos y auth de las 8 funciones nuevas — **`api.ts` ≥ 99**
- [x] **F.5** `AdminPage.test.tsx` actualizado al nuevo `/admin` (cambio declarado, R8.4) + `AdminRoute`/`Header` siguen en verde
- [x] **F.6** `npm run test:coverage` EXIT 0 con umbrales congelados (306+)

## G — Documentación y cierre (R8.5, plan D10)

- [x] **G.1** `CHANGELOG.md` — entrada en Keep a Changelog es-ES
- [x] **G.2** `README`: flujo de imágenes (`public/products/` + `npm run images`) y reindex manual tras cambios de catálogo (plan D6)
- [x] **G.3** Bloque «ESTADO ACTUAL» de `AGENTS.md` **dentro de la feature PR** (verdad tras el merge, sin PR/SHA) + `MEMORY.md` con la tarea marcada
- [x] **G.4** **Sin ADR** (plan D10) · **sin PR de documentación de cierre**

## Cierre

- [x] **Baselines**: `./mvnw test` **204+** · `npm run test:coverage` **306+** y EXIT 0 (globales 77/76/74/79 + `api.ts` ≥ 99 — **`npx vitest run` no evalúa umbrales**) · `tsc` 0 · ESLint 0/0 · `npm run build` 0 · E2E local (Chromium+WebKit) verde
- [x] **Verificación en navegador**: como ADMIN — crear producto, verlo en la vitrina con placeholder, crear SKU (ficha dice «precio no disponible»), editarlo, intentar borrar un producto vendido → `409` traducido, borrar el creado → OK · como USER — `/admin/products` redirige a `/`
- [x] **BD compartida**: tras los tests, `CatalogSeedTest` sigue viendo exactamente las 4 referencias y la BD de dev sin restos
- [x] `/spec-check admin-product-crud` → aprobado
- [x] **Preguntar al usuario antes de cualquier commit y PR** ⛔ — aprobado 2026-10-14

---

## Notas de implementación

_(decisiones menores, hallazgos y desviaciones — se anotan aquí al ejecutar)_

- **A.5+ (derivada de R2.1/R2.2)**: `GlobalExceptionHandler` gana además un
  handler de `MethodArgumentNotValidException` → `400` con `message`
  («campo: mensaje» en español). Sin él, la respuesta por defecto de Spring
  **no lleva `message`** (`server.error.include-message` nunca) y ni el panel
  ni el cliente podrían traducir el fallo de validación. Los tests
  preexistentes sólo asercionan `isBadRequest()` → R8 intacta.
- **D.5 interpretado**: tras crear un producto, el **toast se muestra en el
  propio formulario** y el alta queda lista para la siguiente; el listado se
  refresca siempre al abrirse (`cache: "no-store"`). Una navegación
  automática desmontaría el toast antes de verlo.
- **F.5**: el test de redirección con rol USER de `AdminPage.test` se **mueve**
  a `AdminLayout.test.tsx` (nuevo): desde E.1 la puerta vive en
  `app/admin/layout.tsx`, no en la página. La cobertura no se pierde, se
  reubica — `AdminRoute.test.tsx` sigue intacto.
- **`errors.ts`** gana dos ramas necesarias para la spec (sin cambiar ninguna
  aserción previa): `400` → mensaje de campo del servidor (fallback «Revisa
  los datos del formulario») y `409` con `code: "CATALOG_CONFLICT"` → mensaje
  del backend (si no, diría «No queda stock suficiente», que sería falso).
  +4 tests nuevos en `Errors.test.ts`.
- **Componentes compartidos**: `AdminProductForm` (crear/editar, E.4+E.5) y
  `AdminSkuSection` (alta/edición inline/borrado de SKUs) — la página de
  edición queda como orquestadora (carga, galería, zona peligrosa, toast).
- **Enmienda R1.7 (bug encontrado en la verificación en navegador)**: la
  vitrina (`/products/[reference]`) crasheaba con `TypeError … reading 'id'`
  para un producto **sin SKUs** — estado que la 7.2 habilita (D9: el producto
  se crea antes que sus variantes) y que antes era inalcanzable porque todos
  los productos de las migraciones nacen con SKUs. Fix acotado: guardas en el
  selector de tallas y en el bloque de compra (`selectedSku ? … : aviso`),
  **test de regresión nuevo** en `ProductDetailPage.test.tsx` y enmienda
  declarada en `spec.md` (R1.7). La R4 «la vitrina pública no se toca» es de
  **seguridad**, no de UI — ninguna regla nueva.
