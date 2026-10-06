# Tasks — Tarea 3.2: Selector Dinámico de Mercado y Divisa

> **Spec**: `specs/market-currency-selector/spec.md` ✅ aprobada 2026-10-06
> **Plan**: `specs/market-currency-selector/plan.md`
> **Rama**: `feat/market-currency-selector`

---

## 0. Setup

- [x] `git checkout main && git pull`
- [x] `git checkout -b feat/market-currency-selector`
- [x] Verificar baseline verde: `cd backend && ./mvnw test` · `cd frontend && npx vitest run`

## 1. Backend — endpoint de mercados (R1)

- [x] `dto/MarketResponse.java` — record inmutable `(code, name, currency, taxRate)`
- [x] `service/MarketService.java` — `findAll(Sort.by("code"))` + mapeo a DTO *(controller fino, como el resto del proyecto)*
- [x] `MarketController` — `GET /api/v1/markets` con `@Tag(name = "Markets")` y `@Operation`
- [x] `SecurityConfig` — matcher explícito `.requestMatchers("/api/v1/markets").permitAll()`
- [x] Sin lógica de negocio: solo `findAll` + mapeo a DTO (nunca exponer la entidad)

## 2. Backend — migración de cobertura (R7)

- [x] `V11__complete_market_price_matrix.sql` — 5 celdas con `ON CONFLICT DO NOTHING` (spec §2)
- [x] Confirmar `spring.jpa.hibernate.ddl-auto=validate` sigue en verde (sin cambio de esquema)
- [x] Verificar que la matriz queda completa (4 × 2 = **8 precios**, `flyway_schema_history` → V11 `success=t`)

> **Bug detectado por la CI del PR #17** — la primera versión de `V11` dejaba
> `ES×L` sin sembrar: insertaba 4 celdas cuando hacían falta 5. El test falló
> en CI con `["ES"=1 (expected: 2)]` pero **pasaba en local**, porque la BD de
> desarrollo tenía esa fila residual (el propio comentario de V11 anticipaba
> que el entorno de dev tiene filas que no vienen de las migraciones).
>
> Reproducido y verificado en local creando una BD vacía
> (`market_matrix_ci`) y corriendo el test contra ella, igual que CI: matriz
> `CH=2 ES=2 UK=2 US=2` y 2/2 en verde. **Lección**: un test de semilla sólo
> es fiable contra una BD construida desde cero — que pase en local no basta.

## 3. Frontend — contexto de mercado (R2, R3)

- [x] `types/commerce.ts` — `interface Market { code, name, currency, taxRate }`
- [x] `lib/api.ts` — `getMarkets(): Promise<Market[]>` → `GET /api/v1/markets`
- [x] `context/MarketContext.tsx` — `MarketProvider`, `useMarket()`, `markets`, `market`, `setMarketCode`
- [x] Persistencia en `localStorage["nexus-market"]` vía `useLocalStorage` con **objeto completo** (D4)
- [x] Default `ES`; resetea a `ES` si el valor está corrupto o el `code` no está en la lista del endpoint (R3)
- [x] `layout.tsx` — `MarketProvider` **envuelve** a `CartProvider` (D5)
- [x] `Header.tsx` — `<select>` con `appearance-none`, `aria-label="Mercado y divisa"`, estilo editorial; no se pinta hasta cargar la lista (R2)

> **Desviación de diseño (2026-10-06)**: `useMarket()` usa el **valor por defecto
> de `createContext`** en vez de lanzar error. El estado degradado es correcto e
> imposible de pasar por alto —sin provider no hay lista, así que no se pinta el
> selector— y evita reenvolver los 7 tests que renderizan `Header`. Justificación
> completa en `MarketContext.tsx`.

## 4. Frontend — precios por mercado (R4, R5)

- [x] `lib/api.ts:62` — eliminar el default `"ES"` de `getPrice(skuId, market)`
- [x] `products/[reference]/page.tsx:61` — `api.getPrice(skuId, market.code)`
- [x] `products/[reference]/page.tsx` — estado «No disponible en {mercado}» y botón deshabilitado ante `404`, **sin** toast de error (R4)
- [x] `cart/page.tsx:85` — `marketCode: market.code` (R5)
- [x] `cart/page.tsx` — bloquear «Tramitar pedido» si `hasUnavailableItems` o `isRepricing` (R5/R6)

> `Promise.all` → `Promise.allSettled` en la ficha: el stock debe seguir
> mostrándose aunque falle el precio (R4). Nuevo helper `isNotFoundError()` en
> `errors.ts` reutilizando el patrón `isHttpStatus` ya existente.

## 5. Frontend — re-precificado del carrito (R6)

- [x] `CartItem` — campo opcional `priceUnavailable?: boolean`
- [x] `CartContext` — acción `REPRICE` en el reducer
- [x] `CartContext` — efecto que observa `market.code` y refetcha `getPrice` por artículo
- [x] `CartContext` — exponer `isRepricing` y `hasUnavailableItems`
- [x] Artículo sin precio → **se conserva** marcado (D6, nunca se borra)
- [x] `CartContext:132` — la divisa sale del **mercado activo**, no del primer artículo
- [x] `CartContext:21` — eliminar `const TAX_RATE = 0.21`; usar `market.taxRate / 100`

> `applyRepriceToItems` devuelve **el mismo array** si nada cambia: es lo que
> permite que el reducer devuelva el estado idéntico y que el efecto no entre en
> bucle de re-render.

## 6. Frontend — copy neutral de impuestos (R8)

- [x] `products/[reference]/page.tsx:170` — «IVA incluido (…)» → «Impuestos (…)»
- [x] `receipt/[orderNumber]/page.tsx:132` — «IVA {rate}%» → «Impuestos {rate}%»
- [x] `cart/page.tsx:301` — «21% IVA (mercado ES)» → «{taxRate}% (mercado {code})» dinámico
- [x] `CartContext.tsx:21` — comentario del `TAX_RATE` eliminado con la constante
- [x] grep de `IVA` → **0 resultados** en `src/` (fuera de tests)
- [x] **R8b** `products/[reference]/page.tsx:262` — «Envío gratuito…50€» → «…50 {market.currency}» *(ampliación aprobada 2026-10-06)*
- [x] **R8b** grep de `€` → **0 resultados** en `src/` (fuera de tests)

## 7. Verificación de no-regresión (R9)

- [x] Confirmar que historial, ficha y recibo pintan `order.currency` y no la del mercado activo
- [x] Test: cambiar de mercado **no** altera una orden ya emitida

## 8. Tests

### Backend
- [x] `MarketControllerTest` — devuelve los 4 mercados ordenados por `code`
- [x] `MarketControllerTest` — accesible **sin** sesión
- [x] Seed `V11` idempotente (insertar dos veces no duplica) → `MarketPriceSeedTest`

### Frontend
- [x] `MarketContext.test.tsx` — default `ES`, persistencia, reset ante código desconocido o JSON corrupto (7 tests)
- [x] `Header.test.tsx` — pinta el `<select>` con los mercados y el `aria-label`; no se pinta sin lista
- [x] `ProductDetailPage.test.tsx` — pide precio con el mercado activo
- [x] `ProductDetailPage.test.tsx` — `404` → «No disponible en …» + botón deshabilitado
- [x] `ProductDetailPage.test.tsx` — copy «Impuestos» y ausencia de «IVA»
- [x] `ProductDetailPage.test.tsx` — **R8b** envío gratuito con la divisa del mercado activo
- [x] `TaxCopy.test.ts` — **R8b** ningún `€` hardcodeado en `src/`
- [x] `CartPage.test.tsx` — envía `marketCode` activo; bloquea si hay artículos sin precio o re-precificando
- [x] `CartContext.test.tsx` — al cambiar de mercado re-precifica en la nueva divisa
- [x] `CartContext.test.tsx` — artículo sin precio **se conserva** marcado (negativo de borrado)
- [x] `CartContext.test.tsx` — divisor de impuestos usa la tasa del mercado (regresión de `0.21`)
- [x] Test de copy — ninguna cadena de `src/` contiene «IVA» → `TaxCopy.test.ts`
- [x] `OrderHistoryPage.test.tsx` — pedido en EUR inalterado con mercado activo UK (R9)

> **Impacto transversal detectado**: el `<select>` del header añade un segundo
> `combobox` en cada página. `waitForAddressSelected()` (CartPage) pasó a buscar
> por nombre accesible, y la aserción de divisa de R9 pasó a mirar el importe
> completo (`79.95 GBP`) en vez de la divisa suelta.

## 9. Verificación

- [x] `cd backend && ./mvnw test` en verde → **143 tests** (baseline 139, +4)
- [x] `cd frontend && npx vitest run` en verde → **147 tests** (baseline 125, +22)
- [x] `npx tsc --noEmit` sin errores
- [x] `npx eslint src` → **4 errores**, todos los preexistentes de `main` (0 nuevos)
- [x] `npm run build` OK (13 rutas)
- [x] **GitHub Actions (PR #17)** — backend ✅ `1m4s` · frontend ✅ `47s` en `3f2f9d0`
- [x] `/spec-check market-currency-selector` → **10/10 requisitos** (R1–R9 + R8b) ✅ APROBADO
- [x] **Prueba manual**: cambiar a UK y a US y ver que ficha, carrito y checkout cambian de divisa e impuestos

  | Mercado | Ficha | Impuestos | Envío | Carrito / pedido |
  |:---|:---|:---|:---|:---|
  | ES | `79.95 EUR` | `21%` | `50 EUR` | default |
  | UK | `79.99 GBP` | `20%` | `50 GBP` | bolsa re-precificada |
  | US | `84.95 USD` | `7.25%` | `50 USD` | `79.99 GBP → 84.95 USD`, checkout `{"marketCode":"US"}` → `201` |
  | CH | `119.00 CHF` | `8.1%` | `50 CHF` | orden `ORD-E5AD5491` sigue en USD |

  Extras comprobados: recarga dura conserva el mercado (R3), `0` mensajes de
  consola, `0 «IVA»` y `0 «€»` en el render, orden inalterada al cambiar a CH (R9).

## 10. Documentación

- [x] `CHANGELOG.md` — entrada bajo *Añadido* (la más reciente, con R8b)
- [x] `README.md` — `GET /api/v1/markets` documentado y «IVA» → «impuestos» en el desglose
- [x] `AGENTS.md` + `MEMORY.md` — estado actualizado (rama, pruebas 143/147, decisiones 3.2)
- [x] `specs/market-currency-selector/plan.md` — §5 Alcance anotado con la ampliación R8b *(la §8 es el diagrama del ciclo SDD y no tiene casillas)*
- [x] `specs/market-currency-selector/spec.md` §4 — **17/17 casillas marcadas**
- [x] **No** hace falta ADR (D8): no cambia stack ni arquitectura
