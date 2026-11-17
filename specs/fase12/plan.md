# Fase 12 — i18n ES/EN (opcional) — plan

> **Estado**: borrador (pendiente de aprobación del usuario). Decisiones y criterios de aceptación en `spec.md`.

## 1. Objetivo

Añadir internacionalización **español / inglés** al frontend editorial de Next.js, de modo que el usuario pueda cambiar el idioma de la interfaz y que todos los textos visibles (navegación, etiquetas, botones, mensajes de error, notas fiscales, copy del carrito y del checkout) se rendericen en el idioma seleccionado.

El i18n es **opcional** en la hoja de ruta 6–15: no bloquea el lanzamiento (Fase 13 LinkedIn), pero se deja preparado para activar en cualquier momento.

## 2. Situación de partida (medida en el código, hoy)

| Hecho | Consecuencia |
|:---|:---|
| Todo el copy está en español, hardcoded en componentes y libs (`src/lib/taxes.ts`, `src/lib/errors.ts`, componentes) | No hay infraestructura de i18n; añadir inglés requiere extraer todos los textos traducibles |
| `MarketContext` ya maneja mercados ES/UK/US/CH con `currency` y `taxRate` | El mercado/divisa ya vive en contexto; el idioma es una nueva dimensión independiente del mercado |
| `taxesIncludedLabel(taxRate)` devuelve «Impuestos incluidos (X %)» en `src/lib/taxes.ts` | Es la única fuente del copy fiscal (final-price-display D2/R4); la versión EN debe ir aquí |
| `getFriendlyErrorMessage()` en `src/lib/errors.ts` traduce errores técnicos a mensajes en español | Es la única fuente de mensajes de error; la versión EN debe ir aquí |
| `i18n` no existe como dependencia ni como utilidad en `frontend/` | Hay que decidir: librería (`next-i18next`, `react-i18next`) vs utilidad propia ligera |
| Tests existen para `Header`, `CartPage`, `ProductDetailPage`, `errors.ts`, `taxes.ts`, etc. | Cada texto traducible cubierto por test debe seguir pasando; los tests de copy en español deben seguir verdes |
| `tsc` 0 · ESLint 0/0 · `build` 0 · cobertura 85.34/80.77/81.93/87.33 (umbrales 77/76/74/79) | El i18n no debe bajar la cobertura ni romper tsc/build |

## 3. Decisiones de diseño (pendiente de validación en spec)

| # | Decisión | Justificación / alternativa descartada |
|:--|:---|:---|
| **D1** | **Utilidad propia ligera** (`src/lib/i18n.ts` + diccionarios `src/lib/locales/es.ts` / `src/lib/locales/en.ts`) en lugar de librería externa | El proyecto evita dependencias pesadas; el alcance es moderado (textos de vitrina, errores, notas). Una utilidad propia es más simple, sin bundle extra y fácil de testeos unitarios |
| **D2** | **Idioma independiente del mercado**: `es`/`en` guardado en `localStorage` («nexus-locale»), por defecto `es` | El usuario puede ver la tienda en inglés aunque compre en EUR (ES) o en español aunque compre en GBP (UK). Acoplar idioma a mercado limitaría combinaciones válidas |
| **D3** | **`useLocale()` hook** que devuelve `{ locale, setLocale, t }` con valor por defecto `es` (sin `throw`) | Patrón `MarketContext`: los tests que renderizan componentes aislados siguen montando sin provider; el degradado es silencioso y correcto |
| **D4** | **`t(key)` devuelve el texto en el idioma activo**; si falta una clave, devuelve la clave misma (fail visible en desarrollo, nunca rompe la UI) | Evita pantallas en blanco por una traducción faltante; fácil de detectar en tests |
| **D5** | **Textos del backend** (mensajes de error 400/409/403) **se dejan en español** por ahora | El backend emite mensajes en español; traducirlos requeriría `Accept-Language` + diccionario en Java. Se declara fuera de alcance de la V1 del i18n frontend (se revisa en Fase 13 si es necesario) |
| **D6** | **Copy fiscal** (`Impuestos incluidos (X %)`) se traduce en `src/lib/taxes.ts` vía `t()` o diccionario propio | Es la única fuente del copy fiscal (regla final-price-display); la versión EN («Taxes included (X %)») vive junto a la ES |
| **D7** | **Mensajes de error** (`getFriendlyErrorMessage`) se traducen en `src/lib/errors.ts` vía `t()` o diccionario propio | Es la única fuente de mensajes amigable; la versión EN vive junto a la ES |
| **D8** | **Selector de idioma en el Header** (junto al selector de mercado) o en un sitio accesible | El usuario debe poder cambiar de idioma sin perder el mercado ni el carrito |
| **D9** | **Tests**: añadir tests de `useLocale`, `taxes.ts` (EN) y `errors.ts` (EN); los tests existentes de copy en ES siguen verdes | R8.3: no se tocan aserciones preexistentes; se añaden las nuevas |

## 4. Riesgos

| Riesgo | Mitigación |
|:---|:---|
| Olvidar algún texto traducible y dejarlo en español en modo EN | Revisar componente por componente (Header, Cart, PDP, Checkout, Admin, landing) y marcar en spec cuáles entran en la V1 |
| Romper cobertura al añadir diccionarios sin test | Añadir tests para `es.ts` y `en.ts` (claves presentes, valores no vacíos) |
| `t()` con clave faltante rompe la renderización | `t()` devuelve la clave como fallback; nunca lanza |
| Acoplar idioma a mercado y limitar combinaciones | D2: idioma y mercado son independientes |

## 5. Alcance V1 (qué se traduce en esta fase)

**Dentro de alcance (frontend):**
- `src/lib/taxes.ts`: nota fiscal ES/EN
- `src/lib/errors.ts`: mensajes amigables ES/EN
- `Header.tsx`: navegación, botones, selectores
- Páginas principales: `/`, `/catalog`, `/search`, `/cart`, `/wishlist`, `/orders`, `/profile`, `/login`, `/register`
- Componentes: `ProductCard`, `CartDrawer`, `AddToCartButton`, `CouponInput`, `OrderStatusBadge`, `Toast`, `BackLink`, etc.

**Fuera de alcance (se deja para posteriores o se declara):**
- Textos del backend (respuestas de error 400/409/403) — se dejan en español (D5)
- Emails transaccionales (V1 order-status-emails) — fuera de alcance
- Landing `/proyecto` — se evalúa si entra; si no, se declara fuera
- URLs de rutas (`/pedidos` vs `/orders`) — fuera de alcance (las rutas se mantienen)

## 6. Estimación

~2 jornadas: utilidad i18n, diccionarios ES/EN, integración en Header + copy clave (taxes, errors), tests, tsc/build/cobertura, actualizar CHANGELOG y AGENTS.md.

---

Pendiente de aprobación del usuario antes de escribir `spec.md` y `tasks.md`.
