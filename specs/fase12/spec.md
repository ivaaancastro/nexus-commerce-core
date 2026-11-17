# Fase 12 — i18n ES/EN (opcional) — spec

> **Estado**: borrador (pendiente de aprobación del usuario). Decisiones en `plan.md` (D1–D9) · checklist en `tasks.md`.

---

## 1. Requisitos funcionales

| # | Requisito |
|:--|:---|
| **R1** | **Utilidad de i18n**: `src/lib/i18n.ts` expone `createI18n()` / `t(key)` y los diccionarios `src/lib/locales/es.ts` y `src/lib/locales/en.ts`. |
| **R2** | **`useLocale()` hook** (`src/hooks/useLocale.ts` o `src/lib/i18n.ts`) que devuelve `{ locale, setLocale, t }` con valor por defecto `"es"` y sin `throw` cuando no hay provider (patrón `MarketContext`). |
| **R3** | **Persistencia del idioma**: `es`/`en` guardado en `localStorage` bajo la clave `nexus-locale`; al recargar se recupera el idioma elegido. |
| **R4** | **Idioma independiente del mercado**: el usuario puede combinar cualquier idioma (`es`/`en`) con cualquier mercado (`ES`/`UK`/`US`/`CH`) sin que uno condicione al otro. |
| **R5** | **Copy fiscal traducido**: `taxesIncludedLabel(taxRate)` devuelve «Impuestos incluidos (X %)» en `es` y «Taxes included (X %)» en `en`. |
| **R6** | **Mensajes de error traducidos**: `getFriendlyErrorMessage()` devuelve los mensajes en el idioma activo (`es` por defecto, `en` opcional). |
| **R7** | **Selector de idioma en el Header**: el usuario puede cambiar el idioma desde la navegación principal sin perder el mercado, el carrito ni la sesión. |
| **R8** | **Fallback seguro**: `t(key)` devuelve la clave misma si falta la traducción; nunca lanza ni deja la UI en blanco. |
| **R9** | **Textos del backend en español**: los mensajes de error de la API (400/403/404/409/502) se dejan en español (fuera de alcance de esta fase, decisión D5). |
| **R10** | **Tests existentes en español siguen verdes**: no se toca ninguna aserción preexistente (regla R8.3 de AGENTS.md). |

---

## 2. Requisitos no funcionales

| # | Requisito |
|:--|:---|
| **RNF1** | `tsc` 0 · ESLint 0/0 · `build` 0 en `frontend/` antes de cerrar la rama. |
| **RNF2** | Cobertura mantenida: no baja del piso 77/76/74/79 (líneas/funciones/ramas/instrucciones). |
| **RNF3** | Los 4 jobs de calidad de CI (`backend-tests`, `frontend-tests`, `e2e-tests`, `cwv-audit`) siguen en verde. |
| **RNF4** | Sin nuevas dependencias de npm para i18n (utilidad propia, decisión D1). |
| **RNF5** | `t(key)` determinista: misma clave + mismo idioma → mismo texto. |

---

## 3. API y cambios de código

| Fichero | Cambio |
|:---|:---|
| `frontend/src/lib/i18n.ts` | Nuevo: utilidad `createI18n()` / `t(key)` + diccionarios cargados |
| `frontend/src/lib/locales/es.ts` | Nuevo: diccionario de textos en español |
| `frontend/src/lib/locales/en.ts` | Nuevo: diccionario de textos en inglés |
| `frontend/src/hooks/useLocale.ts` | Nuevo: `useLocale()` con `localStorage` + valor por defecto `es` |
| `frontend/src/lib/taxes.ts` | `taxesIncludedLabel` usa `t()` para ES/EN |
| `frontend/src/lib/errors.ts` | `getFriendlyErrorMessage` usa `t()` para ES/EN |
| `frontend/src/components/Header.tsx` | + selector de idioma (es/en) junto al selector de mercado |
| `frontend/src/__tests__/i18n.test.ts` | Nuevo: tests de diccionarios, `useLocale`, `taxes.ts` EN, `errors.ts` EN |
| `frontend/src/__tests__/LocaleContext.test.tsx` (si procede) | Tests del hook de idioma |
| `CHANGELOG.md` | Entrada en `[Unreleased]` con la Fase 12 |
| `AGENTS.md` | Bloque «ESTADO ACTUAL»: Fase 12 en curso → completada tras merge |
| `MEMORY.md` | Fase 12 marcada como completada tras merge |

Sin cambios en `backend/` (mensajes de API en español, decisión D5).

---

## 4. Detalles del diccionario (V1)

**Claves mínimas obligatorias** (deben existir en `es.ts` y `en.ts` con valores no vacíos):

| Clave | ES | EN |
|:---|:---|:---|
| `nav.collection` | Colección | Collection |
| `nav.search` | Búsqueda Vectorial | Vector Search |
| `nav.admin` | Admin | Admin |
| `nav.orders` | Pedidos | Orders |
| `nav.wishlist` | Favoritos | Favorites |
| `nav.account` | Cuenta | Account |
| `nav.login` | Iniciar sesión | Sign in |
| `nav.logout` | Cerrar sesión | Sign out |
| `cart.title` | Bolsa de compra | Shopping bag |
| `cart.empty` | Tu bolsa está vacía | Your bag is empty |
| `cart.checkout` | Finalizar compra | Checkout |
| `errors.sessionExpired` | Tu sesión ha caducado. Inicia de nuevo para continuar. | Your session has expired. Sign in again to continue. |
| `errors.noPermission` | No tienes permiso para realizar esta acción. | You don't have permission to do this. |
| `errors.notFound` | No encontramos lo que buscas. | We couldn't find what you're looking for. |
| `errors.default` | Algo salió mal. Inténtalo de nuevo. | Something went wrong. Try again. |
| `taxes.included` | Impuestos incluidos (X %) | Taxes included (X %) |
| `button.addToCart` | Añadir a la bolsa | Add to bag |
| `button.save` | Guardar | Save |
| `button.cancel` | Cancelar | Cancel |

---

## 5. Criterios de aceptación

- [ ] Existe `src/lib/i18n.ts` con `t(key)` y diccionarios `es`/`en`
- [ ] Existe `useLocale()` con valor por defecto `es` y sin `throw`
- [ ] El idioma se persiste en `localStorage` (`nexus-locale`) y se recupera al recargar
- [ ] Idioma y mercado son independientes (cualquier combinación válida)
- [ ] `taxesIncludedLabel` devuelve texto ES/EN según el idioma
- [ ] `getFriendlyErrorMessage` devuelve mensajes ES/EN según el idioma
- [ ] Selector de idioma en el Header funcional (es/en)
- [ ] `t(key)` con clave faltante devuelve la clave (no lanza)
- [ ] Tests existentes en español siguen verdes (no se tocan aserciones)
- [ ] `tsc` 0 · ESLint 0/0 · `build` 0 en `frontend/`
- [ ] Cobertura mantenida (no baja del piso 77/76/74/79)
- [ ] `CHANGELOG.md` con entrada de la Fase 12
- [ ] Bloque «ESTADO ACTUAL» de `AGENTS.md` actualizado (verdad tras el merge)
- [ ] `MEMORY.md` marca la Fase 12 completada
- [ ] **Sin ADR nuevo** · **sin PR de documentación de cierre**
- [ ] `/spec-check fase12` aprobado

---

## 6. Qué NO hace esta fase (fuera de alcance)

- Textos del backend / API (respuestas de error en español, decisión D5)
- Emails transaccionales (V1 order-status-emails)
- Landing `/proyecto` (se evalúa; si no entra, se declara fuera)
- Traducción de URLs de rutas (`/pedidos` vs `/orders`)
- Cambio de idioma automático por navegador (`Accept-Language`) — el usuario elige manualmente
