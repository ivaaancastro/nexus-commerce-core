# Spec — Notificaciones de pedido por email, plantilla HTML compartida y outbox (V1)

> **V1 del bloque «Mejoras de vitrina»** (aprobado 2026-10-22, antes de la Fase 8) · **⏳ pendiente de aprobación** (2ª redacción tras feedback del usuario: **emails HTML con estilo de la webapp** + **outbox con reintentos**).
> Requisitos verificables; el diseño está en `plan.md` (D1–D12) y la checklist en `tasks.md` (tras la aprobación).

---

## 1. Contexto

El panel ya cambia estados de pedido (7.4, máquina `PENDING → CONFIRMED → SHIPPED → DELIVERED` + `CANCELLED`) y el checkout crea el pedido **naciendo en `CONFIRMED`**, pero **nadie recibe ningún aviso**: la deuda *«sin notificaciones transaccionales de pedido»* (análisis 2026-10-09).

El `EmailService` ya existe (verificación y reset), con su guard `isMailConfigured()` y su `MODO DESARROLLO` (sin credenciales, el contenido se **loguea** — como corre en local y en CI: `.env` no tiene `MAIL_USERNAME`), pero escribe con **`SimpleMailMessage` = texto plano** y **no hay reintentos**: si el envío falla, el email queda sólo en el log.

Esta V1 conecta las piezas con **tres compromisos pedidos por el usuario**: (1) que el comprador se entere; (2) que **los 3 tipos de email compartan una misma plantilla HTML acorde a la webapp**; (3) que **un fallo de SMTP no pierda el email** (*outbox* + reintentos).

---

## 2. Requisitos funcionales

- **R1 · Email de compra**: al crear el pedido en el checkout, se genera **un** email «Hemos recibido tu pedido» con el número de pedido y un enlace al mismo. Nunca dice «pagado»/«cobrado» (no hay cobro: PSP fuera de alcance).
- **R2 · Email por transición**: cada cambio de estado exitoso desde el panel genera **un solo** email del estado de destino: Enviado, Entregado, Cancelado, Confirmado. Una transición rechazada (`409`) **no** genera nada; repetir el mismo estado **no** duplica emails (ya lo impide la guarda 7.4).
- **R3 · Contenido**: asunto `Nexus · Pedido {número} — {estado}`; en el cuerpo, el estado **en español** (`etiqueta()`), el **total con su divisa** (`BigDecimal`, regla 4.1) y el enlace a `/orders/{número}` construido con `app.base-url`. Si el destino es **ENVIADO**, añade **transportista y número de seguimiento** (si el pedido los tiene). El mensaje existe en **HTML y en texto plano** (multipart, RT3).
- **R4 · El email nunca cambia el resultado de la operación**: la generación se reduce a **insertar una fila** en la misma transacción (rápida y local); cualquier fallo de la capa de correo se produce **después, fuera de la transacción**, y queda reintentado/logueado. El pedido **se crea/cambia igual** siempre.
- **R5 · Sólo se avisa de lo que pasó**: la fila del email vive en **la misma transacción** que el cambio de estado — si hace **rollback**, **no queda fila** (ningún email de un hecho que no ocurrió); si **committea**, la intención está **garantizada** aunque el proceso se caiga después.
- **R6 · MODO DESARROLLO**: sin credenciales (`spring.mail.username` vacío), el contenido completo **se loguea** con el patrón existente — local y CI **no abren red**; la fila pasa a `SENT` sin enviar de verdad.
- **R7 · Estilo compartido (los 3 emails)**: verificación, recuperación de contraseña y emails de pedido usan **la misma plantilla HTML**: *wordmark* «NEXUS» en mayúsculas con tracking, tipografía **Geist con pila de respaldo**, paleta neutra de la web (`#ffffff` / `#171717` / filetes `neutral-200`), botón `neutral-900` con texto blanco en mayúsculas, **columna única** y **CSS inline**. Ningún email vuelve a salir «plano».
- **R8 · Reintentos**: un fallo de envío **reintenta con backoff** (base 30 s, se duplica, tope ~1 h, **8 intentos**) y, si agota, la fila queda **`FAILED`** con el error en el log — nunca un bucle infinito ni una excepción propagada.
- **R9 · Vitrina y contrato intactos**: cero cambios en `frontend/`, en rutas de API, en DTOs y en `SecurityConfig` (verificado por diff). Único cambio de datos: **la tabla nueva del outbox**.

## 3. Requisitos técnicos

- **RT1 — Plantilla HTML sin dependencias nuevas**: `EmailHtmlTemplates` con `envoltorio(título, cuerpo)` en **`text block`** de Java + tokens `{{...}}` (`String.replace`) — sin Thymeleaf. El CSS va **inline** (los clientes eliminan el CSS externo) y la tipografía es una **pila de respaldo** (Geist no es fiable en clientes → `Geist, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`).
- **RT2 — Migración `V17__email_outbox.sql`**: tabla `email_outbox` — `recipient`, `subject`, `body_html`, `body_text`, `status` (`PENDING`/`SENT`/`FAILED`), `attempts`, `next_attempt_at`, `last_error`, `created_at`, `sent_at`. `IF NOT EXISTS` reejecutable, sin backfill (`db/migration/` = V1–V17).
- **RT3 — `multipart/alternative`**: cada envío lleva **HTML + texto plano** vía **`MimeMessageHelper`** (UTF-8). `EmailService` deja de usar `SimpleMailMessage`.
- **RT4 — `OrderEmailNotifier`**: componente que **renderiza** (asunto + HTML + texto) e **inserta la fila** con la transacción activa. Los dos call sites llaman a **una línea**: `OrderService.processCheckout` (destino `CONFIRMED`, copy «recibido») y `AdminOrderService.cambiarEstado` (destino = estado elegido).
- **RT5 — Poller con `@EnableScheduling`**: `procesarPendientes()` recoge filas `PENDING` con `next_attempt_at <= now`, las marca en tránsito con **actualización condicional** (`WHERE status='PENDING'` → nadie envía dos veces), envía y marca `SENT`; en fallo `attempts++` + backoff; a los 8 → `FAILED`. **Nunca lanza** al programador. Las filas nacen con **`next_attempt_at = created_at + 30 s`** (D10, determinismo).
- **RT6 — Copy centralizada en un solo sitio**: asunto y cuerpo por estado definidos una sola vez; `etiqueta()` reutilizada, sin duplicar textos (D4).
- **RT7 — Sin superficie nueva de API**: sin controllers, sin DTOs, sin cambios en `SecurityConfig`, **sin una sola línea de frontend**. La única superficie de datos es `V17`.
- **RT8 — Tests espejo del patrón existente**: `ArgumentCaptor` adaptado a **`MimeMessage`** en `EmailServiceTest` (**mismas aserciones**: asunto, código, enlace) — **R8.3 declarada**; `@Mock` del notifier/poller en los tests de servicio que lo necesiten. **Ninguna aserción preexistente se toca.** Tests del outbox llaman a `procesarPendientes()` **a mano** (sin esperar al cron ni al reloj).
- **RT9 — Ningún test con red real**: mock en unitario y MODO DESARROLLO en los de contexto.

## 4. Alcance y no-alcance

**En alcance**: plantilla HTML compartida (los 3 emails), `MimeMessageHelper` multipart, `V17` del outbox, poller con reintentos, `OrderEmailNotifier`, los 2 enganches, el copy por estado y sus tests. **Backend sólo.**

**Fuera de alcance (ratificado con el usuario 2026-10-22)**: **Mailpit / E2E de correo** (→ Fase 8, junto al Docker) · email al admin · preferencias de baja · push/SMS · desglose fiscal en el email (la factura sigue siendo `/receipt`) · emails de marketing · frontend · outbox para verificación/reset (su fallo lo recupera el usuario con el botón de reenvío — D7).

## 5. Criterios de aceptación / gates

1. Backend `./mvnw test` **verde** (345 base + los nuevos; 0 errores/0 fallos).
2. Frontend **sin cambios de código**: `tsc` 0 · ESLint 0/0 · build 0 · **470 tests** intactos (R9 por diff).
3. **E2E rápido 25/25** sin tocar ni un fichero de `e2e/`.
4. **Preview visual en navegador (D12)**: se generan los 3 emails en un `.html` y **se abren en el navegador** — el estilo se **mira**, no se supone (wordmark, Geist, botón, filetes, columna única).
5. **Verificación medida en stack real**: transición a ENVIADO desde el panel → fila en `email_outbox` (una) → `procesarPendientes()` → en la **salida del backend** aparece el MODO DESARROLLO con asunto, enlace y tracking correctos; el `409` de repetir estado **no** crea fila nueva.
6. **Regresiones R4/R5/R8 medidas**: `send` lanza → fila `attempts++`, estado intacto y `200`; rollback → sin fila; fila con 8 intentos → `FAILED`, sin excepción.
7. `/spec-check order-status-emails` → **APROBADO** (R1–R9 + RT1–RT9).

## 6. Datos y API

- **Tabla nueva `email_outbox`** (`V17`, columnas en RT2) — se **lee** de `Order`: `orderNumber`, `currency`, `totalAmount`, `carrier`, `trackingNumber`, `user.email`, `status`; se **escribe** la fila del email dentro de la transacción del negocio.
- **Sin endpoints nuevos ni modificados**: ni `/admin/orders/**` ni `/orders/**`. El efecto visible es una fila de tabla y, después, un envío (o una línea de log en MODO DESARROLLO).

## 7. Documentación

- CHANGELOG con la entrada de la V1.
- `AGENTS.md`: bloque ESTADO ACTUAL + párrafo de decisiones (tras implementar).
- `MEMORY.md`: bloque «Mejoras de vitrina» con la V1 marcada.
- **Sin ADR** (precedente: emails de verificación/reset; no cambia stack — sólo Flyway, que ya es rutina) y **sin PR de documentación de cierre** (D11).
