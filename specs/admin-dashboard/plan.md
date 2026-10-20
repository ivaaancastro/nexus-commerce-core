# Plan — Tarea 7.6: Dashboard con métricas

> **Fase 7 · Panel de administración** · documento de diseño (D1–D9) · **✅ APROBADO 2026-10-20**.
> El alcance vinculante está en `spec.md`; la checklist de trabajo en `tasks.md`.

---

## 1. Objetivo

La 7.5 cerró la gestión de usuarios y con ella **las cinco secciones del panel
existen**, pero la portada `/admin` sigue siendo un menú de tarjetas: el
operador no ve **ventas, tamaño del catálogo ni cuántos usuarios hay** sin
entrar en cada sección y mirar. Es la pieza que falta para que el panel sea un
producto operable de verdad — y la última tarea de la Fase 7.

**Resultado esperado**: al entrar en `/admin`, el `ADMIN` ve de un vistazo
(a) **ventas del periodo** con ingresos y ticket medio **por moneda**,
(b) **pedidos por estado**, (c) **catálogo** (productos · SKUs · familias) y
(d) **usuarios** (total · administradores · suspendidos · nuevos en el
periodo), con selector de periodo **7 / 30 / 90 días**. Las tarjetas de acceso
directo siguen debajo y el **aviso «En construcción» desaparece**: la 7.6 es la
última tarea de la fase (la D6 de la 7.1 «sólo se promete lo que no existe» se
cumple). Un `USER` sigue redirigido.

---

## 2. Estado real — auditoría previa del repositorio (2026-10-20)

Hecha sobre el código de `main` (tras merge de la 7.5) antes de escribir la spec.

### 2.1 Los datos existen; no hace falta tocar el esquema

| Señal | Hallazgo |
|:---|:---|
| `entity/Order.java` | `marketCode` · **`currency(3)`** · `status: OrderStatus` · `subtotal/tax/total_amount BigDecimal(12,2)` · `createdAt: Instant` · `user` (LAZY, **nullable** desde V7). Índice **`idx_orders_created_at` ya existe desde V14** ✓ |
| `entity/OrderStatus.java` | `PENDING · CONFIRMED · SHIPPED · DELIVERED · CANCELLED`. El checkout crea `CONFIRMED`; `PENDING` nunca ocurre en la práctica; `CANCELLED` es terminal |
| Seeds de pedidos | **No hay ninguno en las migraciones** — la BD local sólo tiene pedidos creados por tests/E2E/checkouts de prueba → **las monedas pueden mezclarse** y los globales dependen del entorno |
| `entity/Product.java` | `referenceCode` · `name` · `family` · `skus` — **sin flag de activo** ⇒ catálogo = snapshot `COUNT` |
| `entity/User.java` | `role` · `suspendedAt` (7.5) · `createdAt: Instant` ✓ |
| Agregados ya probados | `ProductRepository` (`COUNT` + `GROUP BY family`), `StockItemRepository` (`COALESCE(SUM(…))`) — el patrón de aggregates en JPQL ya está en uso |
| Conteos 7.5 | `UserRepository.countByRoleAndSuspendedAtIsNull(Role)` existe; el resto de conteos (`count()` derivados) son de JpaRepository |
| Pagos y devoluciones | **No hay pagos reales** (el checkout crea el pedido directo) y las devoluciones **no mueven dinero** (7.4: «registro contable, sin movimiento») ⇒ no existen reembolsos que descontar |

### 2.2 Infraestructura reutilizable (ya está hecha)

- **Seguridad 7.1 (ADR-0006)**: `requestMatchers("/api/v1/admin/**").hasRole("ADMIN")`
  antes de `denyAll()` → el endpoint nuevo hereda 401/403 **con cero cambios**
  (mismo argumento que D1 de la 7.2, 7.3, 7.4 y 7.5).
- **`GlobalExceptionHandler` ya trae `IllegalArgumentException → 400` con
  `message`** (L180-187) → la validación del parámetro de periodo **no necesita
  ningún handler nuevo**.
- Frontend: `api.ts` con la zona `/api/v1/admin/**` montada, `errors.ts` con la
  rama genérica 403, `AdminPage.test.tsx` con mocks ya establecidos
  (`api.getCurrentUser`/`api.getMarkets`) y `SECCIONES` con «PANEL».
- `getFriendlyErrorMessage()` + estados «Reintentar» con patrón probado en
  `/admin/orders` y `/admin/users`.

### 2.3 Observaciones

- `/admin` hoy **no hace ninguna llamada a la API** (sólo renderiza tarjetas):
  añadirle fetch introduce el estado cargando/error en una página que no lo
  tenía — se cubre con tests (D8).
- El test `AdminPage.test.tsx` aserta hoy `en construcción` + `7.6` (cambio
  **declarado** en la R8.3 de la 7.5): la 7.6 lo retira — es la 3.ª vez que
  evoluciona ese aserto (7.2 → 7.4 → 7.5 → 7.6), precedente aceptado.

---

## 3. Decisiones de diseño

### D1 — Un único `GET /api/v1/admin/dashboard`, hereda la regla 7.1

| Alternativa | Por qué no |
|:---|:---|
| 3 endpoints (ventas/productos/usuarios) | El dashboard es **una sola pantalla**: 3 roundtrips sólo retrasan el primer pintado y multiplícan los estados de error. |
| Recalcular en cliente desde los endpoints de 7.2–7.5 | El listado de productos trae páginas de 20: los totales exigirían fetch de todas las páginas o contar mal. |

| Método | Path | Éxito |
|:---|:---|:---|
| `GET` | `/api/v1/admin/dashboard` | `200` `AdminDashboardResponse` |

- Query param opcional **`days`** (def. `30`).
- **Cero cambios en `SecurityConfig`** (diff = 0 líneas).

### D2 — Agregados de sólo lectura en repositories, sin N+1

- `AdminDashboardService` con `@Transactional(readOnly = true)`; las queries
  viven en los repositories que ya corresponden (`OrderRepository`,
  `ProductRepository`/`SkuRepository`, `UserRepository`) — **patrón de la 7.3**
  (la lógica de cada dominio queda en su repository).
- Queries nuevas tipo `COUNT`/`SUM`/`GROUP BY` sobre **escalares**: la
  respuesta **no contiene entidades** ⇒ N+1 imposible por construcción.
- ~6 consultas baratas; **sin índices nuevos**: `orders(created_at)` ya está
  indexado (V14) y `users`/`products` son tablas pequeñas.
- **Sin locks y sin escrituras**: un GET puro no puede interferir con el
  checkout ni con el panel (a diferencia de la 7.4, aquí no hay concurrencia
  que coordinar).

### D3 — Ventas honestas: excluye cancelados y **nunca cruza monedas**

- **Ingresos y contador de ventas excluyen `CANCELLED`** (un cancelado no es
  venta); **`byStatus` cuenta los 5 estados** (incluye los cancelados — es un
  recuento de pedidos, no de ingresos).
- **`revenue` es un array agrupado por `currency`** — jamás se suman € con $,
  £ o CHF. Misma verdad que la decisión 3.2/R8b («el umbral traduce la moneda,
  no el valor»): **no existe un tipo de cambio en el sistema** y inventarlo
  sería un dato falso en un producto que se vende. Cada fila lleva su
  `total`, su `orderCount` y su `avgTicket`.
- **Ticket medio = SUM / COUNT por moneda**, `BigDecimal` `HALF_UP` escala 2
  (regla 4.1). Cero pedidos en el periodo ⇒ `revenue: []` (sin divisiones).
- **Sin pagos ni reembolsos que modelar** (2.1): «ventas» = suma de
  `total_amount` de pedidos **no cancelados** creados en el periodo. El label
  de la UI lo dice explícitamente («pedidos no cancelados») — el panel no
  promete una caja que no calcula nadie.

### D4 — Periodo: `days` 1–365 (def. 30), validado con el handler que ya existe

- El servicio valida `1 ≤ days ≤ 365` y, fuera de rango o no numérico,
  lanza **`IllegalArgumentException`** con mensaje en español → **handler
  existente → `400` con `message`** (2.2). **Cero handlers nuevos.**
- Descartado: `enum` de periodos `{7,30,90}` en servidor (rechazaría `days=14`
  sin motivo); la UI ofrece 7/30/90 como atajos, la API admite cualquier día.
- `from = now − days` (instante del servidor, misma tolerancia que el resto).

### D5 — DTOs nuevos; entidades jamás expuestas

- `AdminDashboardResponse` con bloques anidados: `range` · `sales` ·
  `products` · `users`, más `RevenueCurrency(currency, total, orderCount,
  avgTicket)`.
- `byStatus` es un mapa con **las 5 claves siempre presentes** (con `0` si no
  hay) — la UI pinta las 5 filas sin condicionales.
- `users.admins` = `ADMIN` **sin suspender** (reutiliza el criterio de la 7.5);
  `users.suspended` = cuentas con `suspendedAt != null` (cualquier rol).
- `sales.byStatus` y `sales.orderCount` miden cosas distintas y así se
  documentan: `orderCount` = ventas (sin cancelados) · `sum(byStatus)` =
  todos los pedidos creados en el periodo.

### D6 — Sin migración, sin índices, sin reindex

- **V15 sigue siendo la última migración**: todos los campos necesarios ya
  existen (2.1). Ningún cambio en V1–V15 (mismo criterio que 7.3).
- Los pedidos no son texto de catálogo ⇒ nada de reindex.

### D7 — Frontend: los KPIs arriba de `/admin`, tarjetas debajo, aviso fuera

| Superficie | Contenido |
|:---|:---|
| **Sección «Métricas»** (nueva, arriba) | Grid de 4 tarjetas: **Ventas del periodo** (nº de pedidos no cancelados + ingresos por moneda con ticket medio) · **Pedidos por estado** (las 5 filas con recuento y barra CSS proporcional al máximo) · **Catálogo** (productos · SKUs · familias) · **Usuarios** (total · administradores · suspendidos · nuevos en el periodo) |
| **Selector de periodo** | 3 botones **7 / 30 / 90 días** (activo con `border-neutral-900`), refetchea al pulsar — mismo lenguaje que los filtros del panel |
| **Tarjetas de acceso** | Las 4 existentes **sin cambios**, debajo de las métricas |
| **Aviso «En construcción»** | **Desaparece** (7.6 cierra la Fase 7; la promesa se cumple) |
| **Estados** | cargando · error de red con `getFriendlyErrorMessage()` + «Reintentar» · ceros visibles cuando el periodo está vacío (nunca «—» ni crash) |
| **Formato** | Importes con `Intl.NumberFormat("es-ES", { style: "currency", currency })` por moneda · recuentos como enteros. **Sin librerías de charts**: las barras por estado son `div` con ancho en `%` |

- `api.ts` gana `getAdminDashboard(days?)` (≥ 99 preservado) · tipos en
  `types/commerce.ts` o `auth.ts` según dominio (decisión: **`commerce.ts`** —
  el dashboard cruza dominios pero sus datos son de comercio; los tipos de
  usuario ya expuestos no cambian).
- Sección extraída en un componente **`AdminMetrics`** (`components/admin/`):
  se testea aislado y `AdminPage` sólo lo compone (patrón componentes
  reutilizables 6.6).

### D8 — Tests: números exactos con mocks, sólo consistencia contra BD real

- **Servicio con mocks** (`@ExtendWith(MockitoExtension.class)`): aquí se
  prueban los **números exactos** — exclusión de cancelados, suma por moneda,
  ticket medio con HALF_UP, `byStatus` con las 5 claves, `days` inválido →
  excepción, `from = now − days`.
- **Controller MockMvc `@SpringBootTest` + BD real** (patrón 7.4/7.5): shape
  del JSON, `days` inválido → `400` con `message`, seguridad `401`/`403`/`200`,
  y **consistencia** (los bloques cuadran entre sí) — **jamás globales
  exactos**: la BD compartida cambia con cada corrida (lección 4.2/D5).
- **Frontend**: `AdminMetrics` (render de bloques, selector → llamada a la
  API, estados vacío/carga/error) + `api.ts` (URL/auth/param) + cambios
  declarados (D8.3 abajo).
- **R8.3 declarada** (4.ª evolución, precedente 7.2→7.4→7.5):
  `AdminPage.test.tsx` → **sin** «en construcción»/«7.6», **con** la sección de
  métricas; el resto de aserciones (saludo, 4 tarjetas, `replace` sin llamar)
  **intactas**. `AdminLayout.test.tsx` **no cambia** (`SECCIONES` no cambia:
  «PANEL» ya existe).

### D9 — Sin ADR, sin E2E/a11y nuevos, sin PR de documentación de cierre

- **Sin ADR**: mismas capas, mismos records, misma regla de seguridad de
  ADR-0006, ninguna decisión de stack nueva (criterio 7.2–7.5).
- **Sin rutas nuevas en E2E ni `a11y.spec.ts`** (precedente 7.2–7.5: exigiría
  login ADMIN en E2E) — la cobertura es de componente + la verificación en
  navegador de R9.1.
- Estado en la **feature PR** (convención D11); `CHANGELOG` + `AGENTS.md` +
  `MEMORY.md` dentro de la misma PR.

---

## 4. Fuera de alcance

- ❌ **Serie histórica / gráficos de líneas por día** — exigiría `date_trunc`
  nativo con problemas de zona horaria y una librería de charts; los KPIs del
  periodo dan la foto (mismo criterio «sin carrusel/lightbox» de la 3.3).
- ❌ **Comparativa vs periodo anterior** (delta %) — duplica las queries; se
  valorará después con datos reales.
- ❌ **Pagos, caja real, reembolsos y métricas de devoluciones** — no existen
  en el sistema (2.1): el panel no muestra dinero que nadie ha cobrado.
- ❌ **Alertas, polling o auto-refresh** — los KPIs se cargan al abrir y al
  cambiar de periodo.
- ❌ **Export CSV, filtros por mercado/mercado específico, multi-idioma**.
- ❌ **Stock bajo / alertas de inventario** como KPI (la matriz de la 7.3 ya
  cubre la operativa diaria).
- ❌ **Fase 8** (Dockerfile, seeds, instalación) — tarea siguiente.

---

## 5. Estimación y orden de implementación

| Bloque | Contenido | Peso |
|:---|:---|:---:|
| **A** | DTOs (`AdminDashboardResponse` + `range/sales/products/users` + `RevenueCurrency`) — sin excepciones ni handlers nuevos | bajo |
| **B** | Queries en `OrderRepository`/`ProductRepository`/`SkuRepository`/`UserRepository` + `AdminDashboardService` (readOnly, validación `days`) + `AdminDashboardController` (`GET /api/v1/admin/dashboard`) | medio |
| **C** | Tests backend: servicio con mocks (números exactos, exclusión cancelados, monedas separadas, HALF_UP, `days` inválido) + controller MockMvc BD real (shape, 400/401/403/200, consistencia) | medio |
| **D** | Frontend: tipos + `getAdminDashboard` en `api.ts` (≥ 99) | bajo |
| **E** | `AdminMetrics` (4 tarjetas + selector + estados) + montaje en `/admin` + aviso fuera | medio |
| **F** | Tests frontend: `AdminMetrics` + `api.ts` + `AdminPage` (R8.3 declarada) | medio |
| **G** | CHANGELOG + bloques ESTADO ACTUAL (`AGENTS.md`/`MEMORY.md`) en la PR + verificación navegador + `/spec-check` | bajo |

**Baselines que deben seguir verdes** (medidos tras la 7.5): `./mvnw test` →
**325** · `npm run test:coverage` → **441+** y EXIT 0 (umbrales congelados 77 /
76 / 74 / 79 + `api.ts` ≥ 99) · `tsc` 0 · ESLint 0/0 · `npm run build` 0 ·
E2E local (Chromium+WebKit) → 36 passed + 14 skipped · CI 4/4 ·
`/spec-check admin-dashboard` → aprobado.

---

## 6. Riesgos identificados

| Riesgo | Mitigación |
|:---|:---|
| **La BD compartida de tests cambia** (pedidos de otros tests/E2E) → assertions de globales frágiles | Números exactos **sólo con mocks de repositorio**; contra BD real sólo **consistencia** (D8) — lección 4.2/D5 |
| Sumar ingresos de monedas distintas sería **dato falso** | `revenue` es array por moneda, jamás un total único (D3) + test que lo reproduce |
| Un pedido **cancelado** contado como venta | Exclusión explícita de `CANCELLED` en ingresos y `orderCount`, con test; `byStatus` sí los cuenta |
| `/admin` empieza a hacer fetch: pantalla que antes no podía fallar | Estados cargando/error+«Reintentar» y tests de los tres estados (E/F) |
| `days` inválido → error 500 sin traducir | Validación con `IllegalArgumentException` → **handler 400+message ya existente** (D4) + test |
| Ticket medio con división por cero o escala larga | `revenue: []` sin filas ⇒ sin división; `HALF_UP` escala 2 donde sí (4.1) |
| `AdminPage.test` cambia otra vez | **R8.3 declarada** en la spec (4.ª vez, precedente); aserciones de tarjetas/saludo intactas |
| Ceros en periodo vacío | Tests de render con `0` y `[]` (nunca `NaN`, `undefined` ni «—») |
