# Tasks: Fix de autenticación en checkout y errores amigables

> **Estado**: ✅ APROBADA
> **Fecha**: 2026-10-05
> **Rama**: `fix/checkout-401`
> **Spec**: `specs/checkout-auth/spec.md`

---

## Tests primero (reproducir los bugs)

- [x] **T1** `__tests__/Errors.test.ts` — `401`, `403`, `404`, `409`, `500` y fallback; ninguno devuelve el crudo (12 tests)
- [x] **T2** `__tests__/ApiAuthHeaders.test.ts` — `checkout` y `getOrder` envían `Authorization` (7 tests)
- [x] **T3** `__tests__/CartPage.test.tsx` — sin sesión no se invoca `api.checkout` y se ve el mensaje de R2
- [x] **T4** `__tests__/CartPage.test.tsx` — backend `401` → el texto visible no contiene `API Error [`
- [x] T1 y T2 **fallaron** antes de implementar (reproducían el bug)

---

## R1 — Token en los endpoints de pedidos

- [x] `api.checkout()` añade `getAuthHeaders()`
- [x] `api.getOrder()` añade `getAuthHeaders()`

## R2 — Guard de sesión

- [x] `app/cart/page.tsx`: sin token → no se llama a `api.checkout()`
- [x] `app/cart/page.tsx`: mensaje «Inicia sesión para completar tu compra» + enlace a `/login`
- [x] `app/products/[reference]/page.tsx`: ídem — **ver hallazgo**: la PDP no tenía
      botón de compra y su `handleCheckout` era código muerto desde su creación.
      Decisión del usuario: **borrarlo**. R2 queda aplicado solo al carrito, el único
      punto de compra alcanzable.

## R3 — Traducción de códigos

- [x] `401` → «Tu sesión ha caducado. Inicia de nuevo para continuar.»
- [x] `403` → «No tienes permiso para realizar esta acción.»
- [x] `404` → «No encontramos lo que buscas.»
- [x] `409` → «No queda stock suficiente para completar el pedido.»
- [x] Matching **anclado** a `API Error [n]` (nunca el número suelto)
- [x] `500` también anclado (antes `includes("500")`, falso positivo con importes)

## R4 — Los 9 sitios dejan de pintar `err.message`

| # | Archivo | Línea | Hecho |
|:--|:---|:--:|:--:|
| 1 | `app/cart/page.tsx` | 46 | [x] |
| 2 | `app/products/[reference]/page.tsx` | 108 | [x] |
| 3 | `app/products/[reference]/page.tsx` | 43 | [x] |
| 4 | `app/page.tsx` | 33 | [x] |
| 5 | `app/page.tsx` | 47 | [x] |
| 6 | `app/forgot-password/page.tsx` | 26 | [x] |
| 7 | `app/forgot-password/page.tsx` | 44 | [x] |
| 8 | `app/receipt/[orderNumber]/page.tsx` | 42 | [x] |
| 9 | `app/orders/[orderNumber]/page.tsx` | 31 | [x] |

- [x] Ninguna página pinta `err.message` (grep final sin resultados en `src/app`)

## R5 — Backend intacto

- [x] No se toca `SecurityConfig`, `OrderController` ni `GlobalExceptionHandler`
      (diff limitado a `frontend/`)

---

## Verificación

- [x] `cd frontend && npx vitest run` en verde → **77 tests / 12 archivos**
- [x] `npx eslint` sin problemas nuevos → en los 11 ficheros tocados solo queda 1 error,
      el `react-hooks/immutability` de `page.tsx`, **verificado como preexistente** con
      `git stash` sobre HEAD. Los 5 warnings que había en la PDP desaparecen al borrar
      el código muerto.
- [x] `npm run build` correcto → TypeScript OK, 11 rutas
- [x] `grep -rn "err.message" src/app` sin resultados
- [x] CHANGELOG.md actualizado
- [ ] Commit + PR **previa autorización del usuario**

---

## Bugs encontrados durante la implementación

| # | Bug | Estado |
|:--|:---|:---:|
| 1 | La PDP no tenía botón de compra: `handleCheckout`, `checkoutLoading` y sus imports residuales eran código muerto desde su creación | ✅ Borrado (decisión del usuario) |
| 2 | `includes("500")` en `getFriendlyErrorMessage` daba falso positivo con importes | ✅ Corregido + testeado |

---

## Métricas

| Métrica | Antes | Después |
|:---|:--:|:--:|
| Tests frontend | 54 | **77** |
| Archivos de test | 10 | **12** |
| Páginas con `err.message` | 9 | **0** |
| Código de `lib/errors.ts` sin test | sí | **no** (12 tests) |
