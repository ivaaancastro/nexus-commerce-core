# Plan — Tarea 3.2: Selector Dinámico de Mercado y Divisa

> **Feature**: `market-currency-selector`
> **Fecha**: 2026-10-06
> **Rama propuesta**: `feat/market-currency-selector`
> **Fase**: 3 — Experiencia Editorial

---

## 1. Objetivo

Que el usuario pueda elegir su **mercado** (ES, UK, US, CH) y que **todos** los
precios, impuestos y divisas de la interfaz —catálogo, ficha de producto,
carrito y checkout— se correspondan con ese mercado.

Hoy la app es **monomercado ES/EUR de hecho**: el backend ya soporta cuatro
mercados con divisas e impuestos propios, pero el frontend tiene `ES`/`EUR`
escrito a mano y nadie lo puede cambiar.

## 2. Estado actual (hallazgos)

### Backend — casi listo, falta exponerlo

| Pieza | Estado |
|:---|:---|
| `Market` (`code`, `name`, `currency`, `taxRate`) | ✅ existe, 4 mercados sembrados en `V1` |
| `MarketPrice` (precio absoluto por SKU + mercado, con descuento) | ✅ existe |
| `PricingService.calculatePrice(skuId, marketCode)` | ✅ existe; devuelve `Optional` vacío si no hay precio |
| `GET /api/v1/pricing/skus/{id}?market=ES` | ✅ existe (404 si el mercado no tiene precio) |
| `CheckoutRequest.marketCode` + `Order.marketCode` | ✅ se persiste desde la 5.1 |
| **`GET /api/v1/markets`** | ❌ **no existe** — `MarketRepository` solo expone `findByCode` |
| Cobertura de precios | ❌ **incompleta** (ver §3) |

`SecurityConfig` ya deja `/api/v1/pricing/**` en `permitAll` y `anyRequest().permitAll()`.

### Frontend — 6 hardcodes

| Fichero | Qué hace falta |
|:---|:---|
| `components/Header.tsx:35` | `<span>ES / EUR</span>` estático → **selector** |
| `lib/api.ts:62` | `getPrice(skuId, market = "ES")` → mercado activo |
| `app/products/[reference]/page.tsx:61` | `api.getPrice(id, "ES")` → mercado activo |
| `app/cart/page.tsx:85` | `marketCode: "ES"` en el checkout → mercado activo |
| `app/cart/page.tsx:301` | copy «21% IVA (mercado ES)» → mercado y tasa reales |
| `context/CartContext.tsx:21` | `const TAX_RATE = 0.21` → tasa del mercado activo |

Además `CartContext:132` deriva la divisa del **primer artículo** del carrito
(`state.items[0]?.currency ?? "EUR"`) en vez del mercado.

> `app/addresses/page.tsx:18` (`countryCode: "ES"`) es el valor por defecto de
> una **dirección**, no de mercado → **fuera de alcance**.

## 3. El problema de la cobertura de precios

`market_prices` solo la toca `V1`, y la matriz real es:

| SKU | ES | UK | US | CH |
|:--|--:|--:|--:|--:|
| 1 — talla M | 79,95 | 79,99 | **—** | 119,00 |
| 2 — talla L | 79,95 | **—** | **—** | **—** |

Consecuencias si no se arregla:

- Elegir **US** → `getPrice` devuelve **404** en el detalle y el carrito.
- Elegir **UK** o **CH** con la talla **L** → ídem.
- El checkout **falla igualmente**: `OrderService:101-103` lanza
  `IllegalArgumentException("Precio no configurado para el SKU … en el mercado …")`.

No existe ninguna tabla de tipos de cambio: `MarketPrice` es un precio
**absoluto** por mercado. Por eso «convertir» no es una opción barata.

## 4. Decisiones de diseño

### Elegidas por el usuario (2026-10-06)

| # | Decisión |
|:--|:---|
| **D1** | **Sembrar la matriz + degradación**: `V11` rellena los huecos (US×2, UK×L, CH×L) y, de todas formas, se añade degradación defensiva —si un producto nace sin precio en un mercado, la UI no lo ofrece y el backend responde `400` amigable. |
| **D2** | **Re-precificar el carrito** al cambiar de mercado: se refetchan los precios de los artículos y el resumen se recalcula en la nueva divisa, para que lo que vea el usuario coincida con lo que cobrará el servidor. |
| **D3** | **Etiqueta neutral «Impuestos»** en lugar de «IVA»: correcto para ES/UK (IVA), US (*sales tax*) y CH (*MWST*). |

### Propuestas por el agente (a aprobar con el plan)

| # | Decisión | Alternativa descartada |
|:--|:---|:---|
| **D4** | Mercado en **`localStorage["nexus-market"]`** vía `MarketProvider` (default `ES`), igual que `nexus-cart` y `nexus-auth-token`. | Guardarlo en backend por usuario: es preferencia de sesión, no dato de cuenta, y obligaría a endpoint + migración de `users`. |
| **D5** | `MarketProvider` **envuelve** a `CartProvider` en `layout.tsx` — `CartContext` necesita el mercado para re-precificar y para la tasa del estimado. | Leer el mercado dentro de cada página: duplicaría la lógica y dejaría el carrito desincronizado. |
| **D6** | Si un artículo **no tiene precio** en el mercado elegido: **se conserva, se marca como no disponible y se bloquea el checkout** con aviso. | Borrarlo en silencio (hostil) o dejarlo al precio viejo (mezclar divisas en un mismo pedido, que solo lleva un `currency`). |
| **D7** | `GET /api/v1/markets` **público**, devuelve los 4 mercados ordenados por `code`. | Exigir sesión: el visitante que entra al catálogo también necesita ver precios en su divisa. |
| **D8** | **Sin ADR**: no cambia stack ni arquitectura. Reutiliza contextos, `useLocalStorage` y el motor de precios ya existentes. | — |

## 5. Alcance

### Dentro
- Endpoint `GET /api/v1/markets` + `MarketResponse`.
- Migración `V11` que completa la matriz de precios.
- `MarketProvider` + selector editorial en el `Header`.
- Los 6 puntos de `ES`/`EUR`/`0.21` pasan a leer el mercado activo.
- Re-precificado del carrito y bloqueo si un artículo queda sin precio.
- Copy «IVA» → «Impuestos» en las 4 apariciones.
- **Ampliación aprobada 2026-10-06 (R8b)**: el aviso de envío gratuito de la
  ficha (`50€`) se escribe también con la divisa del mercado activo — era el
  único `€` que quedaba en `src/` y la auditoría de la §2 lo omitió.
- Tests backend + frontend.

### Fuera
- Idioma de la UI (sigue en `es-ES`; no hay i18n en el proyecto).
- País de envío: sigue derivándose de la dirección elegida (`destinationCountryCode`), que **no** es el mercado.
- Tabla de tipos de cambio / conversión FX.
- Editar órdenes ya emitidas: persisten `marketCode` y `currency` propios y **no cambian**.
- Persistir el mercado en el backend.
- Cómo se obtienen los precios por mercado (se asume dato introducido a mano / sembrado).

## 6. Riesgos

| Riesgo | Mitigación |
|:---|:---|
| Re-precificar es `async` y puede fallar | D6: se marca el artículo y se bloquea el checkout; nunca se rompe el render |
| Tests existentes asumen `ES`/`EUR` | Revisar `Header.test`, `CartPage.test`, `OrderHistoryPage.test`, `CartContext.test` |
| `TAX_RATE` fijo en `CartContext` cambia el total estimado | D5: el contexto de mercado debe estar montado por encima; añadir test de regresión |
| Orden de providers en `layout.tsx` | D5 + test de montaje |
| Un producto nuevo nazca sin precio en algún mercado | D1: degradación ya implementada, no depende de que el seed esté completo |

## 7. Estimación

| Bloque | Esfuerzo |
|:---|:---|
| Backend: endpoint + DTO + `V11` + tests | S |
| Frontend: `MarketContext` + selector en `Header` | M |
| Frontend: cablear los 6 puntos de precio/impuesto | M |
| Frontend: re-precificado del carrito (D2/D6) | M |
| Tests + docs (README, CHANGELOG, AGENTS/MEMORY) | S |

**Ronda de tests**: el re-precificado y el bloqueo por precio ausente son lo
único con lógica de verdad; el resto es cableado.

## 8. Ciclo SDD

```
plan.md   → este fichero
spec.md   → requisitos, contratos, modelo de datos
APROBAR   → ⛔ bloqueo
tasks.md  → checklist
CODE      → implementar
VERIFY    → /spec-check market-currency-selector
CLOSE     → tests + docs + PR
```
