# Spec: Fix de autenticación en checkout y errores amigables

> **Estado**: ✅ APROBADA
> **Fecha**: 2026-10-05
> **Rama**: `fix/checkout-401`
> **Aprobada por el usuario**: 2026-10-05
> **Alcance R4 confirmado**: los 9 sitios (decisión del usuario: 2026-10-05)
> **Tipo**: Bug fix — no abre fase nueva ni cambia arquitectura/stack (no requiere ADR)

---

## 0. Contexto

Reportado por el usuario el 2026-10-05 al probar el checkout con sesión iniciada:

```
API Error [401]: {"timestamp":"2026-10-05T12:44:52.643623+02:00","status":401,
"error":"Unauthorized","message":"Autenticación requerida"}
```

Evidencia recogida contra `main` (`6e4d8e5`):

```bash
$ git show 6e4d8e5:.../SecurityConfig.java | grep orders
32:  .requestMatchers("/api/v1/orders/**").authenticated()   # ya en main

$ git show 6e4d8e5:frontend/src/lib/api.ts    # idéntico, sin Authorization
checkout: async (request, idempotencyKey) => { headers: { "Content-Type", "Idempotency-Key" }, ... }
```

**Dos bugs, ninguno introducido por la Tarea 5.3:**

1. `api.checkout()` y `api.getOrder()` **nunca** han enviado `Authorization`. Como
   `/api/v1/orders/**` es `authenticated()`, el checkout llevaba roto desde que se
   implementó — devolvía `403`. La Tarea 5.3 (spec §5: *«Sin token → 401»*) cambió el
   código a `401`, que es el correcto: el fallo estaba, solo cambió el número que lo delata.
2. **Nueve** páginas pintan `err.message` crudo en pantalla, incumpliendo la regla 9
   (*«SIEMPRE traducir errores técnicos con `getFriendlyErrorMessage()`»*).

**Decisión de producto (elegida por el usuario, 2026-10-05)**: el checkout **requiere
sesión**. El backend soporta invitado (`resolveUser()` → `null`), pero la seguridad ya
lo excluía; se confirma esa postura en lugar de abrir `permitAll`.

---

## 1. Requisitos

### R1 — El token viaja en los endpoints de pedidos
Ninguna llamada a `/api/v1/orders/**` se emite sin credencial cuando existe sesión.

**Criterio**: `api.checkout()` y `api.getOrder()` incluyen `getAuthHeaders()` en sus
cabeceras, igual que ya hacen `getMyOrders()` y `getMyOrder()`.

### R2 — Guard de sesión antes de tramitar el pedido
Si no hay sesión, no debe llegar una petición que sabemos que va a fallar.

**Criterio**: en el carrito y en la PDP, al pulsar «Comprar» sin token en
`localStorage` **no se llama al backend**. Se muestra *«Inicia sesión para completar tu
compra»* con enlace a `/login`. No se pinta ningún error técnico ni código HTTP.

> **Hallazgo de implementación (2026-10-05) — resuelto**: la PDP **no tiene botón de
> compra**. Su `handleCheckout` nunca estuvo conectado a ningún `onClick` desde que se
> creó la página (`git log -S 'onClick={handleCheckout}'` lo confirma en todos los
> commits), y el único camino de compra real es «Añadir a la bolsa» → carrito.
> **Decisión del usuario: borrar el código muerto.** Se eliminaron `handleCheckout`,
> `checkoutLoading`, el guard, el estado `needsAuth` y los imports residuales
> (`use`, `Order`, `PageProps`, `useRouter`, `useAuth`). **R2 queda aplicado al carrito**,
> que es el único punto de compra alcanzable.

### R3 — Traducción de los códigos HTTP del proyecto
`getFriendlyErrorMessage()` debe cubrir los códigos que el proyecto declara en
AGENTS.md §4.5.

**Criterio** — matching **anclado al prefijo** `API Error [n]`, nunca al número suelto
(porque `401` también aparece en un importe como `401.00`):

| Coincide con | Mensaje |
|:---|:---|
| `API Error [401]` | «Tu sesión ha caducado. Inicia de nuevo para continuar.» |
| `API Error [403]` | «No tienes permiso para realizar esta acción.» |
| `API Error [404]` | «No encontramos lo que buscas.» |
| `API Error [409]` | «No queda stock suficiente para completar el pedido.» |

**Actualización (2026-10-05, durante la implementación)**: el anclaje se ha aplicado
también al `500`, antes `message.includes("500")` — un cuerpo como
`{"importe":"500.00"}` en un `409` devolvía «Inténtalo de nuevo en unos minutos».
Los mensajes visibles no cambian; solo se corrige el falso positivo. El fallback
genérico y las reglas de validación preexistentes (email, credenciales, contraseñas…)
se mantienen intactos.

### R4 — Ninguna página pinta el error técnico
La regla 9 queda cumplida en todo el frontend.

**Criterio**: los **9** puntos que hoy hacen `err.message` pasan a
`getFriendlyErrorMessage(err)`:

| # | Archivo | Línea |
|:--|:---|:--|
| 1 | `app/cart/page.tsx` | 46 |
| 2 | `app/products/[reference]/page.tsx` | 108 |
| 3 | `app/products/[reference]/page.tsx` | 43 |
| 4 | `app/page.tsx` | 33 |
| 5 | `app/page.tsx` | 47 |
| 6 | `app/forgot-password/page.tsx` | 26 |
| 7 | `app/forgot-password/page.tsx` | 44 |
| 8 | `app/receipt/[orderNumber]/page.tsx` | 42 |
| 9 | `app/orders/[orderNumber]/page.tsx` | 31 |

Los *fallbacks* por tipo (`"Error al procesar el checkout"`) se conservan como segundo
argumento del `catch` cuando aplique.

### R5 — Sin cambios de backend
`SecurityConfig`, `OrderController` y `GlobalExceptionHandler` quedan intactos. El
`401` ya es el código correcto.

### R6 — Sin regresiones en la sesión existente
El resto de la sesión y el historial de pedidos siguen funcionando igual.

---

## 2. Errores

| Escenario | Estado | Mensaje visible |
|:---|:---:|:---|
| Comprar sin sesión | — (sin petición) | «Inicia sesión para completar tu compra» + enlace `/login` |
| Token caducado | `401` | «Tu sesión ha caducado. Inicia de nuevo para continuar.» |
| Sin permiso | `403` | «No tienes permiso para realizar esta acción.» |
| Recurso inexistente | `404` | «No encontramos lo que buscas.» |
| Stock insuficiente | `409` | «No queda stock suficiente para completar el pedido.» |
| Error de servidor | `500` | «Algo salió mal. Inténtalo de nuevo en unos minutos.» |
| Backend caído / red | — | «Algo salió mal. Inténtalo de nuevo.» |

---

## 3. Fuera de alcance

- **Código muerto de la PDP — RESUELTO (2026-10-05, decisión del usuario: borrarlo)**.
  `handleCheckout`, `checkoutLoading`, el guard R2 de la PDP y los imports residuales
  (`use`, `Order`, `PageProps`, `useRouter`, `useAuth`) se eliminaron. Se tradujeron
  2 warnings de ESLint de ese fichero a cero.
- **Checkout de invitado** — decidido que requiere sesión. Si se quiere, es una task
  aparte con su propia spec: exige `permitAll` en `/orders/checkout` y, sobre todo,
  decidir cómo recupera su pedido el invitado, porque hoy
  `GET /api/v1/orders/{orderNumber}` no comprueba propiedad.
- **Expiración proactiva del token en cliente** (24 h): no se recalcula `exp` en
  frontend; el `401` basta.
- **Rediseño del flujo de checkout**.

---

## 4. Tests

Todo bug corregido debe tener el test que lo reproduzca:

| # | Test | Reproduce |
|:--|:---|:---|
| T1 | `__tests__/Errors.test.ts` — 401, 403, 404, 409, 500 y fallback; y que ninguno devuelva el crudo | Bug 2b |
| T2 | `__tests__/ApiAuthHeaders.test.ts` — `checkout` y `getOrder` envían `Authorization`; sin token envían `{}` | Bug 1 |
| T3 | `__tests__/CartPage.test.tsx` — sin sesión no se invoca `api.checkout` y se ve el mensaje con enlace a `/login` | R2 |
| T4 | `__tests__/CartPage.test.tsx` — el backend devuelve 401 y el texto visible no contiene `API Error [` | Bug 2a |

Hoy **no existe ningún test de `lib/errors.ts`**; T1 lo crea.

---

## 5. Estimación

| Bloque | Esfuerzo |
|:---|:---|
| `lib/api.ts` (2 métodos) | ~5 min |
| `lib/errors.ts` (4 reglas) | ~15 min |
| `app/cart` + `app/products/[reference]` (guard R2) | ~30 min |
| Los otros 7 sitios de R4 (mecánico) | ~20 min |
| Tests T1-T4 | ~45 min |
| CHANGELOG + tasks | ~10 min |

**Total ≈ 2 h.** Backend intacto.

---

## 6. Criterios de aceptación

- [ ] `api.checkout()` y `api.getOrder()` envían `Authorization` con sesión
- [ ] Sin sesión, pulsar «Comprar» no genera petición y muestra el mensaje de R2
- [ ] `getFriendlyErrorMessage()` cubre `401`, `403`, `404` y `409` anclados a `API Error [n]`
- [ ] Ninguna de las 9 páginas pinta `err.message`
- [ ] Tests T1-T4 en verde
- [ ] `npx vitest run` y `npx eslint` limpios
- [ ] CHANGELOG actualizado
