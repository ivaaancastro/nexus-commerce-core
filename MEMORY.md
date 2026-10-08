# MEMORY.md — Nexus Commerce Core

> **Archivo de memoria persistente para agentes IA y desarrolladores.**
> Este archivo consolida todo el contexto del proyecto para mantener continuidad entre sesiones.
> Se actualiza al completar tareas o cuando hay cambios importantes.

---

## Estado Actual

| Aspecto | Valor |
|:---|:---|
| **Rama actual** | `main` (todo commiteado) |
| **Fase actual** | Fase 5 (**completada**) · 3.1 — Familias y Filtros (**completada**) · 3.2 — Mercado y Divisa (**completada**) · 3.3 — Galería de Imágenes (**completada**) · 4.1 — Suite de Pruebas y Cobertura (**completada**) · 4.2 — Test E2E con Playwright (**completada**) · 4.3 — Auditoría CWV y Accesibilidad (**completada**) |
| **Tarea actual** | Sin tarea activa — pendiente definir la siguiente |
| **Estado** | **165 backend + 270 frontend** · ESLint **0 errores, 0 warnings** · cobertura frontend congelada en **77 / 76 / 74 / 79** (medida real 78.01 / 76.32 / 74.72 / 79.85) · `tsc --noEmit`, `npm run build` (14 rutas) y `vitest` en verde · **E2E: 5 humo × 3 navegadores + 14 axe** · **axe 14/14 sin hallazgos** · **Lighthouse en verde en 4 rutas** · prueba manual 390/768/1440 con consola limpia |
| **Pendiente** | **Ninguno** — con la 4.3 cerrada, **la Fase 4 queda completa**; las fases registradas no tienen tareas abiertas |
| **Última actualización** | 2026-10-08 |

---

## Resumen del Proyecto

**Nexus Commerce Core** es un backend transaccional de alto rendimiento para retail global, con frontend editorial en Next.js.

### Stack
- **Backend**: Spring Boot 3.4 + Java 21 + PostgreSQL 16 + pgvector
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Auth**: Spring Security + JWT + BCrypt
- **Email**: Mailtrap (desarrollo) / SendGrid (producción)

---

## Tareas Completadas

### Fase 1 — Resiliencia UI
- [x] Tarea 1.2 — Skeletons de Carga y Error Boundaries

### Fase 2 — Carrito de Compra
- [x] Tarea 2.1 — Estado Global de la Bolsa (CartContext)
- [x] Tarea 2.2 — Cajón Lateral de la Bolsa (Cart Drawer)
- [x] Tarea 2.3 — Checkout Multilínea con selección automática de almacén

### Fase 3 — Experiencia Editorial
- [x] **Tarea 3.1 — Navegación por Familias y Filtros** — ✅ **cerrada 2026-10-06** · PR **#19** (`bf7339c`) · spec `specs/catalog-family-filters/` · **26/26 criterios**
  - [x] Backend: `GET /api/v1/products/families` (público, `SELECT family, COUNT(*)` contando **productos**) y `GET /api/v1/products?family=&size=&color=&sort=` con **filtrado en backend** y **AND** — `size`/`color` exigen **el mismo SKU** (un único `EXISTS` con params anulables), `sort` es un enum → `400`, familia desconocida → `200 []`. Sin paginación (D10).
  - [x] `V12__catalog_navigation_seed.sql` — 3 productos, 4 SKUs, 16 precios, 8 stock, todo `ON CONFLICT DO NOTHING` → idempotente, + índice `idx_products_family`. BD de 1 → 4 productos.
  - [x] Semántica filtra por `family` (R9) vía `filterExpression`, **validado** con `existsByFamily` y rechazo de comillas; **`maxPrice` retirado** (se recibía y se ignoraba → documentaba algo que el código no hacía).
  - [x] Frontend: `/` portada editorial con 3 accesos · `/search` con la semántica **migrada** · `/catalog` con columna lateral + panel «Filtrar», **un solo `CatalogFilters`** para ambas · `Header` con `<Link>` reales.
  - [x] Tests: **+22 backend** (165) y **+24 frontend** (171) · `/spec-check` **10/10** · prueba manual sin mensajes de consola, checkout `POST /orders/checkout` → **201**.
  - ⚠️ **2 bugs encontrados en la prueba manual y corregidos con su test**: el punto final del mensaje amigable se concatenaba con la pista técnica («*minutos**..** Asegúrate*») y el contador decía «1 prendas».
  - ⚠️ **`Map<String,Long>` no está soportado por Spring Data en `@Query`** → `List<Object[]>` + mapeo en el service.
  - ⚠️ **La primera versión de `CatalogFilters` reseteaba los demás filtros al cambiar de campo**, lo que hacía inalcanzable `family + size` aunque el backend combinara con AND. Ahora cada opción sólo toca su campo.
  - ⚠️ **Limitación anotada**: sin `OPENAI_API_KEY` local, la semántica devuelve `500` (fallback `mock-key` preexistente en `main`) → `/search` enseña su estado de error; el filtro se verifica en test unitario y `family` inválida sí se comprueba en vivo (`200 []`).
- [x] **Tarea 3.2 — Selector Dinámico de Mercado y Divisa** — ✅ **cerrada 2026-10-06** · PR **#17** (`3214502`) · spec `specs/market-currency-selector/`
  - [x] Backend: `GET /api/v1/markets` público (`MarketController` + `MarketService` + `MarketResponse`), `permitAll()` en `SecurityConfig`
  - [x] Migración `V11__complete_market_price_matrix.sql` — completa la matriz 8/8 (los seeds de V1 solo cubrían talla M en ES/UK/CH, así que **US y la talla L devolvían 404**); `ON CONFLICT DO NOTHING` → idempotente
  - [x] Frontend: `MarketContext` (objeto completo en `localStorage["nexus-market"]`, default `ES`, reset ante JSON corrupto o código desconocido) + `<select>` accesible en `Header` que no se pinta sin lista
  - [x] Precios y checkout con el mercado activo; ficha con `Promise.allSettled` → «No disponible en {mercado}» si el SKU no tiene precio en ese mercado (el stock sigue visible)
  - [x] Re-precificado del carrito (D2) con `applyRepriceToItems` estable y `isRepricing` **derivado**; artículo sin precio **se conserva** marcado y bloquea el checkout (D6)
  - [x] Copy «IVA» → «Impuestos» (4 sitios) + **R8b aprobado**: el «50€» del envío gratuito pasó a `50 {currency}`
  - [x] Tests: **+4 backend** (143) y **+22 frontend** (147) · `/spec-check` **10/10** · prueba manual en navegador (ES/UK/US/CH, checkout real `{"marketCode":"US"}` → 201, orden `ORD-E5AD5491` inalterada al cambiar a CH)
  - ⚠️ **Impacto transversal**: el `<select>` añade un 2º `combobox` → `waitForAddressSelected()` busca por nombre accesible; la aserción R9 mira el importe completo, no la divisa suelta
  - ⚠️ **Desviación documentada**: `useMarket()` usa el valor por defecto de `createContext` en vez de lanzar error (el estado degradado es correcto: sin provider no hay lista y no se pinta el selector)
  - ⚠️ **Fuera de alcance**: `addresses/page.tsx` mantiene `countryCode` fijo por defecto (es una dirección, no de mercado)
- [x] **Tarea 3.3 — Galería de Imágenes Responsive** — ✅ **cerrada 2026-10-07** · spec `specs/gallery-responsive/`
  - [x] Imágenes **estáticas en `public/products/`** (D1): 3 WebP 1200×1600 por referencia, **backend sin tocar** (D4). Manifiesto `src/data/product-images.json` importado **estáticamente** por `getProductImages()` — sin `fetch` (D2).
  - [x] `npm run images` (`scripts/generate-product-images.mjs` + `sharp@^0.35.5`) descubre las referencias **de las migraciones**; **idempotente** (verificado con `shasum`); cubre las 4 refs sembradas (D3).
  - [x] `ProductImage`: caja `aspect-[3/4]` + `<Image fill sizes>` → espacio reservado antes de descargar; fallback a `ProductThumb` si no hay manifiesto o falla la carga → **cero 404** (D8).
  - [x] `ProductGallery` + ficha reescrita en `md:grid-cols-12`: galería 7 col, panel de compra 5 col con `sticky top-24`, `self-start`, `max-h` + `overflow-y-auto`, descripción bajo la galería. **Orden del DOM galería → compra → descripción** en las 3 anchuras, sin reordenar con CSS (D5).
  - [x] `sizes` derivado del ancho **real medido** de la caja (4 tramos, redondeo hacia arriba) → el navegador pide siempre el bucket mínimo; `EAGER_CARDS = 3` y `EAGER_IMAGES = 2` para el LCP; **sin `priority`** (D7).
  - [x] Tests: **+35 frontend** (206) — 4 ficheros nuevos (`product-images`, `generate-product-images`, `ProductImage`, `ProductGallery`) + 5 ampliados · `tsc`, `build` y ESLint 3 preexistentes en verde · **R10: `git diff main` no toca `backend/`**.
  - [x] Prueba manual en **390/768/1440**: 1→2 columnas, `sticky` a `top: 96px`, scroll interno del panel con viewport de 480 px, `srcset` de 15 anchos servido por `/_next/image`, atrás y recarga conservando `?family=`, **consola sin errores ni avisos de `next/image`**.
  - ⚠️ **2 bugs encontrados en la prueba manual, cada uno con su test**: (1) el aviso de LCP de Next — con cajas del mismo tamaño el LCP se resuelve por un **empate de pintado**, así que hace falta `eager` en **toda la primera fila**, no sólo en la primera imagen; (2) el `sizes` de la galería apuntaba al ancho del contenedor (278 px) en vez de la imagen (276 px) y esos 6 px cruzaban el bucket 828→1080 a DPR3.
  - ⚠️ **CLS medido**: 0.000 en 390px, 0.011 en 1440px y 0.039 en 768px — **ninguna fuente es una imagen**: precios y stock ATS llegan en peticiones posteriores y hacen crecer el panel de 473 a 680 px, arrastrando a la descripción. Todo por debajo de 0.1.
  - ⚠️ **`/search` no verificable en navegador**: sin `OPENAI_API_KEY` la semántica devuelve `500` (limitación preexistente); cubierto por `SearchPage.test.tsx` y por el mismo `ProductCard` verificado en `/catalog`.
  - ⚠️ **Preexistente observado** (fuera de alcance): el `nav` del `Header` no tiene `flex-wrap` ni breakpoint y desborda horizontalmente por debajo de ~560 px — `Header.tsx` está sin cambios vs `main`.

### Fase 4 — Calidad Enterprise
- [x] **Tarea 4.1 — Suite de Pruebas Unitarias de Componentes** — ✅ **cerrada 2026-10-07** · spec `specs/component-test-suite/`
  - [x] **Alcance acordado con el usuario (D1)**: sólo **tests + cobertura + CI** — sin E2E ni rendimiento. Los **10 módulos sin test directo** + `AuthContext.test.tsx` nuevo: `CatalogFilters`, `CartItemRow`, `AddToCartButton`, `SemanticSearchBar`, `Toast`, `OrderStatusBadge`, `CartIcon`, `hooks/useLocalStorage`, `lib/utils`, `lib/checkout`.
  - [x] Tests: **206 → 270 frontend** (27 → 38 ficheros); backend intacto en **165**.
  - [x] **`@vitest/coverage-v8@^5.0.3`** (alineado con el major de Vitest) + script `npm run test:coverage`. Informe `text` + `html` + `lcov`, con `include: ["src/**/*.{ts,tsx}"]` para que entre también lo que ningún test importa (`lib/api.ts` al 20.77 %).
  - [x] **Umbrales medidos y congelados (D4)**: **77 / 76 / 74 / 79** sobre la medida real **78.01 / 76.32 / 74.72 / 79.85** (base: 76.36 / 76.22 / 70.89 / 78.19). **No es un 90 impuesto**: el contrato es «esta cobertura no baja».
  - [x] **Comprobación negativa**: `statements: 100` a propósito ⇒ `npm run test:coverage` sale con **EXIT=1** ⇒ revertido.
  - [x] **ESLint 3 errores + 4 warnings → 0 y 0**, sin un solo `eslint-disable` (verificado con `grep`).
  - [x] CI: job de frontend `npx vitest run` → `npm run test:coverage` + `upload-artifact` (`if: always()`, `coverage-report`, `frontend/coverage/`).
  - ⚠️ **D5b reabierta en curso, como preveía R8**: la primera solución a `useLocalStorage` (lectura en `queueMicrotask`) pasaba el lint pero **rompía R8** — `CartContext.test` y `CartPage.test` perdían el valor persistido en el primer render. Descartado `useLayoutEffect` (la regla también lo prohíbe) y adoptado **`useSyncExternalStore`**: el valor llega síncrono, el SSR se resuelve con `getServerSnapshot` y el carrito/marcado se sincroniza **entre pestañas**. Contrato del hook intacto: `[storedValue, setValue, isHydrated] as const`.
  - ⚠️ **Ningún test preexistente cambió su aserción** — los 206 originales siguen idénticos.
  - ⚠️ **`all: true` ya no existe en Vitest 5** (`tsc` lo rechaza con `TS2769`): se retiró y el `include` explícito hace el trabajo; la cifra es idéntica con y sin ella.
  - ⚠️ **Excepción documentada a R7**: el test «la confirmación desaparece sola a los 2500 ms» usa `fireEvent` — user-event v14 se cuelga con los temporizadores falsos de Vitest (4 combinaciones probadas). El resto del fichero usa `userEvent`.
  - ⚠️ **Prueba manual**: `/profile` sin sesión → `/login` ✓ · carrito con 1 artículo **sobrevive a la recarga** ✓ · toast de devolución «DEVOLUCIÓN SOLICITADA · 79.95 EUR» **se cierra solo a los 2689 ms** ✓ · consola sin errores ni avisos de hidratado. Para llegar al flujo se pasó el pedido local `ORD-6DB9E249` a `DELIVERED` en la BD de desarrollo (dato local, no toca el repo).
  - ⚠️ **R9/R10**: `git diff main` **no toca `backend/`** · **sin ADR** (tooling de desarrollo) · **sin PR de documentación de cierre** (D11).
- [x] **Tarea 4.3 — Auditoría Core Web Vitals y Accesibilidad** — ✅ **cerrada 2026-10-08** · spec `specs/cwv-accessibility-audit/`
  - [x] **Dos puertas en sitios distintos (D3)**: **axe dentro de `e2e-tests`** (el `testDir: "./e2e"` sin `testMatch` ya recoge `e2e/a11y.spec.ts`, **sin job propio**) sobre **14 rutas y sólo Chromium** (D5, `test.skip` con motivo); **Lighthouse en job propio `cwv-audit`**, en paralelo y **sin `needs:`**.
  - [x] **Presupuesto medido y congelado (D1)** — peor mediana por ruta: **LCP 3 041 ms · CLS 0,000 · TBT 46 ms · perf 94 · a11y 100** (dispersión ±50-100 ms en LCP, CLS siempre `0.000`). Umbrales: **LCP ≤ 3 500 · CLS ≤ 0,05 · TBT ≤ 100 · perf ≥ 90 · a11y ≥ 95**, escritos en `spec.md R3`.
  - [x] **`aggregationMethod: "median-run"` puesto a mano**: LHCI evalúa por defecto en **`optimistic`** (la *mejor* de las 3 corridas), lo que habría dejado sin efecto D4 (*tres tomas y mediana*).
  - [x] **⚠️ La INP no se congela porque no es medible (D8)**: Lighthouse 12 trae `interaction-to-next-paint-insight` con **`score: null` y sin `numericValue`**, y su perf incluye `max-potential-fid` (**obsoleto**). Se gatea **`total-blocking-time` como proxy, dicho explícitamente** — presentarlo como INP sería mentir (D9: no hay despliegue, luego no hay datos de campo).
  - [x] **`scripts/lighthouse.mjs`**: `CHROME_PATH = chromium.executablePath()` — el **mismo Chrome for Testing** de los E2E, sin navegador extra (R1) y sin rutas de máquina. **`npm run audit:cwv` es idéntico en local y en CI**.
  - [x] **Dos fallos que sólo se vieron al salir de mi máquina**:
    - **CI: `No usable sandbox!`** — Ubuntu 24.04 restringe los *user namespaces* con AppArmor. Playwright **ya lanza Chromium sin sandbox de serie** (`chromiumSandbox: false` → `--no-sandbox`) y por eso los E2E pasaban en ese mismo runner; LHCI sólo transmite lo que hay en `collect.settings`. Añadido **`chromeFlags: "--no-sandbox"`**. El gate se caía **antes de medir**, no era un fallo de umbrales.
    - **Local: midió un build que nadie eligió** — `startServerCommand` no puede bindear un puerto ocupado, LHCI **no falla** y mide lo que haya escuchando. Costó **LCP 6 998 ms** frente a 3 057 de la corrida limpia. Ahora el script **comprueba el puerto y aborta** con `exit 1`. Y el comando documentado era **falso**: `pkill -f "next start"` no mata nada, el proceso se llama **`next-server`**.
  - [x] **Presupuesto verificado en CI** (12 informes del artefacto): peor mediana **LCP 3 079 · CLS 0,000 · TBT 88 · perf 94 · a11y 100**. **LCP coincide con local a ±40 ms** (D1 aguanta cruzando de SO). **TBT es el más apretado (88 de 100)** porque mide CPU compartida del runner — 0 de 12 corridas superaron 100, máx. 93. **Se mantiene ≤ 100 por sensibilidad** (decisión del usuario): con ≤ 150 una regresión real de +30 ms se quedaría en verde.
  - [x] **🩺 Diagnóstico (D6)**: las 14 rutas en rojo con **sólo 2 reglas** — `color-contrast` (**serious**, 33 elementos, ratios **2,36–2,79** vs. 4,5) y `heading-order` (moderate, 1). **Causa raíz única: `text-neutral-400`** sobre fondos claros.
  - [x] **Corrección acotada**: `text-neutral-400` → **`text-neutral-600`** en **46 líneas de 15 ficheros**, sustituyendo **todas** las ocurrencias de base (no sólo las medidas). **`neutral-500` se descarta con dato**: 4,74 / 4,54 / **4,35** en `#f5f5f5`; `neutral-600` da 7,82 / 7,49 / 7,17.
  - [x] **El único caso no tocado**: `app/page.tsx:120` conserva `group-hover:text-neutral-400` — la tarjeta editorial se oscurece en hover y ahí el gris claro es el correcto.
  - [x] **`heading-order`**: `<h3>` → `<h2>` en `ProductCard` (siempre tras `<h1>`); `CartItemRow` se dejó porque su jerarquía ya es correcta.
  - [x] **Verificación**: axe **14/14 con 0 hallazgos** · **270/270 sin que ningún test preexistente cambiara** · `tsc` 0 · ESLint 0/0 **sin `eslint-disable`** · **`backend/` sin tocar** · **0 hallazgos descartados**.
  - [x] **Comprobación negativa del gate**: umbrales congelados → `exit 0`; LCP forzado a `maxNumericValue: 1000` → **`exit 1` en las 4 rutas**, con `expected`/`found` en el log. **Un gate que no se ha visto fallar no es un gate.**
  - [x] CI: job `cwv-audit` espejo de `e2e-tests` (servicio pgvector, override `SPRING_DATASOURCE_*` en el paso que lanza el backend, readiness con volcado de log, `playwright install --with-deps chromium`), informe **`if: always()`**; los 3 jobs previos **byte-idénticos a `main`**.
  - ⚠️ **`reuseExistingServer: !process.env.CI` es trampa local**: un `next start` colgado sirve el **build viejo** y la auditoría dio verde sobre HTML con `text-neutral-400` tras el cambio. Detectado y documentado; **en CI no puede pasar**.
  - ⚠️ **Baselines**: `git diff main -- backend/` **vacío** · 270 tests · cobertura **78.01 / 76.32 / 74.72 / 79.85** (sin moverse) · build 0 · **24 passed + 14 skipped** en local · **sin ADR** · **sin PR de documentación de cierre** (D11).
  - ⚠️ **Cabo suelto de la 4.2 cerrado**: `specs/e2e-playwright/tasks.md:96` pasó a `[x]`.

### Fase 5 — Gestión de Usuarios (EN CURSO)
- [x] Tarea 5.1 — Registro y Login
  - [x] Backend: Entidades, repositorios, seguridad JWT, AuthService, AuthController
  - [x] Frontend: AuthContext, páginas login/register/verify-email/forgot-password
  - [x] Tests: 38 backend + 27 frontend
  - [x] Email: Mailtrap configurado
  - [x] Flujo completo verificado end-to-end: registro → email → código → login con JWT
- [x] Tarea 5.2 — Perfil de Usuario y Direcciones
  - [x] Backend: `UserService`, `AddressService`, `SizeRecommendationService`, `UserController`
  - [x] Frontend: `/profile`, `/addresses`, `ProtectedRoute`
  - [x] Tests: 84 backend + 44 frontend
  - [x] Specs: `specs/user-profile/` completa (plan, spec, tasks)
  - [x] Commit `0cf6116` + PR #10 — CI 2/2 green (backend 84, frontend 44)
  - [x] Cobertura: UserController 100%, UserService 100%, AddressService 98,6%, SizeRecommendationService 88,6%
  - [x] PR #11 — fix de puntos de entrada de verificación de email (`fix/verify-email-entry-points`)
    - [x] Enlaces en ambos emails + `app.base-url`, enlace directo y botón contextual en `/login`
    - [x] Reglas #7 y #9 corregidas, `htmlFor`/`id` en los 16 labels de auth
    - [x] 90 backend + 54 frontend · `EmailService` 100% líneas y ramas
- [x] Tarea 5.3 — Historial de Pedidos — **PR #12 mergeado en `main`** (`cd9ca74`, 2026-10-05)
  - [x] Specs: `specs/user-orders/` (plan, spec, tasks) ✅ aprobada el 2026-10-01
  - [x] Backend: `UserOrderController`, `OrderSummaryResponse`, `OrderPageResponse`, `listOrders` / `getOrderForUser`
  - [x] Asociación de usuario al checkout: `OrderController` pasa `Authentication`, `OrderService.resolveUser()` setea `Order.user`
  - [x] `OrderStatus` gana `SHIPPED` y `DELIVERED` (sin migración: la columna es `VARCHAR(32)`)
  - [x] Pertenencia comprobada en la consulta → «no existe» y «es de otro usuario» devuelven ambos `404`
  - [x] Frontend: `/orders` con tarjetas, `OrderStatusBadge`, paginación, `ProtectedRoute`, enlace «Pedidos» en el header
  - [x] Tests: 90 → **106** backend, 54 → **65** frontend · cobertura **82,6 %**
  - [x] e2e verificado contra la BD: checkout deja `user_id`, historial ordenado, `404` ajeno, `401` sin token
  - [x] Bugs preexistentes corregidos: `403`→`401` sin credencial, `500`→`401` con token malformado
  - [x] `globals.css`: eliminado el bloque `prefers-color-scheme: dark` heredado de create-next-app (dejaba `--foreground: #ededed` sobre fondos claros → textos invisibles; afectaba al logo del header en todas las páginas)
  - [x] Specs 5.4 (`specs/product-returns/`) escritas y aprobadas en paralelo
- [x] Fix de checkout 401 (`specs/checkout-auth/`) — **PR #13 mergeado en `main`** (`8704dff`, 2026-10-05)
  - [x] **Decisión: el checkout requiere sesión** — sin `permitAll` en `/api/v1/orders/checkout`; el carrito no emite la petición y muestra «Inicia sesión para completar tu compra»
  - [x] `api.checkout()` / `api.getOrder()` no enviaban `Authorization` (bug preexistente desde su creación)
  - [x] 9 páginas pintaban `err.message` crudo → traducidas con `getFriendlyErrorMessage()`
  - [x] `getFriendlyErrorMessage()` anclado al prefijo `API Error [n]` con `isHttpStatus()`, y reglas nuevas para `401/403/404/409`
  - [x] Código muerto de checkout en la PDP eliminado (`handleCheckout`, `checkoutLoading`, imports residuales)
  - [x] Tests: backend 106 · frontend 88
- [x] Tarea 5.4 — Devoluciones de Productos (`specs/product-returns/`) — **mergeada en `main` (PR #14, `136c584`, 2026-10-05)**
  - [x] Specs: `specs/product-returns/` (plan, spec, tasks) ✅ aprobada el 2026-10-01
  - [x] Backend: migración `V9__product_returns.sql`, `ProductReturn`, `ReturnStatus`, `ReturnEligibilityService` (con `Clock` inyectable), `ReturnService`, `ReturnNotAllowedException` → `409`, endpoints `POST/GET …/{orderNumber}/returns`
  - [x] `OrderItemResponse` gana `returnEligible` + `returnIneligibleReason`
  - [x] Orden de elegibilidad `NOT_DELIVERED → ALREADY_RETURNED → EXPIRED`: el checkout (pedido `PENDING`) sale sin consultar la BD y una línea ya devuelta no muestra «plazo agotado»
  - [x] `refundAmount = unitPrice × quantity`, `BigDecimal` + `HALF_UP` escala 2 — **registro contable, no mueve dinero** (no hay PSP)
  - [x] **Bug de la spec corregido** (aprobado el 2026-10-05): la fórmula original sumaba `taxAmount`, pero `unit_price` ya es bruto con IVA incluido → declaraba 93,83 EUR por una línea pagada a 79,95 EUR. Test de regresión `shouldNotAddTaxAgain()`
  - [x] Carrera sobre el `UNIQUE (order_item_id)` → `DataIntegrityViolationException` → `409`, nunca `500`
  - [x] **Ampliación de spec** (anotada en §5): el `409` de devoluciones añade `code: RETURN_NOT_ALLOWED`, porque `getFriendlyErrorMessage()` traducía *todo* `409` a «No queda stock suficiente…»
  - [x] Frontend: sección «Devoluciones» en `/orders/[orderNumber]` con botón «Devolver», motivo legible (R8), formulario `noValidate`, estado `Solicitada` + importe y toast. Solo con sesión
  - [x] Tests: 106 → **134** backend, 88 → **101** frontend
  - [x] **«Ver pedido»** en el historial — la sección era *inalcanzable* desde la UI: el listado solo enlazaba al recibo
  - [x] Docs: `CHANGELOG.md`, `README.md` §3 (añadidos también los endpoints de la 5.3, que faltaban), puntero en `specs/user-orders/spec.md`
- [x] Tarea 5.5 — **Rediseño de la página de pedido** (`specs/order-detail-redesign/`) — **mergeada en `main` (PR #15, `e23b86c`, 2026-10-06)**
  - [x] Specs: `specs/order-detail-redesign/` (plan, spec, tasks) ✅ aprobada el 2026-10-05
  - [x] Decidido con el usuario el 2026-10-05: **placeholder editorial** para las fotos (el proyecto no tiene ni una imagen), **snapshot de dirección** en la orden + paso en el checkout, y **método de pago como dato declarado** sin procesar
  - [x] Backend: migración `V10__order_shipping_payment.sql` (6 columnas nullable, sin backfill), `ShippingAddress` `@Embeddable`, `PaymentMethod` enum, `AddressRepository.findByIdAndUserId`
  - [x] `CheckoutRequest` + `addressId` y `paymentMethod` con `@NotNull`; la dirección se resuelve **antes del bucle de reserva** para no tocar inventario con una dirección inválida
  - [x] ⚠️ **Consecuencia registrada**: `addressId` obligatorio + verificar propiedad ⇒ **ya no existe checkout de invitado** (plan §5.10)
  - [x] `OrderResponse` + `returnDeadline` (desde `ReturnEligibilityService.WINDOW_DAYS`, fuente única), `shippingAddress`, `paymentMethod`; `OrderItemResponse` + `productName`, `productFamily`, `size`, `color`
  - [x] **Ampliación de alcance detectada al implementar**: `OrderSummaryResponse` no traía **ninguna línea** (solo `itemCount`), así que R9/R10 eran imposibles → gana `items` (`OrderItemPreviewResponse`) y `returnRequested`, con **una única consulta por página** (`ProductReturnRepository.findOrderItemIdIn`), no 40 queries. Plan §5 corregido **antes** de tocar código
  - [x] `@BatchSize(size = 20)` a nivel de **clase** en `Sku` y `Product` — en `@ManyToOne` Hibernate lanza *«Property may not be annotated '@BatchSize'»* (rompía `contextLoads`)
  - [x] Frontend: `BackLink` (6 pantallas), `ProductThumb` (placeholder compartido), ficha reescrita en 9 secciones, historial con nombre + variante + badge, carrito con selectores de dirección y pago
  - [x] Banner «Gracias por tu compra» **solo** al llegar del checkout (`sessionStorage["nexus-just-checked-out"]` en `src/lib/checkout.ts`, consumido al leerlo)
  - [x] `/addresses`: el botón «Volver al perfil» existente llamaba a `window.history.back()` **sin fallback** → sustituido por `BackLink href="/profile"`
  - [x] `CartItemRow` delega su caja en `ProductThumb`; su rama `<img>` era código muerto (`imageUrl` nunca se asigna)
  - [x] **Sin ADR**: no cambia stack ni arquitectura (plan §3)
  - [x] Tests: 134 → **139** backend, 101 → **125** frontend · `tsc --noEmit` limpio · `next build` OK · ESLint **9 problems (4 errors, 5 warnings)**, los 4 errores los preexistentes de `main`
  - [x] Cobertura backend **86 %** vs **85 %** de `main` (medida en worktree aparte): sin regresión
  - [x] Verificación final: `/spec-check order-detail-redesign` ✅ **APROBADO (10/10)** + prueba manual en navegador (2026-10-06, R1–R10) + CI verde. Detectó 2 desviaciones y ambas se corrigieron: la tarjeta del historial no pintaba el `color` que ya traía el DTO (test R9 reforzado) y el copy de `BackLink` es contextual en 4 pantallas (documentado en spec R5)

---

## Tareas Pendiente

### Fase 5 — Gestión de Usuarios
- [x] **Tarea 5.5 cerrada** — PR #15 mergeado en `main` (`e23b86c`, 2026-10-06). ✅ La Fase 5 no tiene pendientes

### Fase 3 — Experiencia Editorial
- [x] **Tarea 3.1 cerrada** — PR **#19** mergeado en `main` (`bf7339c`, 2026-10-06) · 10/10 · CI verde
- [x] **Tarea 3.2 cerrada** — PR **#17** mergeado en `main` (`3214502`, 2026-10-06) · 10/10 · CI verde
- [x] **Tarea 3.3 cerrada** — ✅ **Fase 3 completa**

### Fase 4 — Calidad Enterprise
- [x] **Tarea 4.1 cerrada** — ✅ **spec `specs/component-test-suite/` · 270 frontend · ESLint 0/0 · cobertura 77/76/74/79**
- [x] **Tarea 4.2 cerrada** — ✅ **spec `specs/e2e-playwright/` · 5 pruebas de humo × 3 navegadores · `globalSetup` idempotente (usuario verificado + dirección + reset de stock) · job `e2e-tests` en CI**. En local **10/10 en Chromium y WebKit en dos corridas consecutivas**; **Firefox se valida en CI** porque la build de Playwright no arranca en headless en este macOS (decisión **D10**). Baselines: `tsc` 0 · ESLint 0/0 · 270 tests · cobertura 78.01/76.32/74.72/79.85 · build 0 · **`backend/` intacto**
- [x] **Tarea 4.3 cerrada** — ✅ **spec `specs/cwv-accessibility-audit/` · axe 14/14 sin hallazgos · Lighthouse en verde en 4 rutas** (LCP ≤ 3 500 ms · CLS ≤ 0,05 · TBT ≤ 100 ms · perf ≥ 90 · a11y ≥ 95, medidos y congelados) · job **`cwv-audit`** en CI. **Causa raíz única**: `text-neutral-400` → `text-neutral-600` en 46 líneas de 15 ficheros (los 33 `color-contrast`), `<h3>` → `<h2>` en `ProductCard`, **0 hallazgos descartados**. **La Fase 4 queda completa**. Baselines: `tsc` 0 · ESLint 0/0 · 270 tests · cobertura 78.01/76.32/74.72/79.85 · build 0 · **`backend/` intacto**

---

## Decisiones Importantes

| Decisión | Detalle |
|:---|:---|
| **Flujo de trabajo** | GitHub Flow con Pull Requests |
| **Commits/Pushes** | Preguntar siempre antes |
| **Ramas** | Una por tarea, merge a rama padre |
| **Estilo UI** | Estilo editorial Zara (neutral-*, uppercase, tracking-widest) |
| **Auth** | JWT + BCrypt, roles: solo USER por ahora |
| **Email** | Mailtrap (desarrollo), SendGrid (producción) |
| **Validación** | Frontend: simple y robusta; Backend: completa |
| **Mercado 3.2** | Se persiste el **objeto entero** en `localStorage["nexus-market"]` (no solo el código) para pintar con divisa y tasa correctas desde el primer render |
| **Precios 3.2** | Sin FX ni conversión: cada mercado tiene su precio sembrado a mano; `V11` es re-ejecutable (`ON CONFLICT DO NOTHING`) |
| **D6 — sin precio** | Un artículo sin precio **nunca se borra** del carrito: se marca `priceUnavailable` y bloquea el checkout |
| **Copy fiscal** | «Impuestos» en vez de «IVA» (UK es VAT, US *sales tax*); el envío gratuito traduce la **moneda**, no el valor |
| **ADR 3.2** | No hace falta (D8): no cambia stack ni arquitectura |
| **Filtrado 3.1** | Siempre **en backend** (Q2): cambiar filtro ⇒ nueva petición. Tallas y colores se derivan de la respuesta, no de una lista fija en cliente |
| **AND 3.1** | `family` + `size` + `color` se combinan con AND; `size`/`color` exigen **el mismo SKU** para no mezclar variantes de prendas distintas |
| **Estado 3.1** | La URL **es** el estado: `useSearchParams` dentro de `<Suspense>`, `router.push` (no `replace`) y parámetros por defecto omitidos |
| **Filtros UI 3.1** | Un **único** `CatalogFilters` para la columna lateral y el panel móvil — dos implementaciones podrían divergir. Cada opción sólo toca su campo |
| **D10 3.1** | El catálogo **nunca se pagina** — regla de producto, no de esta tarea |
| **ADR 3.1** | No hace falta (D8): no cambia stack ni arquitectura |
| **Imágenes 3.3** | Ficheros **estáticos** en `public/products/` + manifiesto generado por `npm run images` — **sin migración, DTO ni endpoint**; el backend no se toca |
| **Manifiesto 3.3** | Se importa **estáticamente** desde `src/data/product-images.json` (sin `fetch`); un `<img>` con `src` desconocido o `onError` cae a `ProductThumb` → **cero 404** |
| **LCP 3.3** | Toda la **primera fila** con `loading="eager"` + `fetchPriority="high"`: con cajas del mismo tamaño el LCP se resuelve por un **empate de pintado** y una `lazy` puede ganarlo. **`priority` está prohibido** (deprecado desde Next 16) |
| **`sizes` 3.3** | Derivado del ancho **medido** de la imagen y redondeado hacia arriba. Apuntar al contenedor en vez de la imagen (278 vs 276 px) cruza buckets del `srcset` y dispara la descarga a 1080w en vez de 828w |
| **DOM 3.3** | El orden es galería → compra → descripción **en el DOM** y la disposición de escritorio se consigue con colocación explícita de rejilla, **nunca reordenando con `order`** |
| **ADR 3.3** | No hace falta (R10): no cambia stack ni arquitectura — las imágenes son assets |
| **Estado 3.3** | El bloque de estado de `AGENTS.md` se redacta **en la feature PR**, formulado para ser verdad después del merge y **sin números de PR ni SHA** (viven en git y GitHub) → **no existe PR de documentación de cierre** (D11) |

---

## Estructura de Documentación

| Archivo | Contenido |
|:---|:---|
| `AGENTS.md` | Convenciones completas para agentes IA |
| `MEMORY.md` | Este archivo — estado actual del proyecto |
| `docs/constitution.md` | Visión, principios, arquitectura, stack |
| `docs/adr/` | Architecture Decision Records |
| `specs/` | Planes y especificaciones por feat |
| `CHANGELOG.md` | Registro de cambios |

---

## Notas de Contexto

- **Usuario**: Iván Castro
- **Proyecto**: Nexus Commerce Core
- **Inicio**: 2026-09-25
- **Convenciones**: Ver `AGENTS.md` en la raíz del proyecto
- **Repo movido a `~/nexus-commerce-core`** (2026-10-01): estaba en `~/Documents/proyects/`, carpeta sincronizada con iCloud Drive. El file provider (`fileproviderd`) restauraba duplicados `" 2.*"` ya borrados y llegó a romper compilación y builds. Verificado tras el movimiento: sin `com.apple.file-provider-domain-id`, 0 duplicados. **Al escanear duplicados usa un patrón que cubra ficheros sin extensión** (`LOG 2`), p. ej. `find . -not -path "./.git/*" -not -path "*/node_modules/*" -type f -regex '.* [0-9][0-9]*\(\.[^./]*\)\?$'` — el patrón `* [0-9]*.*` exige un punto y pasa por alto esos ficheros.
- **`backend/target/` y `frontend/.next/`**: si el build falla con `Unexpected file in persistence directory`, hay un duplicado en la caché → `rm -rf backend/target frontend/.next`.

---

*Última actualización: 2026-10-05 por agente IA — Tarea 5.4 mergeada (PR #14, `136c584`); abierta la Tarea 5.5 en `feat/order-detail-redesign`.*
