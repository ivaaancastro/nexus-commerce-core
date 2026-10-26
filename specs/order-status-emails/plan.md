# Plan — Notificaciones de pedido por email, con plantilla HTML compartida y outbox (V1)

> **V1 del bloque «Mejoras de vitrina»** (aprobado 2026-10-22, antes de la Fase 8) · documento de diseño (D1–D12) · **⏳ pendiente de aprobación (2ª redacción tras feedback del usuario)**.
> Feedback incorporado: (1) **los 3 emails comparten plantilla HTML con el estilo de la webapp** — nada de texto plano —; (2) se añade **outbox con reintentos**.
> El alcance vinculante está en `spec.md`; la checklist en `tasks.md` (tras la aprobación).

---

## 1. Objetivo

1. **Que el comprador se entere**: email «hemos recibido tu pedido» al
   comprar + un email por cada cambio de estado del panel (enviado con
   transportista y seguimiento, entregado, cancelado).
2. **Que los emails estén bien hechos**: los **tres** tipos de email que
   existen —verificación, recuperación de contraseña y los nuevos de pedido—
   comparten **una misma plantilla HTML** acorde a la webapp (tipografía Geist
   con pila de respaldo, *wordmark* en mayúsculas con tracking, paleta
   neutra, botón `neutral-900` idéntico a los de la web, filetes
   `neutral-200`), **multipart**: HTML + texto plano de respaldo.
3. **Que un fallo de SMTP no pierda un email**: **outbox transaccional** con
   reintentos — la petición se guarda en la **misma transacción** que el
   cambio de estado y un programador la envía después con *backoff*.

**Fuera de alcance** (revisado con el usuario 2026-10-22 y ratificado): Mailpit/E2E de correo (→ Fase 8), email al admin, preferencias de baja, push/SMS, desglose fiscal en el email, marketing, frontend y API.

---

## 2. Estado real — auditoría (sobre `main` = 93d1902, post-merge B+C)

### 2.1 El correo ya existe — pero en texto plano y sin garantías

| Señal | Hallazgo |
|:---|:---|
| `EmailService.java` L16-86 | `JavaMailSender` + **`SimpleMailMessage`** = **sólo texto plano** (no puede llevar HTML) — los métodos `sendVerificationEmail` y `sendPasswordResetEmail` |
| **Guard** L83-85 | **`isMailConfigured()`** = `spring.mail.username` no vacío. Sin credenciales → **`MODO DESARROLLO`**: el contenido **se loguea** y no se envía nada |
| `.env` | **`MAIL_USERNAME` no está** (medido: 0 coincidencias) ⇒ local y CI corren en MODO DESARROLLO: **cero red en tests** |
| L46-50 | `try/catch` + `log.error`: el fallo aislado **en el sitio**, pero **el email se pierde** — no hay dónde guardarlo ni reintento |
| L55-63 | `buildLink()` con `app.base-url` — los enlaces ya apuntan al frontend activo |
| Backend | **No hay ni `@Scheduled` ni `@EnableScheduling` ni `@Async`** en todo el código: no existe infraestructura de tareas (habrá que añadir la mínima) |
| Tests | `EmailServiceTest` (patrón F1-F3): `@Mock JavaMailSender` + `ReflectionTestUtils` + **`ArgumentCaptor<SimpleMailMessage>`** — al pasar a `MimeMessage` la captura se adapta (**mismas aserciones**, R8.3) |

### 2.2 Los dos puntos de enganche, medidos

| Señal | Hallazgo |
|:---|:---|
| `OrderService.java` L139 | El pedido **nace en `OrderStatus.CONFIRMED`** (sin cobro) → el copy dice «hemos recibido», **nunca** «pagado» |
| `OrderService.java` L152 | `save` del pedido — enganche **1** (checkout, `@Transactional` con la reserva de stock, regla 4.2) |
| `AdminOrderService.java` L139-173 | `cambiarEstado` — enganche **2**: lock pesimista, guardas `409`, efectos de stock en la transacción, `save` + `log` |
| `AdminOrderService.java` L52-56 | Máquina: `PENDING→{CONFIRMED,CANCELLED}`, `CONFIRMED→{SHIPPED,CANCELLED}`, `SHIPPED→{DELIVERED}`, `DELIVERED`/`CANCELLED` = fin |
| `AdminOrderService.java` L246-250 | `etiqueta(OrderStatus)` → «Pendiente/Confirmado/Enviado/Entregado/Cancelado» — **el copy en español ya existe** y se reutiliza |
| `Order.java` L27-84 | `orderNumber`, `currency`, `totalAmount`, `carrier`, `trackingNumber` y `user` (`→ User.email`): **todos los datos del email ya viajan** |
| Checkout | Requiere sesión ⇒ siempre hay `user.email` (y el caso nulo se defiende) |

### 2.3 Por qué fuera de alcance lo que queda fuera

Valorado con el usuario (2026-10-22): reintentos/outbox = **lo único con peso real → YA DENTRO**; Mailpit+E2E de correo encaja en la **Fase 8 (Docker)**; email al admin (vive en el panel), baja (transaccional ≠ marketing), SMS (coste por mensaje, sin teléfonos) y desglose fiscal (eso es `/receipt`) = **bajos hoy**.

---

## 3. Decisiones (D1–D12)

| # | Decisión |
|:--|:---|
| **D1 — Disparadores** | **(a)** checkout: al guardarse el pedido → *«Hemos recibido tu pedido»*. **(b)** panel: **cada transición exitosa** → email del estado de destino (genérico por destino, así `PENDING→CONFIRMED` queda cubierto). Una transición `409` no genera fila; repetir estado tampoco (ya lo impide la 7.4) |
| **D2 — Outbox transaccional (sustituye al envío post-commit)** | El email **no se envía en el momento**: se **inserta una fila en `email_outbox` dentro de la MISMA transacción** que el cambio de estado/checkout. Así: si la transacción hace **rollback** (p. ej. guarda de stock al enviar), la fila **no existe** — el correo cuenta lo que pasó de verdad; y si la transacción **committea**, la intención está **garantizada** aunque el servidor se caiga después. **La respuesta HTTP nunca espera a SMTP** |
| **D3 — Reintentos con backoff, y un final honesto** | Un programador (`@Scheduled`) procesa las filas `PENDING` cuyo `next_attempt_at` llegó: envío → `SENT`; fallo → `attempts++` y `next_attempt_at = ahora + backoff` (base 30 s, doble, tope ~1 h); tras **8 intentos → `FAILED`** con `log.error` (nunca un bucle infinito). Un fallo del envío **nunca** lanza hacia fuera del programador (R4 estructural) |
| **D4 — `OrderEmailNotifier`, un solo sitio** | Componente que **renderiza** (asunto + HTML + texto) e **inserta la fila** en la transacción activa. Los dos call sites llaman a **una línea** (`notifier.notificar(order, destino)`). El copy vive **una sola vez** (herencia de `taxes.ts` de la B) |
| **D5 — Plantilla HTML compartida, los 3 emails** | **`EmailHtmlTemplates`**: `envoltorio(título, cuerpo)` devuelve el HTML completo; los 3 mensajes (verificación, reset, pedido) componen sólo su cuerpo. **Estilo de la webapp**: *wordmark* «NEXUS» en `uppercase`+`tracking-widest` (no hay logo en `public/`, así que **texto**: cero imágenes rotas), tipografía **`Geist, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`** (Geist no es fiable en clientes → pila de respaldo), paleta `#ffffff`/`#171717`/neutros, botón `neutral-900` con texto blanco en mayúsculas, filetes `neutral-200`, columna única. **Todo el CSS inline** (los clientes eliminan el CSS externo) |
| **D6 — `multipart/alternative`** | Cada email lleva **HTML + texto plano de respaldo** (accesibilidad, clientes sin HTML, filtros). Se pasa de `SimpleMailMessage` a **`MimeMessageHelper`**; los tests F1-F3 adaptan la captura **sin cambiar sus aserciones** (asunto, código, enlace) — **R8.3** |
| **D7 — Sólo pedidos por outbox** | Verificación y reset **se quedan en envío directo** como hoy (con la nueva plantilla): su fallo es **recuperable por el usuario** (botón de reenvío), mientras que un email de «enviado» perdido **no tiene repetición posible**. Menos superficie y menos churn en `AuthService` |
| **D8 — Destinatario** | `order.getUser().getEmail()`; nulo → `log.warn` y sin fila (el pedido no se entera y nada más falla) |
| **D9 — Superficie** | **Sí migración `V17__email_outbox.sql`** y **sí `@EnableScheduling`** (el mínimo de infraestructura de tareas: sin cola externa, sin Redis, sin `@Async`). **Sin controllers, sin DTOs, sin `SecurityConfig`, sin frontend, sin reindex y sin ADR** (precedente: los emails de verificación no lo tienen) |
| **D10 — Determinismo del programador** | La primera ejecución difiere (`initialDelay`) y las filas nacen con **`next_attempt_at = created_at + 30 s`** — un test que acaba de crear una fila la ve todavía `PENDING`. Los tests de lógica llaman a **`procesarPendientes()` a mano** (determinista, sin esperar al cron). Parámetros del backoff por propiedad con default |
| **D11 — MODO DESARROLLO intacto** | El poller llama a `EmailService`, que **ya sabe** loguear cuando no hay credenciales: en local/CI la fila pasa a `SENT` **logueando el HTML** — cero red, y el contenido queda medible en la consola |
| **D12 — Verificación medida** | (a) **preview**: un test/runner genera los 3 emails en un `.html` que **se abre en navegador** para validar el estilo con ojos; (b) `ArgumentCaptor` sobre asunto/destinatario/enlace/tracking/HTML; (c) regresión: `send` lanza → fila `attempts++` y nada rompe; (d) gates habituales. **Sin E2E nuevo** (Mailpit → Fase 8) |

**Estimación**: backend — plantilla + 1 método de email + notifier + entidad/repositorio del outbox + poller + 2 enganches (≈ 7-9 ficheros) y ≈ 5 ficheros de tests. **1 migración (V17)**. Frontend intacto.

---

## 4. Riesgos y trampas previstas

1. **Dentro de la transacción ≠ enviar dentro de la transacción**: se **inserta** (rápido, local, seguro) y se **envía después**, fuera de ella. Nunca SMTP dentro del `@Transactional`.
2. **El poller en tests de contexto**: resuelto en D10 — `next_attempt_at` diferido + llamadas manuales; ningún test depende del reloj ni del cron.
3. **Doble envío por concurrencia**: la fila pasa a `PENDING→SENDING` con actualización condicional (`WHERE status='PENDING'`) antes de enviar; una sola instancia y volumen bajo, pero la guarda cuesta una línea.
4. **Gmail/Outlook destrozan CSS externo y webfonts** → todo inline + pila de respaldo + columna única (D5). Sin imágenes externas: el «logo» es texto.
5. **El HTML vive en `text block` de Java** (sin Thymeleaf ni dependencia nueva): tokens `{{...}}` + `String.replace` — simple, testeable y sin añadir stack.
6. **R8.3 inevitables y declaradas**: `EmailServiceTest` (captura `SimpleMailMessage` → `MimeMessage`, mismas aserciones) y los tests de servicio que ganen la dependencia nueva (`@Mock` del notifier).
7. **Copy confundible con cobro**: pedido nace `CONFIRMED` sin cobro → «recibido», jamás «pagado».
