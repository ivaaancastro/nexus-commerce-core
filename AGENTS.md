# AGENTS.md — Nexus Commerce Core

> **Este archivo se carga automáticamente en cada sesión y se refresca si lo editas.**
> Contiene las convenciones, reglas críticas y el estado actual del proyecto.

---

## ⚡ ESTADO ACTUAL (leer primero)

| Campo | Valor |
|:---|:---|
| **Rama activa** | `main` — **V1 `order-status-emails`** (notificaciones de pedido por email) completada y mergeada; specs en `specs/order-status-emails/` |
| **Fase** | **Hoja de ruta 6–10 (producto vendible) — aprobada** — **Fase 6 Deuda técnica (previa), 7.1–7.6 y la mini-feature `product-photos` (fotos IA) completadas** · **Fase 7 panel de administración COMPLETA (7.1–7.6)** · mini-features **`checkout-payment-grid`** (fix selector de pago), **`final-price-display`** (precio final con impuestos incluidos) y **`color-and-care`** (colores y cuidados, Tarea C) completadas y **mergeadas** · fases 1–5 y 3.x/4.x completadas · **bloque «Mejoras de vitrina» V1–V6 aprobado ANTES de la Fase 8 y en curso — V1 completada** (la 8 queda aplazada; **PSP = fase propia** fuera del bloque) |
| **Tarea** | **V2 — Zoom/lightbox en la galería de la ficha** (`specs/zoom-lightbox/` **por crear** — ⏳ SDD: nada de código sin spec) — revisa la decisión D5 de la 3.3 («sólo scroll, sin lightbox»), sólo frontend. **La V1 está cerrada**: `/spec-check` **APROBADO**, ver el bloque «Decisiones V1 `order-status-emails`» |
| **Tarea siguiente** | **V3 wishlist → V4 reviews → V5 cupones → V6 fotos por color + demo multicolor** |
| **Pendiente** | **Plan + spec de la V2 (zoom/lightbox)** — ⛔ punto de bloqueo SDD |
| **Actualizado** | 2026-10-26 |

> **Estado de pruebas**: **380 backend · 470 frontend** · ESLint **0 errores, 0 warnings** · **E2E: 5 pruebas de humo × 3 navegadores + 14 de axe (sólo Chromium)** · **Lighthouse en verde en 4 rutas** · CI verde en `main`.
> **Decisiones V1 `order-status-emails` (`specs/order-status-emails/`, sin ADR — D11)**: la fila del email se inserta **en la misma transacción** que el cambio (D2/R5) — **rollback ⇒ sin fila, commit ⇒ intención garantizada**, medido contra PostgreSQL real en `EmailOutboxTransaccionalTest`; el notifier va con `try/catch` → `log.error(«el pedido no se ve afectado»)` para que **el email nunca cambie el resultado** (R4) · **plantilla compartida por los 3 emails** (R7): `EmailHtmlTemplates` en **text block con tokens `{{...}}` + `String.replace`** (D5 — la primera implementación usó `String.format` y **se reconvirtió a la spec** durante el spec-check: los 3 previews salieron **byte-idénticos**, ni un byte cambió), CSS inline, pila Geist, *wordmark* «NEXUS», botón `neutral-900`, columna única; `MimeMessageHelper` **`multipart/alternative`** y `SimpleMailMessage` fuera (RT3) · **`V17` + poller**: toma con **CAS `WHERE status='PENDING'`** (nadie envía dos veces), alquiler de 10 min con recuperación de atascadas, backoff **30 s duplicando, tope ~1 h, 8 intentos → `FAILED`**, filas que nacen a **`created + 30 s`** (D10) y **nunca lanza** al programador; **RT9 reforzado en `pom.xml`**: surefire fija `spring.mail.username` **vacío** → todos los contextos de test corren en MODO DESARROLLO (**medido: 0 SMTP · 5 logs** — antes los tests de contexto podían disparar el SMTP real de `backend/.env`/Mailtrap) · **enganches a una línea** (RT4) en `OrderService` (destino `CONFIRMED`, copy «recibido», nunca «pagado») y `AdminOrderService` (destino = estado elegido), con **`OrderStatus.etiqueta()`** como fuente única del copy en español (RT6) · **gates medidos**: **349 → 380 backend** (+31: 25 en 5 clases nuevas, +4 en `EmailServiceTest` con **R8.3 declarada**, +1+1 en `OrderServiceTest`/`AdminOrderServiceTest` con **diff = adiciones puras**) · **470 frontend** intactos (`tsc` 0 · ESLint 0/0 · build 0) · **E2E rápido 25/25** sin tocar `e2e/` · los 3 previews **abiertos en navegador** (D12) · **stack real**: compra `ORD-977046A0` → fila → `+30 s` → log MODO DESARROLLO → `SENT`; transición desde el panel → fila «— Enviado» → log con **tracking «Correos Express · nº TEST-112233»** y enlace `/orders/…`; **repetir estado → `409` sin fila nueva** · `/spec-check` **APROBADO** · **sin frontend, sin ADR y sin PR de documentación de cierre**.
> **Decisiones `final-price-display` (`specs/final-price-display/`, sin ADR — D6)**: la vitrina **no desglosa** — precio final + **«Impuestos incluidos (X %)»** uniforme en todos los mercados (D2/R4: ES=IVA, UK=VAT, US=*sales tax*, y `TaxCopy.test.ts` prohíbe la cadena «IVA» y el símbolo `€` en `src/`) · el copy se escribe **una sola vez** en **`src/lib/taxes.ts`** y lo importan PDP, carrito, drawer y pedido — la guardia se reforzó para comprobar justamente eso · **D3: la parte incluida se *deriva*** (`subtotal × rate/(100+rate)`, la inversa de `PricingService.netAmount()`), es **sólo presentación** y **`Total = Subtotal`** — corrigiendo un **bug medido**: el carrito sumaba el 21 % encima de un subtotal que ya lo incluía (79,95 € mostraba «Total estimado» **96,74**) · `taxEstimate` → **`taxIncluded`** (+ `taxRate` expuesto por el propio contexto, misma fuente que la nota) · el porcentaje del pedido se **recupera de sus importes** (`taxRateFromAmounts`), no de la tasa del mercado activo · **`backend/`, `/receipt` y panel admin con diff = 0**, sin migración, sin E2E nuevos, **sin ADR** y **sin PR de documentación de cierre** · **R8.3 medidas, no supuestas**: cambiaron `CartContext`, `ProductDetailPage` (regex `(21%)`→`(21 %)`) y `TaxCopy`; `CartPage`/`CartDrawer`/`OrderDetailPage` **no tenían aserciones del trío** y se les **añadieron** pruebas · **461 frontend** · verificación **programática** sobre stack real (PDP sin desglose · carrito/drawer `Total == Subtotal` y parte real · pedido con enlace al recibo · **`/receipt` con desglose = comprobación negativa** · UK «(20 %)») · ⚠️ **releve**: los tests de integración del backend **no cargan el contexto sin el PostgreSQL del proyecto** (`docker compose up -d`), y dan 125 errores engañosos.
> **Mergeado**: Tareas 5.3, 5.4 y 5.5 (Gestión de Usuarios), el fix de checkout, **Tarea 3.2** (Mercado y Divisa), **Tarea 3.1** (Familias y Filtros), **Tarea 3.3** (Galería de Imágenes Responsive), **Tarea 4.1** (Suite de Pruebas y Cobertura), **Tarea 4.2** (Test E2E con Playwright), **Tarea 4.3** (Auditoría CWV y Accesibilidad), la **Fase 6 — Deuda técnica (6.1 header responsive · 6.2 búsqueda sin `OPENAI_API_KEY` · 6.3 `searchMode` + cobertura de `api.ts` · 6.4 seguridad `denyAll` + health check)**, la **Tarea 7.1 — Roles y permisos `ADMIN`/`USER`**, la **Tarea 7.2 — CRUD de productos, SKUs e imágenes**, la **Tarea 7.3 — Gestión de stock y precios multimercado**, la **Tarea 7.4 — Gestión de pedidos (ver, cambiar estado, tracking)**, la mini-feature **`product-photos` — fotos de producto con IA en `npm run images`** y la **Tarea 7.5 — Gestión de usuarios (ver, suspender, cambiar rol)** y la **Tarea 7.6 — Dashboard con métricas**, y la **V1 — Notificaciones de pedido por email con plantilla HTML compartida y outbox (`order-status-emails`)**. **Los números de PR y los SHA no se llevan aquí**: viven en git y en GitHub (`gh pr list`, `git log`).
> **Decisiones `product-photos` (`specs/product-photos/`, sin ADR — D9/D10)**: regla central **«ausencia = generar · presencia = sagrado»** con `--force`/`--no-photos` y `photoMode` AI/FREE/PLACEHOLDER (D1/D2) · prompt **offline desde las migraciones** con color por **dos vías (D3b ampliada 2026-10-19, aprobada)**: emparejamiento V12 referencia+barras **y** SKU de `V1` por **posición de `product_id` con guarda anti-adivinar** (`0432/021 → Marino`, coherente con la facet «MARINO») · cadena **Gemini → FLUX gratis → póster** con **401/403/429 desactivando al proveedor en la corrida** (D11): Gemini free = `0 requests/day` (medido en vivo) y **FLUX = `@cf/black-forest-labs/flux-1-schnell`, body JSON `{prompt, steps: 4}`** — **esquema cerrado medido en vivo (19/10): sólo admite esas dos claves**, salida **1024×1024 recortada a 3:4** — credenciales **`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (las dos o ninguna) en el `.env` raíz**, **12/12 fotos FLUX reales adoptadas** (gratis ≈173/día, Apache 2.0) · **manifiesto y frontend intocados** (mismo shape, cero diff en consumidores — D7) · **+35 tests → 424** · **sin ADR, sin migraciones, CI intocado** (D9) y **sin PR de documentación de cierre** (D10) · ⚠️ **`/_next/image` cachea por URL**: al cambiar fotos en local, `rm -rf .next/cache/images` + contexto de navegador limpio (medido: servía la versión anterior).
> **Decisiones 7.1 (`specs/admin-roles/`, ADR-0006)**: rol en el **claim `role` del JWT** (access y refresh) con asunción **`USER` sin claim** — mínimo privilegio, jamás `ADMIN` (D2) · **`hasRole("ADMIN")` ANTES de `anyRequest().denyAll()`**: sin la regla el `denyAll` de la 6.4 cerraría `/admin/**` también al ADMIN · `V13` con **`DEFAULT 'USER'`** (clasifica existentes sin `UPDATE`, `IF NOT EXISTS` reejecutable) y **semilla admin idempotente** nacida `email_verified = TRUE` con hash BCrypt coste 12 — credenciales en el **README** (`.env.example` no existe: decisión documentada en `tasks.md`) · **`@Builder.Default role = Role.USER`** para que los `User.builder()` de los tests no inserten `NULL` · el **refresh toma el rol de BD** (el flujo ya recarga el usuario) · frontend = **visibilidad, no seguridad** (`AdminRoute` + enlace condicional; el `403` de la API es la puerta de verdad) · `/admin` **sin maqueta** (D6) · **sin PR de documentación de cierre** (D11).
> **Decisiones 7.2 (`specs/admin-product-crud/`, sin ADR — D10)**: CRUD bajo `/api/v1/admin/products/**` que **hereda `hasRole("ADMIN")` con cero cambios en `SecurityConfig`** (D1) · **«variante» == SKU, sin entidad nueva** (D2) · `referenceCode`/`barcode` **inmutables** — los `PUT` no los traen en el body (D3) · **borrado duro con guarda `409` contra `order_items`** y carreras (`DataIntegrityViolationException`) traducidas a `409`, nunca a `500` (D4) · imágenes **sólo lectura desde el manifiesto**, con la receta (`public/products/` + `npm run images`) visible en la UI y **sin subida** (D5) · **sin auto-reindex** — el README documenta el `POST /products/search/index` manual (D6) · `CatalogConflictException` → **`409` + `code: CATALOG_CONFLICT`** y handler nuevo de `MethodArgumentNotValidException` → **`400` con `message`** (D7 + derivada) · validación `jakarta` + **espejo en cliente** (D8) · SKU nuevo **sin `market_prices`/`stock_items`** — frontera con la 7.3 (D9) · **`AdminRoute` se muda a `app/admin/layout.tsx`** (una puerta para `/admin/**` + subnavegación con `aria-current`) · éxito con **toast en el propio formulario** — navegar desmontaría el toast · **sin ADR** y **sin PR de documentación de cierre** (D10/D11).
> **Decisiones 7.3 (`specs/admin-stock-pricing/`, sin ADR — D9)**: 4 endpoints bajo `/api/v1/admin/**` que **heredan `hasRole("ADMIN")` con cero cambios en `SecurityConfig`** (D1) · matriz `GET /admin/stock` **agregada sin N+1** con **celda sin fila = `0/0/0`** y `PUT` de **una sola celda** con upsert — el admin edita **sólo `quantityAvailable`** (D2/D3) · **`available < reserved` → `409 STOCK_CONFLICT`** (`StockConflictException`, mensaje en español bajo la celda y **sin toast de éxito**) y carreras de inserción → `409`, **nunca `500`** — escritura con el `PESSIMISTIC_WRITE` existente (D3/D4) · precios: `GET` devuelve **los 4 mercados siempre** con `nulls` y `PUT` upsert con validación **en dos capas** (jakarta `@Positive @Digits(8,2)` + cross-field `0 < descuento ≤ base` → `400`), **descuento vacío viaja como `null`, nunca `0`** (D5) · **vitrina intocada** — mismas filas de `market_prices`/`stock_items`, reflejo en vivo (D7) · UX: **`/admin/stock` con guardado por celda** (habilitado sólo si cambió), precios **por SKU con guardar por fila** (botón «Guardar precio», no colisiona con «Guardar» de SKUs) en la ficha de producto y **tarjeta «Stock y precios»** en la portada (D8) · **sin migración, sin reindex y sin ADR** (D9).
> **Decisiones 7.4 (`specs/admin-orders/`, sin ADR — D9)**: 4 endpoints bajo `/api/v1/admin/orders/**` que **heredan `hasRole("ADMIN")` con cero cambios en `SecurityConfig`** (D1) · listado **sin N+1** (`LEFT JOIN FETCH user` + `countQuery` sin FETCH, 0/20 `createdAt DESC`, items por `@BatchSize`; `q` se **recorta en servidor** y matchea en `LOWER`; **`CAST(:q AS string)` obligatorio** — con `q = null` PostgreSQL resolvía `function lower(bytea) does not exist`) (D2) · **máquina de transiciones**: `PENDING→{CONFIRMED,CANCELLED}`, `CONFIRMED→{SHIPPED,CANCELLED}`, `SHIPPED→{DELIVERED}`, `DELIVERED`/`CANCELLED` = fin; **mismo estado o inválida → `409 ORDER_CONFLICT`**, fila del pedido tomada con `PESSIMISTIC_WRITE` (D3) · **cancelar libera exactamente la reserva** (fila ausente → `warn` y sigue) y **enviar descuenta `available` y consume la reserva** con guarda `available < quantity` → **`409 STOCK_CONFLICT` con rollback del estado**; `CONFIRMED`/`DELIVERED` no mueven stock (D4) · **V14** = `carrier` + `tracking_number` **ambos nullable** + índices `idx_orders_status`/`idx_orders_created_at`, y `PUT /tracking` **full-replace en cualquier estado** (vacío/espacios → `null`) (D5) · `AdminOrderDetailResponse` **compone el `OrderResponse` del cliente** (`OrderService.mapToOrderResponse` reutilizado **package-visible** — una sola definición de nulls) + `userEmail` + **`returnRequested` sólo como flag informativo** — el backoffice de devoluciones queda fuera (decisión del usuario) (D6) · **vitrina y cliente intactos** (`OrderController`/`UserOrderController`/devoluciones sin cambios, verificado por diff; la ficha del cliente **añade** el bloque «Seguimiento» en `/orders/[orderNumber]`) (D7) · **`/admin/orders` + detalle**: filtros y búsqueda **en servidor** (nunca `filter()` en cliente), panel de estado **sólo con las transiciones permitidas** (espejo TS que duplica la tabla — el servidor manda), `window.confirm` al cancelar, **toast + panel actualizado con la respuesta del `PUT`, sin re-fetch**, «Guardar seguimiento» habilitado **sólo si cambió**, `SECCIONES` gana «Pedidos» y «Stock» (D8) · **sin ADR y sin PR de documentación de cierre** (D9).
> **Decisiones 7.5 (`specs/admin-users/`, sin ADR — D9)**: 3 endpoints bajo `/api/v1/admin/users/**` que **heredan `hasRole("ADMIN")` con cero cambios en `SecurityConfig`** (D1) · **`V15` = `users.suspended_at TIMESTAMPTZ NULL`** — `NULL` = activa (todas las existentes sin `UPDATE`), con valor = instante de la suspensión (un `boolean` no sirve: pierde el cuándo); sin índice a propósito y `IF NOT EXISTS` reejecutable (D2) · la **suspensión corta `login` y `refresh`**: el chequeo entra **después de validar la contraseña** y en el orden `usuario → contraseña → suspendido → emailVerified` — **sin la contraseña nadie deduce que la cuenta está suspendida** (anti enumeración), verificar el email **no desbloquea**, y `refreshToken` recargado de BD **no emite tokens nuevos**; `UserSuspendedException → 403` «La cuenta está suspendida. Contacta con soporte.» (patrón §5.5, **no** `IllegalStateException`); el **access token vigente dura hasta expirar** — limitación documentada de lo stateless (D3) · guardas **`409 USER_CONFLICT` previas a la escritura**: ni degradar ni suspender al **último admin activo** ni **auto-suspenderse**; auto-degradar **sí** si queda ≥ 1 admin activo distinto; suspensión **idempotente** (conserva el instante original) y **sin tocar datos** (pedidos/direcciones/histórico intactos) (D4/D8) · `AdminUserResponse` **único** lista/`PUT` con `suspended` derivado en servidor y mapper **sólo escalaros** (sin N+1), `q` recortado con `CAST(:q AS string)` y vacíos → `200` con lista vacía (nunca `404`); handler nuevo **`HttpMessageNotReadableException → 400 con message`** (un rol fuera de la enumeración llegaba como 400 de Spring **sin** `message`) (D5) · frontend **`/admin/users`**: búsqueda **en servidor** (nunca `filter()`), «Suspender»/«Quitar administrador» con `window.confirm` y «Restaurar»/«Hacer administrador» directos, **toast + fila actualizada con la respuesta del `PUT`, sin re-fetch**, `409` **bajo la fila sin toast** con la fila intacta; **`errors.ts` gana la regla por texto «suspendida» ANTES de la rama 403** (el login de una cuenta bloqueada no diría «No tienes permiso…») y `USER_CONFLICT` en la rama 409 · **`SECCIONES` gana «Usuarios»**, tarjeta en la portada y el aviso honesto queda **sólo «7.6 Dashboard»** · registro/verificación/reset y `/api/v1/users/**` **intactos** (diff verificado) · **+38 backend → 325 · +17 frontend → 441** con R8.3 declarada (`AdminPage` aviso→7.6, `AdminLayout` aditiva «Usuarios»), gate de coverage EXIT 0 y **verificación en navegador 10/10** · **sin ADR y sin PR de documentación de cierre** (D9) · ⚠️ **releve**: `next build` con un `next start` previo vivo dejó un `.next` **sin** la ruta nueva — reconstruido con `rm -rf .next` (trampa 7.4, medida de nuevo).
> **Decisiones `checkout-payment-grid` (`specs/checkout-payment-grid/`, sin ADR — D4)**: fix cosmético + accesibilidad del selector de método de pago de `/cart`, reportado en la prueba manual post-Fase 7 — **único fichero tocado** `cart/page.tsx` (6+/6−) · el grid gana **`auto-rows-fr`** porque `h-full` sólo iguala alturas *dentro* de cada fila implícita (medido: 34/34/50/50 → 50/50/50/50) y el `<label>` gana `flex h-full items-center justify-center text-center` · el foco de teclado se hace visible con **`has-[:focus-visible]:ring-1 ring-neutral-900 ring-offset-2`** — la primera aproximación con **`peer-focus-visible` no puede funcionar** (`peer-*` emite selector `~` hermano y el input está *dentro* del label; medido: `:focus-visible` matcheaba pero `boxShadow` = `none`), spec actualizada con la regla 3 · **markup semántico intacto** (radios, `name`, nombre accesible = label) → **R8 íntegra, ningún test tocado** · **sin test nuevo** (D3: un aserto sobre clases testearía implementación; la semántica la cubre `CartPage.test.tsx` y la ruta `a11y.spec.ts`) con verificación **programática** con Playwright (alturas/centrado desktop+móvil, anillo con teclado y **ausente con ratón**, ambos medidos por `boxShadow`/`:focus-visible`) · gates: **448** frontend · axe `/cart` 14/14 · `tsc` 0 · ESLint 0/0 · build 0 · **sin backend y sin PR de documentación de cierre**.
> **Decisiones 7.6 (`specs/admin-dashboard/`, sin ADR — D9)**: **1 `GET /api/v1/admin/dashboard?days=…`** (1–365, default 30 en el `@RequestParam`, sin duplicarlo en cliente) bajo `/api/v1/admin/**` que **hereda `hasRole("ADMIN")` con cero cambios en `SecurityConfig`** (D1) · **sólo lectura** — agregados `COUNT`/`SUM`/`GROUP BY` sobre escalares, sin N+1, sin locks y sin interferencia con el checkout (D2) · **`revenue` SIEMPRE agrupado por `currency` y sin `CANCELLED`** (aquí no se suman monedas: no hay tipo de cambio) con `avgTicket` `HALF_UP` escala 2, **`byStatus` con las 5 claves siempre presentes** y `orderCount` (no cancelados) ≠ `sum(byStatus)` (todos) documentado en el DTO (D3) · `days` fuera de rango → `IllegalArgumentException` → **handler existente `400` con `message`, cero handlers nuevos**; **sin migración** (`db/migration/` intacto, V1–V15) (D4/D9) · DTO `AdminDashboardResponse` con bloques anidados `range/sales/products/users` (D5) · frontend **`AdminMetrics` en la portada `/admin`, sobre las 4 tarjetas de acceso**, con selector **7/30/90** (`aria-pressed`, activo `border-neutral-900`), ingresos y ticket medio **por moneda** con `Intl.NumberFormat`, estados con **barras relativas decorativas** (`aria-hidden` — el número es la información), **ceros visibles** en periodo vacío (nunca `NaN` ni «—») y **el aviso «En construcción» desaparece** — **sin sección nueva en `SECCIONES`** (D6/D7) · `api.getAdminDashboard(days?)` sin query si no hay `days`, **`errors.ts` sin cambios** · estado de carga **derivado** (`!datos && !error`) por la regla `react-hooks/set-state-in-effect` · **R8.3 declarada**: `AdminPage.test.tsx` (aviso fuera, métricas dentro; saludo/rol/tarjetas intactos) · **+20 backend → 345 · +7 frontend → 448** · **sin ADR y sin PR de documentación de cierre** (D9).
> **Decisiones `color-and-care` (`specs/color-and-care/`, sin ADR — D7)**: selector de color en la PDP **derivado de `product.skus`** — sin dato nuevo, sin columna y **visible también con un solo color** (D1) — que **filtra la rejilla de tallas** a las del color activo (D2) y **conserva la talla** al cambiar, con caída a la primera disponible si ese color no la tiene (R3) · **`V16` = `products.care_instructions TEXT NULL` sin backfill** (`NULL` = sin cuidados y la vitrina **no pinta** la sección; precedente estructural `description`, V1) · `careInstructions` **al final** de `ProductResponse` (para no mover constructores posicionales), `@Size(max = 2000)` en los dos DTOs y **en blanco → `NULL`** con el helper **generalizado a `normalizarTexto`** · «Cuidados» en la PDP **después** de la descripción, con `data-testid="product-care"` y `whitespace-pre-line`, **pintada sólo con contenido**; en el panel, textarea con validación espejo y **borrarlo en edición = borrar el dato** (el payload va sin el campo) · **fotos por referencia (D10/R8, decisión del usuario)**: cambiar de color **no** mueve la galería — el manifiesto es plano y sin color, hay **un único set por producto** y `ProductGallery` sólo recibe la referencia; queda **escrito como requisito** y `photos-per-color` queda como mini-feature futura · **catálogo de tarjetas intacto, sin reindex, sin ADR** y **sin PR de documentación de cierre** · **R8.3 declaradas**: 2 constructores `ProductCreateRequest` en `AdminProductServiceTest` (la aserción del payload en `AdminProductForm.test` **no se tocó**) · **+4 backend → 349 · +9 frontend → 470 con la B** (461 + 9, medida tras el rebase de la rama sobre `feat/final-price-display`) · ⚠️ **la URL de la PDP va codificada** (`/products/0432%2F021`): la referencia lleva `/` dentro y **sin codificar Next devuelve 404** — ya lo hacía `ProductCard` (L94).
> **Decisiones Fase 6 (`specs/tech-debt/`)**: una rama **`fix/tech-debt` + una PR** para las 4 tareas (D9) · header con `flex-wrap`+`min-h-16` y **sin hamburguesa** (D1), desborde medido como `scrollWidth > innerWidth` en Playwright (D2) · fallback **`ILIKE`** con regla única `OpenAiKey.isUsable()`, `searchMode` declarado y nota de `OPENAI_API_KEY` **sólo en modo TEXT** · **`api.ts` con umbral por fichero 99 sobre medida 100** (globales 77/76/74/79 intactos) · **`anyRequest().denyAll()`** (D6) + **`GET /api/v1/health` sin Actuator** (D7) · **6.4(i): `GET /inventory/**` y `GET /pricing/**` son públicos a propósito y quedan documentados en el README** · sin ADR (D8, ADR-0006 → 7.1) · sin PR de documentación de cierre (D11).
> **Decisión del fix**: *el checkout requiere sesión* — sin `permitAll` en `/api/v1/orders/checkout`.
> **Decisión 3.2 (R8b, aprobada)**: el umbral de envío gratuito traduce la **moneda**, no el valor — `50` en todas las divisas. No existe como dato en BD.
> **Decisiones 3.1**: filtrado **en backend** (Q2), no con `filter()` en cliente · la portada es un **menú editorial sin grid ni barra de búsqueda** (D1) y la semántica vive en `/search` · filtros en **columna lateral** + panel «Filtrar» en móvil, con **un solo `CatalogFilters`** para ambas (D2) · `useSearchParams` **dentro de `<Suspense>`** y `router.push` para que «atrás» recorra los filtros (D8) · el catálogo **nunca se pagina** (D10) · sin ADR.
> **Decisiones 3.3**: imágenes **estáticas en `public/products/`** con manifiesto generado por `npm run images` — el backend **no se toca** (D1/D4) · **sin lightbox, carrusel ni zoom**: scroll vertical heredado de la 3.1 (D5) · `sizes` derivado del **ancho real medido** de la caja, redondeado siempre hacia arriba, y **primera fila `eager`** porque con cajas iguales el LCP se resuelve por un empate de pintado que `priority` no arreglaría (D7, está deprecado desde Next 16) · el orden del DOM es galería → compra → descripción **sin reordenar con CSS** (D5) · **sin ADR** y **sin PR de documentación de cierre** (D11).
> **Decisiones 4.1**: alcance = **sólo tests, cobertura y CI** (los 10 módulos sin test + `AuthContext.test.tsx`) · el umbral se **mide y congela**, no se impone: **77 / 76 / 74 / 79** sobre la medida real **78.01 / 76.32 / 74.72 / 79.85** (D4) · los 3 errores de ESLint se arreglan **sin `eslint-disable`**, y **ningún test preexistente cambió su aserción** (R8) · **D5b reabierta en curso**: la lectura de `localStorage` en `queueMicrotask` rompía R8, así que `useLocalStorage` se reescribió con **`useSyncExternalStore`** (`isHydrated` pasa a ser snapshot servidor/cliente; el contrato del hook no cambia) · `Toast` deriva su estado de la animación **en el render** · **excepción documentada a R7**: `fireEvent` sólo en el test de temporizadores de `AddToCartButton`, porque user-event v14 se cuelga con los temporizadores falsos de Vitest · la opción `all` **ya no existe en Vitest 5**; el `include` explícito hace el trabajo · **sin ADR**.
> **Decisiones 4.2**: los E2E van **contra backend real, nunca contra API mockeada** — los 270 unitarios ya mockean, así que el único valor nuevo es la cadena `fetch → rewrite → Spring → JPA → PostgreSQL` (D1) · alcance = **smoke**, 5 pruebas del camino crítico (D2) · `globalSetup` en 4 fases: sondeo de `GET /api/v1/markets` como *readiness* (**no hay Actuator** y añadirlo habría supuesto tocar `backend/`), usuario de prueba **verificado por la API leyendo `verification_code` de BD** (sin SMTP y **sin migración de semilla**), dirección por defecto, y **reset del stock a los valores exactos de `V1`** — la primera redacción decía «40, las cifras de V12» y era **falsa**, y la compra usa **talla M** porque la L no tiene ninguna fila de stock (D5) · `workers: 1` y **build de producción**, no `next dev` (D6) · CI con job `e2e-tests` **en paralelo** y espera de readiness **anterior** a Playwright, con volcado del log (D3) · **los 3 navegadores**: Firefox no arranca en headless en este macOS (aislado con A/B), y **no se baja a 2 para que quede verde en local** — se valida en CI sobre Ubuntu (D10) · `vitest.config.ts` gana `include` explícito para que los unitarios no capturen `e2e/` · **sin ADR**.
> **Decisiones 4.3**: **dos puertas y en sitios distintos (D3)** — axe **dentro de `e2e-tests`** (el `testDir: "./e2e"` sin `testMatch` ya recoge `a11y.spec.ts`, **sin job propio**) sobre **14 rutas y sólo Chromium** (D5), y Lighthouse en **job propio `cwv-audit` en paralelo, sin `needs:`** · **presupuesto medido y congelado (D1)**: LCP ≤ **3 750 ms** · CLS ≤ **0,05** · TBT ≤ **250 ms** · perf ≥ **85** · a11y ≥ **95**, con `numberOfRuns: 3`, **calibrado sobre 2 corridas de CI y validado en las posteriores** (peor de 4: LCP 3 193 / CLS 0,000 / TBT 192 / perf 0,90 / a11y 100) · **`aggregationMethod: "median-run"` hay que ponerlo a mano**: LHCI evalúa por defecto en `optimistic` (la **mejor** corrida), lo que habría dejado sin efecto D4 · **la INP no se congela porque no es medible (D8)**: Lighthouse 12 la trae sin `numericValue` y su perf incluye `max-potential-fid`, obsoleto → **TBT como proxy, dicho explícitamente** · **`CHROME_PATH = chromium.executablePath()`** en `scripts/lighthouse.mjs`, el mismo Chrome for Testing de los E2E, y **el mismo `npm run audit:cwv` en local y en CI** · **D6: corrección acotada** — las 14 rutas en rojo con **sólo 2 reglas**, causa raíz única `text-neutral-400` → **`text-neutral-600` en 46 líneas de 15 ficheros** (`neutral-500` se descarta **con dato**: 4,35 en `#f5f5f5`), **`group-hover:text-neutral-400` preservado** porque la tarjeta editorial se oscurece en hover, y `<h3>` → `<h2>` en `ProductCard` · **0 hallazgos descartados** · **comprobación negativa del gate**: umbrales congelados pasan, LCP forzado a 1000 **falla en las 4 rutas** · ⚠️ **`reuseExistingServer` es trampa local**: un `next start` colgado sirve el build viejo, y **para Lighthouse es peor** — `startServerCommand` no puede bindear el puerto ocupado y LHCI **mide lo que haya escuchando** (medido: LCP 6 998 frente a 3 057 de la corrida limpia), así que `scripts/lighthouse.mjs` **comprueba el puerto y aborta con `exit 1`** · **`chromeFlags: "--no-sandbox"` obligatorio**: Playwright lanza Chromium sin sandbox de serie y en el runner de CI (Ubuntu 24.04 + AppArmor) Chrome se aborta antes de medir — **sólo se vio en CI** · **la medición que manda es la de CI, no la del portátil**: LCP/CLS/a11y coinciden entre local y CI (±114 ms en LCP), pero **TBT baila ×2 entre corridas de CI con código idéntico** (88 con el runner tranquilo, ~150-190 cargado, arrastrando perf a 0,90) — el job corre Postgres + Spring + `next start` + Chrome **en el mismo VM** y el TBT mide CPU **observada**, así que la contención es autoinfligida por D2; `median-run` no protege (`/catalog` dio 187/178/162, las tres altas) → **umbrales recalibrados sobre las 2 primeras corridas y validados en las posteriores** (decisión del usuario) y **la retractación de la primera decisión queda escrita en la spec** · **sin ADR** · **sin PR de documentación de cierre** (D11).
> **Convención de estado (D11)**: este bloque **se redacta dentro de la feature PR**, formulado para ser **verdad después del merge** y **sin números de PR ni SHA** — por eso no existe un PR de documentación de cierre.

> **MEMORY.md** contiene el historial detallado, tareas completadas y decisiones.
> Léelo al iniciar sesión para contexto completo.

---

## 🔴 FLUJO OBLIGATORIO: Spec-Driven Development

**Este proyecto usa SDD. No se escribe código sin spec aprobada.**

### Ciclo de feature

```
1. PLAN      → specs/<feature>/plan.md      (objetivos, decisiones, estimación)
2. SPEC      → specs/<feature>/spec.md      (requisitos, API, modelo de datos)
3. APROBAR   → pedir aprobación al usuario  ⛔ PUNTO DE BLOQUEO
4. TASKS     → specs/<feature>/tasks.md     (checklist de implementación)
5. CODE      → implementar guiado por tasks.md
6. VERIFICAR → /spec-check <feature>        (código vs spec)
7. CLOSE     → /spec-close <feature>        (tests + docs + PR)
```

### Reglas inviolables

| # | Regla |
|:--|:---|
| 1 | **NUNCA** escribir código sin `spec.md` aprobado por el usuario |
| 2 | **SIEMPRE** pedir aprobación explícita antes de implementar |
| 3 | **SIEMPRE** actualizar `spec.md` si el alcance cambia durante la implementación |
| 4 | **SIEMPRE** marcar `tasks.md` al completar cada tarea |
| 5 | **NUNCA** mergear sin pasar `/spec-check` y tests en verde |
| 6 | **SIEMPRE** crear ADR si la feature cambia arquitectura o stack |

### Documentos SDD del proyecto

| Documento | Propósito | Modificable |
|:---|:---|:---:|
| `docs/constitution.md` | Principios que limitan toda spec | Solo con ADR |
| `specs/<feature>/spec.md` | Requisitos funcionales y técnicos | Sí, con aprobación |
| `specs/<feature>/plan.md` | Decisiones de diseño | Sí, con aprobación |
| `specs/<feature>/tasks.md` | Checklist de trabajo | Sí, siempre |
| `docs/adr/NNNN-*.md` | Decisiones arquitectónicas | Nunca se editan |

---

## 🧠 REGLAS QUE NUNCA DEBO OLVIDAR

### Git
1. **NUNCA** hacer commit o push sin preguntar antes al usuario
2. **NUNCA** hacer commit o push directo a `main` — siempre rama + PR
3. **SIEMPRE** una rama por feature: `feat/`, `fix/`, `docs/`

### Backend
4. **SIEMPRE** `BigDecimal` con `HALF_UP` para dinero — jamás `double`/`float`
5. **SIEMPRE** `@Transactional` en métodos que escriben
6. **NUNCA** exponer entidades JPA — solo `record` DTOs

### Frontend
7. **SIEMPRE** `text-neutral-900` en inputs — el texto placeholder es demasiado claro
8. **SIEMPRE** manejar respuestas API vacías (204 / body vacío) sin llamar a `res.json()`
9. **SIEMPRE** traducir errores técnicos a mensajes amigables con `getFriendlyErrorMessage()`
10. **SIEMPRE** validar fechas de nacimiento (no futuras, no anteriores a 1900)

### Proceso
11. **SIEMPRE** leer `AGENTS.md` antes de cada respuesta y verificar contra estas reglas
12. **SIEMPRE** seguir el ciclo SDD de arriba antes de escribir código
13. **SIEMPRE** redactar el bloque «ESTADO ACTUAL» dentro de la feature PR, formulado para ser **verdad después del merge** y **sin números de PR ni SHA** (viven en git y en GitHub). Consecuencia: **no existe PR de documentación de cierre**

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Estructura del Monorepo](#2-estructura-del-monorepo)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Reglas Críticas de Negocio](#4-reglas-críticas-de-negocio)
5. [Convenciones de Backend](#5-convenciones-de-backend)
6. [Convenciones de Frontend](#6-convenciones-de-frontend)
7. [Testing](#7-testing)
8. [Flujo de Git y Ramas](#8-flujo-de-git-y-ramas)
9. [Documentación Obligatoria](#9-documentación-obligatoria)
10. [Comandos de Desarrollo](#10-comandos-de-desarrollo)

---

## 1. Visión General

**Nexus Commerce Core** es un backend transaccional de alto rendimiento para retail global, con un frontend editorial en Next.js. El sistema gestiona catálogo de productos multimercado, precios con desglose fiscal, inventario omnicanal con control de concurrencia, y un motor de checkout transaccional con idempotencia.

### Dominio de Negocio
- **Catálogo**: Productos con variantes físicas (SKU) organizados por familia textil
- **Precios**: Tarificación multidivisa por mercado (ES, US, UK...) con desglose impositivo
- **Inventario**: Visión omnicanal de existencias con múltiples almacenes y control de reservas atómicas
- **Pedidos**: Checkout transaccional con snapshots financieros inmutables
- **Búsqueda**: Híbrida semántica (embeddings vectoriales) + exacta por referencia
- **Usuarios**: Registro, verificación por email, JWT, perfil con medidas y direcciones

---

## 2. Estructura del Monorepo

```
nexus-commerce-core/
├── backend/                    # Spring Boot 3.4 + Java 21
│   ├── src/main/java/com/nexus/commerce/
│   │   ├── config/             # Configuración (OpenApi, etc.)
│   │   ├── controller/         # REST API — capa de entrada
│   │   ├── dto/                # Records inmutables (request/response)
│   │   ├── entity/             # Entidades JPA (nunca exponer directamente)
│   │   ├── exception/          # Manejador global de errores
│   │   ├── repository/         # Spring Data JPA
│   │   ├── security/           # JWT, filtros, Spring Security
│   │   └── service/            # Lógica de dominio transaccional
│   ├── src/main/resources/
│   │   └── db/migration/       # Flyway migrations (V1, V2, V3...)
│   └── src/test/java/          # Tests unitarios e integración
├── frontend/                   # Next.js + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/                # App Router (páginas)
│   │   ├── components/         # Componentes UI reutilizables
│   │   ├── context/            # Estado global (Cart, Auth, Drawer)
│   │   ├── hooks/              # Hooks reutilizables
│   │   ├── lib/                # API client, utilidades
│   │   ├── types/              # Tipos TypeScript compartidos
│   │   └── __tests__/          # Tests de componentes
│   └── vitest.config.ts
├── docs/
│   ├── constitution.md          # Principios y workflow del proyecto
│   └── adr/                     # Architecture Decision Records
├── specs/                       # Specs SDD por feature
│   └── <feature>/
│       ├── plan.md
│       ├── spec.md
│       └── tasks.md
├── .agents/skills/             # Agent skills instaladas
├── .opencode/commands/         # Comandos personalizados
├── .github/workflows/          # CI/CD con GitHub Actions
├── docker-compose.yml          # PostgreSQL 16 + pgvector
├── AGENTS.md                   # Este archivo
├── MEMORY.md                   # Estado persistente del proyecto
├── CHANGELOG.md                # Keep a Changelog (es-ES)
└── README.md                   # Documentación principal
```

---

## 3. Stack Tecnológico

### Backend
| Tecnología | Versión | Uso |
|:---|:---|:---|
| Java | 21 LTS | Lenguaje principal |
| Spring Boot | 3.4.3 | Framework base |
| Spring Data JPA | — | Persistencia ORM |
| Spring Security | — | Autenticación y autorización |
| JWT (jjwt) | 0.12.6 | Tokens de sesión |
| PostgreSQL | 16 | Base de datos relacional |
| pgvector | — | Búsqueda vectorial semántica |
| Flyway | — | Migraciones de esquema |
| Spring AI | 1.0.0-M6 | Enriquecimiento LLM (gpt-4o-mini) |
| Spring Mail | — | Verificación de email y recuperación |
| Lombok | — | Reducción de boilerplate |
| JaCoCo | 0.8.12 | Cobertura de código |
| springdoc-openapi | 2.8.5 | Documentación OpenAPI 3 |

### Frontend
| Tecnología | Uso |
|:---|:---|
| Next.js (App Router) | Framework React con SSR/SSG |
| TypeScript | Tipado estricto |
| Tailwind CSS | Estilos utility-first |
| Vitest | Test runner |
| React Testing Library | Tests de componentes |

### Servicios
| Servicio | Uso |
|:---|:---|
| Mailtrap | Email transaccional en desarrollo |
| OrbStack | Docker para PostgreSQL local |

---

## 4. Reglas Críticas de Negocio

Estas reglas son **inviolables**. Cualquier implementación debe respetarlas:

### 4.1. Aritmética Financiera
- **PROHIBIDO** usar `double` o `float` para cálculos monetarios.
- **SIEMPRE** usar `BigDecimal` con `RoundingMode.HALF_UP` y escala de 2.
- Todo precio, impuesto, subtotal y total debe ser `BigDecimal`.

### 4.2. Concurrencia de Inventario
- El bloqueo pesimista (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) es obligatorio en operaciones de reserva.
- Nunca permitir *over-selling*: el ATS (*Available to Sell*) debe validarse atómicamente.
- La reserva de stock y la creación de la orden deben ser una única transacción.

### 4.3. Idempotencia de Checkout
- Toda petición de checkout **DEBE** incluir la cabecera `Idempotency-Key` (UUID).
- Si la clave ya existe, devolver la orden existente sin duplicar reservas ni cargos.
- La restricción de unicidad en BD es la última línea de defensa.

### 4.4. Inmutabilidad de DTOs
- Las entidades JPA **NUNCA** se exponen al exterior.
- Toda comunicación HTTP se realiza mediante Java `record` inmutables.
- Los records de DTO usan validación con anotaciones de `jakarta.validation`.

### 4.5. Manejo de Errores
- Excepciones de dominio se traducen centralizadamente en `GlobalExceptionHandler`.
- Errores estructurados con `timestamp`, `status`, `error`, `message`.
- Códigos HTTP semánticos: `400` (validación), `404` (no encontrado), `409` (conflicto de stock).

### 4.6. Autenticación
- Contraseñas hasheadas con BCrypt (coste 12). Nunca en texto plano.
- JWT access token 24h, refresh token 7d.
- Email debe verificarse antes de permitir login.
- Códigos de verificación: 6 dígitos numéricos, expiración 15 minutos.

---

## 5. Convenciones de Backend

### 5.1. Arquitectura en Capas
```
Controller → Service → Repository → DB
     ↓           ↓
   DTOs      Spring AI (enriquecimiento)
```

- **Controllers**: Solo reciben peticiones, validan con `@Valid`, y delegan en servicios. No contienen lógica de negocio.
- **Services**: Contienen la lógica de dominio. Anotados con `@Transactional` cuando es necesario.
- **Repositories**: Spring Data JPA. Usar `@EntityGraph` o `JOIN FETCH` para evitar N+1.
- **DTOs**: Records inmutables en el paquete `dto`. Nunca devolver entidades directamente.

### 5.2. Nombramiento
| Elemento | Convención | Ejemplo |
|:---|:---|:---|
| Clases | PascalCase | `OrderService`, `ProductController` |
| Métodos | camelCase | `processCheckout()`, `findById()` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| DTOs | Sufijo `Request`/`Response` | `CheckoutRequest`, `OrderResponse` |
| Tests | Sufijo `Test` | `OrderServiceTest` |
| Migraciones | `V{n}__descripcion.sql` | `V3__orders_schema.sql` |

### 5.3. Anotaciones Obligatorias
```java
// Service
@Slf4j
@Service
@RequiredArgsConstructor  // Inyección por constructor (Lombok)

// Controller
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Tag(name = "Orders & Checkout", description = "...")

// Entidad
@Entity
@Table(name = "orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
```

### 5.4. Manejo de Transacciones
- `@Transactional` en métodos de servicio que escriben.
- `@Transactional(readOnly = true)` en consultas.
- El rollback automático ante excepciones es el comportamiento por defecto.

### 5.5. Manejo de Errores
- Crear excepciones de dominio específicas (ej: `InsufficientStockException`).
- El `GlobalExceptionHandler` las traduce a respuestas HTTP estructuradas.
- No capturar excepciones genéricas en los servicios.

### 5.6. Configuración
- Las variables sensibles van en `.env` (nunca versionado).
- `application.properties` importa el `.env` con `spring.config.import=optional:file:.env[.properties]`.
- Usar `${VARIABLE:valor-por-defecto}` para fallbacks en desarrollo.

---

## 6. Convenciones de Frontend

### 6.1. Estructura de Páginas (App Router)
- Las páginas viven en `src/app/` con su archivo `page.tsx`.
- Usar `"use client"` solo cuando hay interactividad (hooks, eventos).
- Los parámetros dinámicos se leen con `useParams()` (síncrono).

### 6.2. API Client
- Toda la comunicación con el backend pasa por `src/lib/api.ts`.
- **CRÍTICO**: `handleResponse()` debe tolerar respuestas vacías (204 o body vacío) sin llamar a `res.json()`.
- La `Idempotency-Key` se genera en cliente con `crypto.randomUUID()`.

### 6.3. Tipos
- Los tipos de dominio viven en `src/types/commerce.ts` y `src/types/auth.ts`.
- Deben reflejar exactamente los DTOs del backend.
- Usar `interface` para objetos, `type` para uniones.

### 6.4. Estilo Editorial Zara
- **Tipografía**: `font-light` (300) para textos largos, `font-medium` (500) para títulos.
- **Transformación**: `uppercase` en títulos, botones y etiquetas.
- **Espaciado**: `tracking-widest` (0.1em) para títulos, `tracking-wide` (0.025em) para botones.
- **Paleta**: `neutral-*` como base (50-900), acentos en `neutral-900`.
- **Bordes**: `border-neutral-200` para separadores sutiles, `border-neutral-900` para elementos activos.
- **Transiciones**: `transition-all duration-300` para hover states.
- **Botones**: Fondo `neutral-900` con texto `white`, hover a `black`.
- **Notificaciones**: Toast con fondo `neutral-900`, texto `white`, `text-xs uppercase tracking-widest`.
- **Iconos**: Estilo lineal, `stroke-width` 1.5, tamaño `w-5 h-5` o `w-4 h-4`.
- **Espaciado vertical**: `py-12` para secciones, `py-6` para subsecciones, `gap-6` para grids.

### 6.5. Formularios
- **SIEMPRE** añadir `text-neutral-900` a los inputs — sin esto el texto escrito es casi invisible.
- Validar en cliente antes de llamar al backend (fechas, emails, contraseñas).
- Traducir siempre errores técnicos con `getFriendlyErrorMessage()`.

### 6.6. Componentes
- Componentes reutilizables en `src/components/`.
- Props tipadas con `interface`.
- Prefijo `Header`, `ProductCard`, `SemanticSearchBar`.

### 6.7. Imágenes de Producto
- **Estáticas en `public/products/`**, nunca en la BD: `0432/021` → `0432-021-1.webp` … `-3.webp` (la `/` se sustituye por `-`). El backend no tiene ningún cambio para ellas.
- Se resuelven con `getProductImages()` (`src/lib/product-images.ts`), que importa **estáticamente** el manifiesto `src/data/product-images.json`. **Sin `fetch` en tiempo de ejecución.**
- Pintar siempre con **`ProductImage`**: mantiene el `aspect-[3/4]` (espacio reservado → sin CLS) y cae a `ProductThumb` si no hay manifiesto o la imagen falla — **cero 404**.
- **`sizes` es obligatorio** en cada `<Image>`; sin él el navegador asume `100vw` y descarga de más. Las constantes (`CATALOG_CARD_SIZES`, `SEARCH_CARD_SIZES`, `GALLERY_SIZES`) están en `ProductCard` y `ProductGallery` y se derivan del ancho real medido.
- LCP: la **primera fila** lleva `loading="eager"` + `fetchPriority="high"`. **Nunca `priority`** (deprecado desde Next 16) — y con cajas del mismo tamaño no basta con eager en la primera: el LCP se resuelve por un empate de pintado.
- Tras añadir o quitar ficheros: `cd frontend && npm run images` — rellena lo que **falta** y **nunca pisa** lo existente («ausencia = generar, presencia = sagrado»), con la cadena **Gemini → FLUX gratis → póster**: con `GEMINI_API_KEY` en el `.env` raíz intenta Gemini (`aspect_ratio "3:4"`, `image_size "2K"`); si falla (o sólo hay credenciales de Cloudflare: `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`, Workers AI con **FLUX.1 [schnell]**), usa **FLUX gratis** (1024×1024 nativo, recortado a 3:4 — gratis ~173 imágenes/día, sin tarjeta); sin ninguna → el póster SVG de siempre, con aviso (mismo patrón que `searchMode`). Todo sale normalizado a 1200×1600 webp q85 (spec `product-photos`). Un `401/403/429` **desactiva al proveedor para el resto de la corrida** con un único aviso (Gemini de pago es la única vía Google: en free tier devuelve `0 requests/day`); cualquier otro fallo → siguiente proveedor → póster de respaldo, y la corrida **nunca aborta**. Flags: `npm run images -- --force` regenera todos los pósters **pisando** (destructivo) y `-- --no-photos` fuerza modo 100 % offline. La key de Gemini se obtiene en [AI Studio](https://aistudio.google.com/apikey) (con billing para modelos de imagen) y las de Cloudflare en cloudflare.com → Account ID + API Token «Workers AI»; **sólo se gastan en local y sólo en lo que falta**; ningún workflow de CI ejecuta el script.

---

## 7. Testing

### 7.1. Backend
- **Framework**: JUnit 5 + Mockito + AssertJ + MockMvc.
- **Cobertura objetivo**: >90% (verificado con JaCoCo).
- **Patrón**: GIVEN-WHEN-THEN con `@DisplayName` descriptivo en español.
- **Uso de mocks**: `@ExtendWith(MockitoExtension.class)` + `@Mock` + `@InjectMocks`.
- **Verificación**: `assertThat()` de AssertJ, `verify()` de Mockito.

### 7.2. Frontend
- **Framework**: Vitest + React Testing Library + jsdom.
- **Configuración**: `vitest.config.ts` en la raíz de `frontend/`.
- **Setup**: `src/test/setup.ts` para imports globales.
- **Patrón**: Renderizar componente, interactuar, verificar resultado.
- **Cobertura**: `npm run test:coverage` es el comando que **protege** — aplica
  los umbrales de `coverage.thresholds` y sale con `≠0` si un test falla o si
  la cobertura baja del piso (`npx vitest run` **no** los evalúa). El piso está
  **medido y congelado**, no impuesto: subirlo es una decisión explícita; no
  bajarlo. El informe va a `frontend/coverage/` y CI lo sube como artefacto
  `coverage-report` con `if: always()`.

### 7.3. E2E (Playwright)
- **Comandos**: `npm run test:e2e` (Chromium + Firefox + WebKit) y
  `npm run test:e2e:quick` (sólo Chromium). Config en
  `frontend/playwright.config.ts`, pruebas en `frontend/e2e/`.
- **Requieren el stack entero levantado**: PostgreSQL + backend en `:8080` +
  frontend. `e2e/global-setup.ts` espera al backend por `GET /api/v1/markets`
  (que además **no responde hasta que Flyway ha migrado**, así que sirve de
  *readiness*) y deja el entorno **idempotente**: usuario verificado,
  dirección por defecto y stock restaurado.
- **`testDir`/`include` explícitos en los dos runners**: `vitest.config.ts`
  declara `include: ["src/__tests__/**"]` para que el patrón por defecto
  `**/*.spec.ts` **no** capture `e2e/` — sin eso, la suite de unitarios
  empezaría a lanzar navegadores.
- **Estilo**: localizadores por **rol y label**, esperas condicionales, y
  **`waitForTimeout` con espera fija prohibido**. Ninguna prueba depende de la
  ejecución de otra.
- **Estado compartido**: `workers: 1` — un solo usuario y una sola BD; compras
  en paralelo competirían por el stock y por el token de sesión.
- **Firefox en local**: la build de Playwright no arranca en headless en este
  macOS, así que en local se valida en **Chromium y WebKit** y Firefox se
  comprueba en CI (decisión **D10** de la 4.2). No se degrada a 2 navegadores.
- **CI**: job `e2e-tests`, en paralelo, con informe `playwright-report/`
  subido **siempre** (`if: always()`).

### 7.4. Auditoría de Accesibilidad y Core Web Vitals
- **Comandos**: `npm run audit:a11y` (axe, 14 rutas, sólo Chromium),
  `npm run audit:cwv` (`next build` + Lighthouse, 4 rutas × 3 corridas) y
  `npm run audit` (los dos). Config en `frontend/lighthouserc.json`, espec en
  `specs/cwv-accessibility-audit/`.
- **También necesitan el stack entero**: sin backend, axe audita la página de
  error y Lighthouse mide un fallo de red. **Datos de laboratorio, no de
  usuario real** (D9): sirven para comparar y para frenar regresiones, no para
  saber lo que tarda la web en el móvil de nadie.
- **axe bloquea en `critical` + `serious`; `moderate`/`minor` se informan** en
  el log y **no se silencian** (D7). Sin suppressions: `axe.exclude()` y
  `disableRules` están prohibidos.
- **Los umbrales se miden y se congelan, no se eligen a ojo** (D1):
  `lighthouserc.json` declara LCP ≤ 3 750 ms · CLS ≤ 0,05 · TBT ≤ 250 ms ·
  perf ≥ 85 · a11y ≥ 95. Para moverlos hay que **re-medir** y escribir el
  número nuevo en la spec (regla 3).
- **La medición que manda es la de CI, no la de tu portátil**: LCP, CLS y a11y
  coinciden entre local y CI, pero **el TBT baila ×2** entre corridas de CI
  con código idéntico (88 con el runner tranquilo, ~150-190 cargado). Motivo
  estructural: el job `cwv-audit` corre PostgreSQL + Spring Boot + `next
  start` + Chrome **en el mismo VM**, y el TBT mide bloqueo de CPU
  **observado** — la contención es autoinfligida por D2 (backend real).
  `median-run` no protege (en la corrida mala `/catalog` dio 187 / 178 / 162,
  las tres altas). **Consecuencia**: los umbrales de TBT y perf se calibran
  sobre **varias** corridas de CI, y una sola corrida verde **no sirve para
  congelar nada**.
- **`aggregationMethod: "median-run"` es obligatorio**: LHCI evalúa por
  defecto en `optimistic` (**la mejor** de las 3 corridas), lo que convertiría
  la mediana en decorativa.
- **La INP no está cubierta y hay que decirlo**: Lighthouse 12 no produce un
  valor de INP de laboratorio (`interaction-to-next-paint-insight` llega sin
  `numericValue`), así que se gatea **`total-blocking-time` como proxy, en
  voz alta**. Medirla de verdad exige datos de campo, y no hay despliegue.
- **CHROME_PATH lo resuelve `scripts/lighthouse.mjs`** con
  `chromium.executablePath()` — el Chrome for Testing de Playwright, sin
  instalar otro navegador ni fijar rutas de máquina.
- **`chromeFlags: "--no-sandbox"` es obligatorio**: Playwright lanza Chromium
  **sin sandbox de serie** (`chromiumSandbox: false`), y en el runner de CI
  (Ubuntu 24.04 + AppArmor restringiendo los *user namespaces*) Chrome **se
  aborta** con `No usable sandbox!`. Sin el flag el gate **se cae antes de
  medir** — sólo se vio en CI, porque macOS arranca con sandbox.
- **CI**: axe corre dentro de `e2e-tests` (mismo `testDir`, sin job propio);
  Lighthouse va en el job **`cwv-audit`**, en paralelo, con el backend
  levantado y el informe subido **siempre** (`if: always()`).
- ⚠️ **`reuseExistingServer: !process.env.CI` es trampa local**: un
  `next start` colgado sirve el **build viejo**. Lo peor no es eso sino lo que
  le pasa a Lighthouse: `startServerCommand` **no puede bindear** un puerto
  ocupado y, en vez de fallar, LHCI **mide lo que haya escuchando** — un build
  que nadie eligió, que pudo salir **verde** sobre código que ya no es el
  tuyo. `scripts/lighthouse.mjs` **comprueba el puerto y aborta** si está
  ocupado, así que ya no depende de acordarse. **Ojo con el comando**:
  `pkill -f "next start"` **no mata nada**, el proceso se llama
  **`next-server`**. En CI no puede pasar.

### 7.5. Reglas de Testing
- Todo bug corregido **DEBE** tener un test que lo reproduzca.
- Toda funcionalidad nueva **DEBE** tener tests antes de cerrar la rama.
- Los tests deben ser deterministas y no depender de servicios externos.

---

## 8. Flujo de Git y Ramas

### 8.1. Reglas de Oro
- **NUNCA** hacer commit o push directamente a `main`.
- Toda funcionalidad o fix se desarrolla en una **rama feature/fix**.
- Las ramas se nombran con prefijo descriptivo: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`.
- Antes de cerrar una rama: documentar en `/docs` y crear tests necesarios.

### 8.2. Flujo de Trabajo: GitHub Flow con Pull Requests

```
1. git checkout main && git pull
2. git checkout -b feat/nueva-funcionalidad
3. Desarrollar + commits en la rama
4. git push -u origin feat/nueva-funcionalidad
5. Crear Pull Request en GitHub
6. Code review (auto-review si es necesario)
7. Merge a main desde GitHub (botón "Merge pull request")
8. Borrar rama local y remota
```

### 8.3. Reglas para Commits y Pushs
- **SIEMPRE preguntar al usuario antes de hacer commit o push.**
- Los commits siguen el formato convencional: `tipo(alcance): descripción en español`.
- No hacer push directamente a `main`.
- No hacer force push a ramas compartidas.

### 8.4. Nombramiento de Ramas
```
feat/order-payment-integration
fix/stock-race-condition
docs/api-endpoint-documentation
refactor/pricing-service-extraction
test/order-checkout-e2e
```

### 8.5. Convención de Commits
Formato: `tipo(alcance): descripción en español`

```
feat(orders): implement persistent receipt page with fiscal breakdown
fix(inventory): prevent race condition in stock reservation
docs(adr): add ADR-0005 for frontend testing strategy
test(frontend): add OrderDetailPage component tests
refactor(pricing): extract tax calculation to dedicated service
```

Tipos válidos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

### 8.6. Cierre de Rama
Antes de considerar una rama lista para merge:
1. Tests pasando (`./mvnw test` en backend, `npx vitest` en frontend).
2. Cobertura mantenida o incrementada.
3. Documentación actualizada (CHANGELOG.md, ADRs si aplica).
4. `/spec-check <feature>` en verde.
5. Código revisado y limpio (sin TODOs, sin código muerto).

---

## 9. Documentación Obligatoria

### 9.1. Archivos de Documentación
| Archivo | Propósito |
|:---|:---|
| `README.md` | Visión general, setup, API pública |
| `CHANGELOG.md` | Registro de cambios (Keep a Changelog es-ES) |
| `docs/constitution.md` | Principios y workflow del proyecto |
| `docs/adr/*.md` | Decisiones arquitectónicas |
| `specs/*/` | Specs SDD por feature |
| `MEMORY.md` | Estado actual del proyecto |
| `AGENTS.md` | Este archivo — convenciones para agentes IA |

### 9.2. Specs SDD
- Toda feature **DEBE** tener `specs/<feature>/` con `plan.md`, `spec.md` y `tasks.md`.
- La spec se escribe **antes** del código y se actualiza si el alcance cambia.
- Ningún código sin spec aprobada.

### 9.3. ADRs (Architecture Decision Records)
- Toda decisión arquitectónica significativa **DEBE** documentarse como ADR.
- Formato: Contexto → Decisión → Alternativas → Consecuencias.
- Se numeran secuencialmente: `0001-`, `0002-`, etc.
- Se registran en `docs/adr/README.md`.

### 9.4. OpenAPI
- La documentación de la API se genera automáticamente con springdoc-openapi.
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Especificación: `http://localhost:8080/v3/api-docs`
- Los controllers deben tener anotaciones `@Tag` y `@Operation`.

---

## 10. Comandos de Desarrollo

### Comandos Personalizados
| Comando | Uso |
|:---|:---|
| `/new-feature <nombre>` | Crear rama + estructura de spec |
| `/spec-check <feature>` | Verificar código vs spec |
| `/spec-close <feature>` | Cerrar feature: tests + docs + PR |

### Backend
```bash
# Tests
cd backend && ./mvnw clean test

# Cobertura (genera reporte en target/site/jacoco/index.html)
cd backend && ./mvnw jacoco:report

# Ejecutar aplicación
cd backend && ./mvnw spring-boot:run

# Verificar estilo/compilación
cd backend && ./mvnw compile
```

### Frontend
```bash
# Tests
cd frontend && npx vitest

# Tests en modo watch
cd frontend && npx vitest --watch

# Tests + informe de cobertura + comprobación de umbrales
cd frontend && npm run test:coverage

# Tests end-to-end (3 navegadores; requieren el stack entero levantado)
cd frontend && npm run test:e2e

# Auditoría de accesibilidad (axe, 14 rutas, sólo Chromium)
cd frontend && npm run audit:a11y

# Auditoría de Core Web Vitals (build + Lighthouse, 4 rutas × 3 corridas)
cd frontend && npm run audit:cwv

# Las dos auditorías, en ese orden
cd frontend && npm run audit

# Desarrollo
cd frontend && npm run dev

# Build de producción
cd frontend && npm run build
```

### Infraestructura
```bash
# Levantar PostgreSQL + pgvector
docker compose up -d

# Detener servicios
docker compose down
```

### Git
```bash
# Crear PR
gh pr create --base <destino> --head <rama> --title "tipo(scope): descripción"

# Ver PRs
gh pr list

# Ver checks de un PR
gh pr checks <número>
```

---

## Resumen de Verificación Antes de Cerrar una Rama

- [ ] Spec aprobada por el usuario antes de implementar
- [ ] Tests pasando (backend y frontend)
- [ ] Cobertura >= 90% (backend)
- [ ] `/spec-check <feature>` en verde
- [ ] Sin errores de compilación ni warnings críticos
- [ ] CHANGELOG.md actualizado
- [ ] ADR creado si hay decisión arquitectónica
- [ ] `tasks.md` con todas las tareas marcadas
- [ ] Código sin TODOs ni comentarios de depuración
- [ ] Commits con formato convencional

---

*Última actualización: 2026-10-05*
