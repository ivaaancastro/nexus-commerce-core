# Fase 10 — Landing, despliegue y documentación — spec

> **Estado**: **aprobada con 3 ajustes** (2026-11-11, decisión del usuario). Decisiones D1–D14 en `plan.md`.
> **Alcance de esta spec**: **PR A** (código y configuración). El **PR B** (README, capturas, GIF) se especifica
> al final (§8) y se ejecuta **después** de desplegar.

## 0. Ajustes de la aprobación (2026-11-11)

| # | Ajuste | Motivo (medido en el código) |
|:--|:---|:---|
| **A1** | Datos demo como **`R__demo_data.sql` repetible**, no `V1000__…` | Con una `V1000` aplicada, la próxima `V24` de `db/migration/` sería «ignorada» por Flyway y la validación **abortaría el arranque**. Las repetibles corren siempre tras las versionadas y se reaplican solo si cambia su checksum |
| **A2** | R5 bloquea `POST /auth/forgot-password` y `POST /auth/reset-password` | No existe un cambio de contraseña autenticado: `PUT /users/me` no admite email ni contraseña. Sin SMTP el código va al log, así que esas rutas no tienen uso legítimo en la demo y bloquearlas evita que nadie deje sin acceso a la cuenta demo |
| **A3** | `demoMode` **solo** en `GET /api/v1/payments/config` (público, sin secretos) | R6 y §3 se contradecían; una única fuente. **Corregido al implementar**: la primera redacción decía `/health`, pero desde la Fase 8 `/health` es `hasRole("ADMIN")` y un visitante anónimo no lo puede leer. El estado de despertar (R12) no puede esperar a la API, así que se activa con `NEXT_PUBLIC_DEMO=1` (build de Vercel) |

## 1. Requisitos funcionales

| # | Requisito |
|:--|:---|
| **R1** | `next.config.ts` reescribe `/api/v1/:path*` a `${BACKEND_URL}/api/v1/:path*`; sin la variable, `http://localhost:8080`. Dev, CI y E2E **no cambian** |
| **R2** | Perfil `prod` (`application-prod.properties`): `spring.jpa.show-sql=false`, `format_sql=false`, datasource por `DATABASE_URL/USER/PASSWORD`, `JWT_SECRET` **obligatorio** (sin valor por defecto), logs `INFO`, `server.port=${PORT:8080}` |
| **R3** | Con el perfil `prod`, si `jwt.secret` es el valor por defecto del repo o tiene < 32 bytes, **el arranque falla** con mensaje explícito. Sin perfil `prod` el comportamiento actual no cambia |
| **R4** | `backend/Dockerfile` multi-etapa (JDK 21 para compilar, JRE 21 para ejecutar), usuario no root, `JAVA_OPTS` con `-Xmx` acotado para 512 MB, `HEALTHCHECK` contra **`GET /api/v1/markets`** (público y no responde hasta que Flyway migra — el mismo *readiness* de los E2E; `/health` es solo ADMIN desde la Fase 8). `.dockerignore` excluye `target/`, `.env` y tests |
| **R5** | **Modo demo** `app.demo.enabled` (por defecto `false`; solo `true` por variable en el despliegue). Con él activo, un filtro responde **`403` + `code: DEMO_MODE`** y mensaje en español a: `DELETE` de productos/SKUs/cupones, `PUT /admin/users/**`, y `POST /auth/forgot-password` + `POST /auth/reset-password` (A2). El resto de `/admin/**` funciona. Con él desactivado el filtro **no existe** (cero efecto en dev/CI) |
| **R6** | `GET /api/v1/payments/config` expone `demoMode: boolean` (A3: **solo** ahí, una única fuente) para que el frontend pinte el banner. **Cambio aditivo**: los campos actuales no varían |
| **R7** | Datos de demo en **`db/demo/R__demo_data.sql`** (Flyway, **migración repetible**, A1), cargados **solo** si `spring.flyway.locations` los incluye (perfil `demo`): usuario `demo@nexus.dev` verificado, una dirección por defecto y ≥ 6 pedidos de ejemplo en estados distintos (`CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`, uno con reembolso) repartidos en los últimos 30 días. Reejecutable (`ON CONFLICT DO NOTHING`). **`db/migration/` no se modifica** |
| **R8** | `scripts/reset-demo.sh` restaura la demo **a su estado de fábrica**: vacía el esquema y, al reiniciar el backend, Flyway lo reconstruye desde las migraciones + `R__demo_data.sql`. Usa las mismas variables que el backend (`DATABASE_URL` JDBC + usuario/contraseña) y pide **escribir el host** para confirmar. *Cambio de alcance al implementar (regla 3)*: la primera redacción restauraba solo stock/precios/pedidos «sin tocar el catálogo», pero los visitantes del panel también crean y editan productos y cupones; un reset parcial dejaría restos, y reconstruir desde las migraciones es exacto y más simple |
| **R9** | Ruta **`/proyecto`**: hero (título, una frase, CTA «Probar la demo» → `/` y «Ver el código» → GitHub), bloque **«Qué lo hace difícil»** (concurrencia de stock, idempotencia del checkout, pago con webhook firmado, outbox de emails), **tour** de 6 capturas con pie explicativo, bloque **«Pruébalo»** con credenciales demo, tarjeta de pruebas `4242 4242 4242 4242` y aviso del despertar, y enlaces a Swagger, README y ADRs |
| **R10** | Las capturas de la landing son **ficheros estáticos** en `public/landing/` (webp, 1600 px de ancho), pintadas con `next/image` con `sizes` y dimensiones declaradas (**CLS 0**, regla §6.7); si una falta, cae a un recuadro neutro, **cero 404** |
| **R11** | Script `npm run shots` (Playwright) genera las capturas contra una URL configurable (`SHOTS_BASE_URL`, por defecto local): catálogo, ficha, carrito/checkout, pantalla de pago, panel admin, dashboard. Reproducible y **nunca pisa** capturas existentes sin `--force` (mismo patrón que `npm run images`) |
| **R12** | **Estado de despertar**: si la primera petición a la API tarda > 4 s, el frontend muestra «Despertando la demo, tarda hasta un minuto la primera vez…» y lo retira al responder. Solo se activa con `NEXT_PUBLIC_DEMO=1` (A3); sin ello, nada cambia |
| **R13** | Apple Pay: el fichero de verificación de dominio **lo descarga el usuario** de Stripe tras registrar el dominio de Vercel, y va a `frontend/public/.well-known/apple-developer-merchantid-domain-association` (público por diseño, sin secretos). El PR A no versiona un fichero inventado: deja la guía paso a paso en `docs/deployment.md` |
| **R14** | Metadatos de la landing: `title`, `description`, **Open Graph** y `og:image` (para la tarjeta de LinkedIn). Ninguna analítica |
| **R15** | **Variables documentadas** en `docs/deployment.md` (tabla única: nombre, dónde se pone, obligatoria, ejemplo no secreto). **Ninguna clave real** se versiona |

## 2. Requisitos no funcionales

| # | Requisito |
|:--|:---|
| **RNF1** | Backend sin cambios de comportamiento con perfil por defecto: los **527 tests** siguen en verde; añadidos para R3, R5 y R6 |
| **RNF2** | Frontend: **590 tests** intactos + tests de la landing, del estado de despertar y del banner; `tsc` 0 · ESLint 0/0 · build 0 · cobertura sin bajar el piso |
| **RNF3** | `/proyecto` entra en el gate **axe** (17 → 18 rutas) y en **Lighthouse** con los presupuestos congelados (no se relajan) |
| **RNF4** | Accesibilidad: capturas con `alt` descriptivo, jerarquía `h1 > h2`, contraste `neutral-600+`, foco visible |
| **RNF5** | Seguridad: ningún secreto en el repo; `jwt.secret` por defecto no arranca en `prod` (R3); modo demo desactivado por defecto |
| **RNF6** | El E2E existente (31 en rápido) **no se toca**; se añade **un** humo para `/proyecto` |

## 3. API (cambios aditivos)

| Endpoint | Cambio |
|:---|:---|
| `GET /api/v1/payments/config` | + `demoMode` (boolean) — `paymentMode` no varía |
| Cualquier acción bloqueada por R5 | `403 {"status":403,"code":"DEMO_MODE","message":"Esta acción está desactivada en la demo pública."}` |

Sin migraciones en `db/migration/`. Datos de demo solo en `db/demo/R__demo_data.sql` (R7, A1).

## 4. Ficheros previstos

**Backend**: `config/DemoProperties`, `security/DemoModeFilter`, `config/JwtSecretGuard`, `application-prod.properties`,
`application-demo.properties`, `db/demo/R__demo_data.sql`, `Dockerfile`, `.dockerignore`; tests
`DemoModeFilterTest`, `JwtSecretGuardTest`, `PaymentConfigController` (ampliado, R8.3).
**Frontend**: `next.config.ts` (R1), `app/proyecto/page.tsx` + componentes de landing, `lib/api.ts` (estado de
despertar), `components/DemoBanner.tsx`, `scripts/capture-screenshots.mjs`, `public/landing/*`,
`public/.well-known/…`; tests de landing, banner y despertar; `e2e/landing.spec.ts`; `a11y.spec.ts` (+1 ruta).
**Raíz/docs**: `scripts/reset-demo.sh`, `docs/deployment.md`, `docs/adr/0008-…`, `render.yaml` (blueprint).

## 5. Criterios de aceptación

- [ ] Con `BACKEND_URL` sin definir, dev/CI/E2E idénticos (31/31 rápido, 590 + 527 tests).
- [ ] `prod` con el secreto por defecto **no arranca** (test + comprobación manual).
- [ ] Imagen Docker construida y arrancada **en local** contra PostgreSQL: `GET /api/v1/markets` 200, memoria medida con `docker stats`.
- [ ] Modo demo: un admin recibe `403 DEMO_MODE` en las acciones de R5 y `200` en las demás (tests + medido en navegador).
- [ ] `/proyecto` renderiza sin errores de consola, axe 0 críticos/serios, CLS = 0, Lighthouse dentro de presupuesto.
- [ ] **Desplegado** (acciones del usuario con mi guía): tienda visible, compra con `4242…` → `CONFIRMED` por webhook real, admin demo reembolsa, `stripe_events` registra el evento.
- [ ] Apple Pay verificado por el usuario en Safari/iPhone **o** declarado explícitamente como no verificado.
- [ ] Medido: tiempo de despertar del backend y primera carga de `/proyecto` en la URL pública.

## 6. Riesgos específicos del despliegue

Ver `plan.md §4`. Un fallo de memoria en Render dispara el plan B (Fly.io/Koyeb) **sin cambiar el código**: la
imagen Docker y las variables son portables.

## 7. Qué NO hace esta fase (D13)

Dominio propio, analytics, `/pricing`, CD desde GitHub Actions (Fase 11), monitorización externa, backups
gestionados, i18n (Fase 12).

## 8. PR B — documentación de portfolio (después del despliegue)

- `README.md` reescrito (D10): pitch, enlace a la demo, GIF/capturas reales de producción, diagrama Mermaid,
  tabla de decisiones con enlaces a ADR, «cómo se construyó» (SDD, métricas: 527/590 tests, E2E, Lighthouse).
- Referencia de API y operación actuales **movidas** a `docs/` (nada se borra).
- `docs/architecture.md` (diagramas Mermaid del checkout y del pago con webhook), `docs/openapi.json` exportado.
- Capturas finales regeneradas con `npm run shots` apuntando a la URL pública (R11).
- Revisión de enlaces rotos y de que no queda ninguna clave en el repo.
