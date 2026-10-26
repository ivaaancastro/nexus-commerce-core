# Tasks — Notificaciones de pedido por email, plantilla HTML y outbox (V1)

> Spec **aprobada** (v2, 2026-10-22) · plan `plan.md` (D1–D12) · spec `spec.md` (R1–R9 + RT1–RT9).
> Regla: marcar cada tarea al completarla; si el alcance cambia, primero `spec.md`.

## Fase A — Plantilla HTML compartida (R7, RT1)

- [x] A1 · `EmailHtmlTemplates` en `service/`: `envoltorio(título, cuerpoHtml)` con **text block** + tokens `{{...}}` — CSS **inline**, tipografía `Geist, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`, *wordmark* «NEXUS» `uppercase tracking-widest`, botón `neutral-900` texto blanco mayúsculas, filete `neutral-200`, columna única, pie con `{{ENLACE_TEXTO}}` (R7, D5)
- [x] A2 · Cuerpos de los 3 mensajes como helpers que devuelven `(asunto, htmlCuerpo, textoPlano)`: verificación · reset · pedido (genérico por estado, con tracking cuando el destino es ENVIADO) (R3, R7, RT6)
- [x] A3 · Test de la plantilla: asertar estructura (wordmark, pila de respaldo, `style` inline, botón, sin CSS externo ni imágenes) con captura de HTML

## Fase B — `EmailService` multipart (RT3, RT6)

- [x] B1 · `sendVerificationEmail`/`sendPasswordResetEmail` pasan de `SimpleMailMessage` a **`MimeMessageHelper`** (UTF-8, `multipart/alternative`: HTML + texto plano), con el mismo guard `isMailConfigured()` y `MODO DESARROLLO` (loguea ahora también el HTML)
- [x] B2 · Método nuevo `sendOrderEmail(to, asunto, html, texto)` con el mismo patrón
- [x] B3 · **R8.3**: `EmailServiceTest` F1-F3 adaptan la captura a `MimeMessage` **con las mismas aserciones** (asunto, código, enlace) + cobertura del nuevo método

## Fase C — Outbox (R4, R5, R8, RT2, RT5)

- [x] C1 · Migración **`V17__email_outbox.sql`**: tabla `email_outbox` (`recipient`, `subject`, `body_html`, `body_text`, `status`, `attempts`, `next_attempt_at`, `last_error`, `created_at`, `sent_at`), reejecutable, índices mínimos (`status` + `next_attempt_at`)
- [x] C2 · Entidad `EmailOutbox` + repositorio (búsqueda de `PENDING` con `next_attempt_at <= now`, **actualización condicional** `WHERE status='PENDING'` para el traspaso a `SENDING` — nadie envía dos veces)
- [x] C3 · `OrderEmailNotifier`: renderiza (asunto + HTML + texto con la plantilla) e **inserta la fila con la transacción activa**; destinatario nulo → `log.warn` sin fila (D4, D8)
- [x] C4 · Poller `EmailOutboxPoller` con **`@EnableScheduling`**: `procesarPendientes()` → envía (o MODO DESARROLLO) → `SENT`; fallo → `attempts++` + backoff (30 s ×2, tope ~1 h) a los 8 → `FAILED` + `log.error`; **nunca lanza**; filas nacen con `next_attempt_at = created + 30 s` (D10)
- [x] C5 · Tests del notifier y del poller (llamada **manual** a `procesarPendientes()`, sin cron ni reloj): éxito → `SENT` · fallo → `attempts++` y reprogramación · 8 intentos → `FAILED` sin excepción · carrera (fila ya tomada) → nadie la envía

## Fase D — Enganches (R1, R2, RT4)

- [x] D1 · `OrderService.processCheckout`: `notifier.notificar(savedOrder, CONFIRMED)` — copy «Hemos recibido tu pedido», nunca «pagado» (R1)
- [x] D2 · `AdminOrderService.cambiarEstado`: `notifier.notificar(order, nuevoEstado)` **dentro de la transacción** (la fila existe si y sólo si el cambio committea — R5); una transición `409` no llega a generar fila (R2)
- [x] D3 · Tests de servicio: cada enganche genera **una** fila con asunto/destinatario correctos · transición `409`/rollback → **sin fila** (R2, R5) · R8.3 declaradas (los `@InjectMocks` ganan el notifier)

## Fase E — Verificación medida (D12, gates de la spec §5)

- [x] E1 · **Preview**: generador de los 3 emails a un `.html` y **apertura en navegador** — se mira el estilo (wordmark, Geist, botón, filetes, columna única)
- [x] E2 · Backend `./mvnw test` **verde** (345 + nuevos)
- [x] E3 · Frontend intacto por diff: `tsc` 0 · ESLint 0/0 · build 0 · **470 tests**
- [x] E4 · **E2E rápido 25/25** sin tocar `e2e/`
- [x] E5 · Stack real: transición a ENVIADO → **una fila** en `email_outbox` → `procesarPendientes()` → log MODO DESARROLLO con asunto/enlace/tracking · repetir estado → `409` **sin fila nueva**
- [x] E6 · `/spec-check order-status-emails` → **APROBADO**

## Fase Cierre — Documentación

- [x] F1 · CHANGELOG con la entrada de la V1
- [x] F2 · `AGENTS.md`: ESTADO ACTUAL tras implementar + párrafo de decisiones V1
- [x] F3 · `MEMORY.md`: V1 marcada en el bloque «Mejoras de vitrina»
- [x] F4 · `tasks.md` 100 % · **pedir permiso** para commit/push/PR (⚠️ los docs del plan/spec/mapa siguen sin commitear — «aun no»)
