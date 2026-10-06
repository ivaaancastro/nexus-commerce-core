# Spec — Tarea 3.2: Selector Dinámico de Mercado y Divisa

> **Estado**: ✅ APROBADA (2026-10-06) — pendiente de implementar
> **Fecha**: 2026-10-06
> **Rama**: `feat/market-currency-selector`
> **Plan**: `specs/market-currency-selector/plan.md`

---

## 1. Requisitos

### R1 — Endpoint de mercados

**Criterio**: `GET /api/v1/markets` devuelve `List<MarketResponse>` ordenada por `code`.

- **Público** (`SecurityConfig` ya hace `permitAll` en `anyRequest`; se añade el
  matcher explícito `/api/v1/markets` para que la intención quede documentada).
- Lee de `MarketRepository.findAll()` — sin consultas N+1 ni lógica de negocio.
- El endpoint es la **única fuente de verdad** de la lista: si mañana se da de
  alta un mercado, aparece en el selector sin tocar el frontend.

### R2 — Selector en el `Header`

**Criterio**: el `<span>ES / EUR</span>` estático de `Header.tsx:35` se sustituye
por un control accesible que lista los mercados del endpoint y muestra
`{code} / {currency}`.

- Control **nativo `<select>`** con `appearance-none`: accesible de serie
  (teclado, lector de pantalla, iOS) sin reinventar un listbox.
- Estilo editorial: `text-xs uppercase tracking-widest text-neutral-400`,
  `bg-transparent`, `border-b border-neutral-200` sutil al foco.
- Etiqueta `aria-label="Mercado y divisa"`.
- Mientras no cargue la lista, el control no se pinta (evita un select vacío
  parpadeante).

### R3 — Persistencia del mercado

**Criterio**: el mercado activo se guarda **entero** (no solo el código) en
`localStorage["nexus-market"]` mediante `useLocalStorage`, igual que `nexus-cart`.

- Default: **ES**.
- Se persiste el objeto completo (`code`, `name`, `currency`, `taxRate`) para
  que el primer pintado ya tenga divisa y tasa — sin parpadeo a «EUR/21 %».
- Si el valor almacenado está **corrupto, incompleto o su `code` no está en la
  lista devuelta por el endpoint**, se resetea a `ES` (un mercado retirado del
  backend no puede seguir usándose).
- Tipo: `interface Market { code, name, currency, taxRate }` en `types/commerce.ts`.

### R4 — Precio de producto por mercado activo

**Criterio**: `api.getPrice(skuId, market)` recibe el `code` del mercado activo
en los dos puntos donde hoy está escrito `"ES"`:

- `api.ts:62` — se elimina el default `"ES"` del parámetro.
- `products/[reference]/page.tsx:61` — lee del contexto de mercado.

**Degradación (D1)**: si el endpoint de precio responde `404` (mercado sin
precio para ese SKU):

- No se pinta un error técnico ni se lanza `getFriendlyErrorMessage`.
- Se muestra el estado **«No disponible en {mercado}»** junto al precio.
- El botón **«Añadir a la bolsa» queda deshabilitado**.
- El stock sigue mostrándose: el producto existe, lo que falta es su precio.

### R5 — Checkout con el mercado activo

**Criterio**: `cart/page.tsx:85` envía `marketCode: <mercado activo>` en vez de
`"ES"`.

- El backend ya re-precifica en servidor (`OrderService:101`) y persiste
  `Order.marketCode`, así que la única responsabilidad del frontend es mandar
  el código correcto.
- Si un artículo del carrito no tiene precio en ese mercado, el checkout **no se
  envía** (ver R6): se evita el `400` «Precio no configurado para el SKU …».

### R6 — Re-precificado del carrito al cambiar de mercado (D2, D6)

**Criterio**: `CartProvider` observa el mercado activo y, cuando cambia,
refetcha `api.getPrice(skuId, marketCode)` para **cada** artículo y actualiza
`unitPrice` y `currency`.

- Acción nueva en el reducer: `REPRICE` con los artículos ya re-precificados.
- **Artículo sin precio**: se conserva con `priceUnavailable: true` — **nunca se
  borra en silencio**.
- El carrito expone `isRepricing` (estado de carga) y `hasUnavailableItems`.
- Si `hasUnavailableItems`, el carrito muestra un aviso por artículo y
  **desactiva «Tramitar pedido»** hasta que el usuario lo retire o vuelva a un
  mercado donde tenga precio.
- Mientras `isRepricing` está activo, el botón de checkout también se deshabilita
  para no enviar un total a medias.
- El divisor de impuestos del carrito deja de usar `TAX_RATE = 0.21` y pasa a
  `market.taxRate / 100` (D5: `MarketProvider` envuelve a `CartProvider`).
- La divisa mostrada (`CartContext:132`) pasa a derivarse del **mercado activo**,
  no del primer artículo del carrito.

### R7 — Cobertura de precios completada (D1)

**Criterio**: `V11__complete_market_price_matrix.sql` rellena los 4 huecos de la
matriz (ver §2) con `ON CONFLICT DO NOTHING`, de modo que los 4 mercados sean
usables de entrada.

- Es **semilla, no negocio**: las cifras son de prueba y se ajustan cuando haya
  catálogo real.
- La degradación de R4/R6 sigue siendo obligatoria — el seed completo no
  sustituye al manejo de huecos.

### R8 — Copy neutral de impuestos (D3)

Las 4 apariciones de «IVA» pasan a «Impuestos»:

| Fichero | Hoy | Después |
|:---|:---|:---|
| `products/[reference]/page.tsx:170` | `IVA incluido (21%)` | `Impuestos (21%)` |
| `receipt/[orderNumber]/page.tsx:132` | `IVA 21%: …` | `Impuestos 21%: …` |
| `cart/page.tsx:301` | `Impuestos calculados al 21% IVA (mercado ES)` | `Impuestos calculados al {taxRate}% (mercado {code})` |
| `context/CartContext.tsx:21` | `const TAX_RATE = 0.21 // IVA por defecto (ES)` | eliminado; se lee `market.taxRate` |

La tasa y el mercado del aviso del carrito son **dinámicos**: con UK debe decir
`20% (mercado UK)` y con US `7.25% (mercado US)`.

### R8b — Aviso de envío gratuito por divisa (ampliación aprobada 2026-10-06)

**Criterio**: el umbral de envío gratuito se escribe con la **divisa del mercado
activo**, nunca con un `€` fijo.

| Fichero | Hoy | Después |
|:---|:---|:---|
| `products/[reference]/page.tsx:262` | `Envío gratuito en pedidos superiores a 50€` | `Envío gratuito en pedidos superiores a 50 {currency}` |

- **Origen**: descubierto al implementar — la auditoría de hardcodes del
  `plan.md` §2 contabilizó 6 y omitió este (era el único `€` que quedaba en
  `src/`). Aprobado por el usuario el 2026-10-06 para resolverse dentro de la
  propia Tarea 3.2.
- **Decisión de negocio**: el umbral sigue siendo **numérico (50)** en todos los
  mercados — se traduce la moneda, no el valor. Que 50 GBP no valga lo mismo que
  50 EUR es una regla que todavía no existe como dato en BD; si algún día se
  parametriza, será una tarea propia.

### R9 — Órdenes existentes intactas

**Criterio**: cambiar de mercado **no** altera pedidos ya emitidos.

- `Order` persiste `marketCode` y `OrderResponse.currency` propios desde antes.
- Las páginas de historial, ficha y recibo pintan `order.currency`, no la del
  mercado activo → sin cambios.
- Cubierto por un test de no-regresión para que no se «arregle» por error.

---

## 2. Modelo de Datos (V11)

```sql
-- Tarea 3.2 (D1): completa la matriz de precios para que los 4 mercados sean
-- usables. Semilla de prueba, no lógica de negocio.
INSERT INTO market_prices (sku_id, market_id, base_price, discount_price)
SELECT s.id, m.id, v.base_price, NULL
FROM (VALUES
        (1, 'US',  84.95),   -- talla M en USD
        (2, 'UK',  79.99),   -- talla L en GBP
        (2, 'CH', 119.00),   -- talla L en CHF
        (2, 'US',  84.95)    -- talla L en USD
     ) AS v(sku_id, market_code, base_price)
JOIN skus    s ON s.id = v.sku_id
JOIN markets m ON m.code = v.market_code
ON CONFLICT (sku_id, market_id) DO NOTHING;
```

Matriz **resultante** (todas las celdas con precio):

| SKU | ES (EUR) | UK (GBP) | US (USD) | CH (CHF) |
|:--|--:|--:|--:|--:|
| 1 — talla M | 79,95 | 79,99 | 84,95 | 119,00 |
| 2 — talla L | 79,95 | 79,99 | 84,95 | 119,00 |

> `ON CONFLICT` es obligatorio: el entorno de desarrollo tiene una fila
> (`sku 2 × ES`) que no viene de las migraciones, y una migración debe poder
> ejecutarse sobre una BD parcialmente poblada.

Sin índices nuevos (`idx_prices_sku_market` y `uk_sku_market` ya existen).
Sin `ALTER TABLE`: **no cambia el esquema**, solo datos.

## 3. Contratos

### `GET /api/v1/markets` → `200`

```java
public record MarketResponse(
        String code,        // "ES" | "UK" | "US" | "CH"
        String name,        // "España" | "United Kingdom" | …
        String currency,    // "EUR" | "GBP" | "USD" | "CHF"
        BigDecimal taxRate  // 21.00 | 20.00 | 7.25 | 8.10
) {}
```

`BigDecimal` mantiene la convención de `PriceCalculationResponse`; en
TypeScript llega como `number` y pinta `21`, no `21.00`.

### Frontend

```ts
// types/commerce.ts
export interface Market {
    code: string;
    name: string;
    currency: string;
    taxRate: number;
}

// context/MarketContext.tsx
interface MarketContextValue {
    markets: Market[];                     // desde GET /api/v1/markets
    market: Market;                        // activo, siempre definido
    setMarketCode: (code: string) => void;  // síncrono; el carrito reacciona
}

// context/CartContext.tsx — ampliación
interface CartItem { … ; priceUnavailable?: boolean }
// contexto expone además:
isRepricing: boolean;
hasUnavailableItems: boolean;
```

`setMarketCode` es **síncrono**: `MarketContext` no conoce el carrito. Es
`CartContext` (montado por debajo, D5) quien observa el mercado y re-precifica.

### `layout.tsx` — orden de providers

```tsx
<AuthProvider>
  <MarketProvider>      {/* ← nuevo, envuelve a CartProvider */}
    <CartProvider>
      <CartDrawerProvider> … </CartDrawerProvider>
    </CartProvider>
  </MarketProvider>
</AuthProvider>
```

## 4. Criterios de Aceptación

- [x] **R1**: `GET /api/v1/markets` devuelve los 4 mercados ordenados por código → test de controller
- [x] **R1**: el endpoint es accesible sin sesión
- [x] **R2**: el `Header` pinta un `<select>` con los mercados y `aria-label` → test de `Header`
- [x] **R3**: la elección sobrevive a un recarga (localStorage) y el default es `ES`
- [x] **R3**: un `localStorage` corrupto o un código que el backend ya no devuelve cae a `ES` → test
- [x] **R4**: la ficha pide el precio con el mercado activo (sin `"ES"` hardcodeado) → test
- [x] **R4**: sin precio en el mercado → «No disponible en …» y botón deshabilitado, **sin toast de error** → test
- [x] **R5**: el checkout envía el `marketCode` activo → test de `CartPage`
- [x] **R6**: cambiar de mercado re-precifica los artículos del carrito en la nueva divisa → test de `CartContext`
- [x] **R6**: un artículo sin precio **se conserva** marcado y bloquea el checkout → test (negativo de no-borrado)
- [x] **R6**: el divisor de impuestos usa la tasa del mercado, no `0.21` → test de regresión
- [x] **R7**: `V11` deja la matriz completa y es idempotente
- [x] **R8**: ninguna de las 4 cadenas contiene «IVA» → grep + tests del copy
- [x] **R8**: el aviso del carrito refleja mercado y tasa reales (UK → `20% (mercado UK)`)
- [x] **R8b**: el aviso de envío gratuito usa la divisa del mercado activo (`50 CHF` en CH) → test
- [x] **R9**: cambiar de mercado **no** modifica órdenes ya emitidas → test de no-regresión
- [x] `./mvnw test` · `npx vitest run` · `tsc --noEmit` · ESLint sin errores nuevos · `npm run build`

## 5. Trazabilidad

| Req | Backend | Frontend | Tests |
|:---|:---|:---|:---|
| R1 | `MarketController`, `MarketResponse`, `SecurityConfig` | `api.getMarkets()` | controller |
| R2 | — | `Header.tsx` | `Header.test.tsx` |
| R3 | — | `MarketContext`, `types/commerce.ts` | `MarketContext.test.tsx` |
| R4 | — | `api.ts`, `products/[reference]/page.tsx` | `ProductDetailPage.test.tsx` |
| R5 | — | `cart/page.tsx` | `CartPage.test.tsx` |
| R6 | — | `CartContext` (`REPRICE`, `isRepricing`, `hasUnavailableItems`) | `CartContext.test.tsx` |
| R7 | `V11__complete_market_price_matrix.sql` | — | `MarketPriceSeedTest` |
| R8 | — | 4 ficheros de copy + `CartContext` | `TaxCopy.test.ts` |
| R8b | — | `products/[reference]/page.tsx` | `ProductDetailPage.test.tsx`, `TaxCopy.test.ts` |
| R9 | — | sin cambios (verificación) | test de no-regresión |
