# Fase 10 — Landing, despliegue y documentación 🟠 — plan

> **Estado**: **aprobada con 3 ajustes** (2026-11-11) — ver «Ajustes de la aprobación» en `spec.md`.
> **Contexto**: el proyecto es un **portfolio** para LinkedIn. Hoy solo existe en `localhost`: nadie puede
> probarlo. Esta fase lo hace **visitable, entendible y creíble** — es lo que convierte meses de trabajo en algo
> que un reclutador abre con un clic.

## 1. Objetivo

Que cualquier persona pueda, en menos de 2 minutos y sin instalar nada:

1. Abrir una **URL pública** y ver la tienda funcionando con datos reales (catálogo, fotos, 4 mercados).
2. Entender **qué es el proyecto y qué lo hace difícil** desde una landing (concurrencia, idempotencia,
   webhook de Stripe, outbox, SDD), con capturas reales.
3. **Comprar con Stripe en test mode** (tarjeta `4242…`) y **entrar al panel admin** con una cuenta demo para ver
   pedidos, stock, dashboard y reembolsos.
4. Leer un **README de portfolio** con diagrama de arquitectura y decisiones, y una guía de despliegue
   reproducible.

## 2. Situación de partida (medida en el código, 2026-11-11)

| Hecho | Consecuencia |
|:---|:---|
| `next.config.ts` reescribe `/api/v1/*` a **`http://localhost:8080` fijo** | Hay que parametrizar el destino (`BACKEND_URL`). El navegador sigue hablando solo con el origen del frontend ⇒ **no hay CORS** (ADR-0004 se mantiene) |
| `application.properties` solo tiene perfil de desarrollo: `show-sql=true`, `jwt.secret` con **valor por defecto público** en el repo, datasource a `localhost` | Hace falta un perfil `prod`: SQL silenciado, datasource/JWT por variables y **arranque abortado si el secreto es el de por defecto** |
| No hay `Dockerfile` ni `render.yaml`/`vercel.json`; `docker-compose.yml` solo levanta PostgreSQL | Hay que empaquetar el backend (imagen multi-etapa) |
| PostgreSQL necesita **pgvector** (búsqueda semántica, ADR-0002) | Se descartan hostings de Postgres sin la extensión |
| Sin SMTP configurado, el email va a log («MODO DESARROLLO») y **el registro exige verificar el email** | En la demo pública **nadie puede registrarse y entrar** ⇒ cuentas demo sembradas, ya verificadas |
| `admin@nexus.dev` / `Admin1234!` está **en el README público** (semilla V13) | En un despliegue público esa cuenta es de dominio público: hay que decidir qué puede hacer un visitante con ella (D6) |
| `/` es el menú editorial de familias de la tienda (3.1) | La landing no puede pisarlo sin tocar enlaces del header y E2E (D4) |
| Stripe local usa `stripe listen`; Apple Pay **no se pudo probar** (exige HTTPS + dominio verificado) | Se registra el webhook real en el dashboard de Stripe apuntando al backend desplegado y se verifica Apple Pay (D8) |
| CI (`ci.yml`) ya corre backend, frontend, E2E y Lighthouse | **El despliegue automático se deja a la Fase 11 (CI/CD)**; aquí el despliegue es por la integración Git de cada proveedor |

## 3. Decisiones de diseño

| # | Decisión | Justificación / alternativa descartada |
|:--|:---|:---|
| **D1** | **Hosting 100 % gratuito y sin tarjeta cuando sea posible**: frontend en **Vercel (Hobby)**, backend como **imagen Docker en Render (Free web service)**, base de datos en **Neon (Free)** | Neon ofrece **pgvector**, no caduca y da 0,5 GB (el seed ocupa una fracción). Render Postgres gratuito **caduca a los 30 días** ⇒ descartado. Fly.io exige tarjeta ⇒ plan B. **Coste honesto**: el backend de Render duerme tras 15 min sin tráfico y tarda ~50 s en despertar (D5) |
| **D2** | **`BACKEND_URL` parametriza el rewrite** (por defecto `http://localhost:8080`, así dev y CI no cambian). El navegador solo habla con el origen de Vercel | Mantiene ADR-0004 (proxy, sin CORS ni cookies cross-site). Alternativa descartada: `NEXT_PUBLIC_API_URL` + CORS en Spring (superficie de seguridad nueva sin beneficio) |
| **D3** | **Perfil Spring `prod`** (`application-prod.properties`): `show-sql=false`, datasource y `JWT_SECRET` obligatorios por entorno, logs a `INFO`, memoria acotada (`-Xmx` para 512 MB). **Un `@PostConstruct` aborta el arranque si `jwt.secret` es el valor por defecto del repo** (mismo patrón que `sk_live_`) | Un secreto JWT público en producción permitiría forjar tokens de admin. La guarda convierte el olvido en un fallo en voz alta |
| **D4** | **La landing vive en `/proyecto`** y la tienda (`/`) **no se toca**. Un banner discreto en la cabecera de la tienda solo en modo demo enlaza a `/proyecto` | El roadmap decía «`/`», pero reemplazar el menú editorial rompe la 3.1, los enlaces del header y los E2E sin beneficio: el visitante llega por el enlace de LinkedIn, que **apunta a `/proyecto`**. Alternativa descartada: mover la tienda a `/shop` |
| **D5** | **Despertar del backend**: el frontend muestra un estado «Despertando la demo (hasta ~1 min)…» si la primera petición tarda > 4 s, y el README lo avisa. Opcional: un *ping* externo gratuito cada 10 min (documentado, no obligatorio) | Es una limitación real del plan gratuito; esconderla daría la peor primera impresión. Se mide y se documenta |
| **D6** | **Modo demo** (`app.demo.enabled=true` solo en el despliegue): cuentas sembradas **`demo@nexus.dev`** (USER) y la admin ya existente; y un **guard** que responde `403 DEMO_MODE` a las acciones **destructivas o de cuenta** de un admin: borrar productos/cupones, cambiar rol/suspender usuarios y el flujo `forgot-password`/`reset-password` (ajuste A2: no existe otro cambio de contraseña). **Todo lo demás está permitido** (cambiar estado de pedidos, stock, precios, reembolsos) | Un panel admin público sin red permitiría vandalizar la demo (suspender usuarios, borrar el catálogo). Pero un panel de solo lectura no luce: reembolsar y cambiar estados **es** lo que se quiere enseñar. Un script `scripts/reset-demo.sh` restaura datos |
| **D7** | **Datos semilla de la demo**: migraciones de catálogo/stock/precios ya existentes + una carpeta Flyway **`db/demo/`** con una **migración repetible `R__demo_data.sql`** (ajuste A1) cargada solo con `spring.flyway.locations` del perfil demo (usuario demo verificado, dirección y un par de pedidos de ejemplo en estados distintos para que el dashboard no salga vacío). **Nunca** en `db/migration/` | Las migraciones de producción no deben contener datos de demostración. El usuario demo nace verificado porque no hay SMTP real |
| **D8** | **Stripe en la demo**: claves **test** en variables de Render; **endpoint de webhook registrado en el dashboard de Stripe** apuntando a `https://<backend>/api/v1/webhooks/stripe` con su `whsec_` propio. **Apple Pay**: verificación de dominio con el fichero `/.well-known/apple-developer-merchantid-domain-association` servido desde `frontend/public/` | `sk_live_` sigue abortando el arranque. Apple Pay solo se puede probar desde Safari/iPhone con una tarjeta en la Wallet: **lo verifica el usuario**, yo dejo la configuración y la guía |
| **D9** | **Landing `/proyecto`**: hero, «qué lo hace difícil» (4 bloques: concurrencia, idempotencia, pagos con webhook, outbox), tour con **capturas reales** (catálogo, ficha, checkout con Stripe, panel admin, dashboard, email), cuentas demo y tarjeta de pruebas visibles, enlaces a GitHub / Swagger / README. **Estilo editorial Zara** del resto. Imágenes estáticas en `public/landing/` con `next/image` y `sizes` (regla §6.7), **sin CLS** | Es la pieza que verá el reclutador. Las capturas se generan con un script Playwright reproducible (`npm run shots`), no a mano |
| **D10** | **README de portfolio** reescrito de arriba abajo: pitch de 3 líneas, enlace a la demo, GIF/capturas, **diagrama de arquitectura en Mermaid** (se renderiza en GitHub sin herramientas), tabla de decisiones clave con enlace a su ADR, «cómo se construyó» (SDD) y puesta en marcha. El contenido de operación actual se **mueve** a `docs/`, no se pierde | Hoy el README es una referencia de API de 300+ líneas; un visitante necesita historia primero y referencia después |
| **D11** | **Documentación técnica** en `docs/`: `architecture.md` (capas, flujos de checkout y de pago con diagramas Mermaid), `deployment.md` (guía paso a paso Neon → Render → Vercel → Stripe, con variables) y `docs/openapi.json` **exportado** del backend | Reproducibilidad: la guía de despliegue prueba que el proyecto no depende de «mi máquina» |
| **D12** | **Dos PRs**: **PR A** (`feat/landing-deploy-docs`) = código y configuración (D2, D3, D5, D6, D7, D9, Dockerfile, vars) **sin URL pública todavía**; **PR B** (`docs/portfolio-readme`) = README, capturas y GIF **tras desplegar**, porque necesitan la demo real | Las capturas de producción no pueden existir antes de producción |
| **D13** | **Fuera de alcance**: dominio propio de pago (se usa el `*.vercel.app`), analytics (GA4 descartado), `/pricing`, despliegue automático desde CI (Fase 11), monitorización externa, backups gestionados, CDN de imágenes, SEO avanzado más allá de metadatos/`og:image` | Se declara para no reabrirlo |
| **D14** | **ADR-0008** «Despliegue: Vercel + Render + Neon, proxy por rewrite y modo demo» | AGENTS.md regla 6: cambia la topología de despliegue y añade proveedores |

## 4. Riesgos

| Riesgo | Mitigación |
|:---|:---|
| 512 MB de Render no bastan para Spring Boot + Spring AI | Perfil `prod` con `-Xmx` acotado y `spring.main.lazy-initialization` **solo si se mide** que hace falta; se mide el arranque real y se documenta. Plan B: Fly.io (con tarjeta) o Koyeb |
| Cold start de ~50 s da mala primera impresión | D5: estado explícito en UI + aviso en README + ping opcional |
| Visitante vandaliza la demo | D6 (guard) + `reset-demo.sh`; los datos son de demostración y no hay datos personales reales |
| Secretos filtrados al repo | Todo por variables de entorno; **detección de secretos queda en la Fase 11.4**, pero aquí se revisa a mano que no se versione ninguna clave |
| Webhook de Stripe mal configurado en la nube | Guía con prueba explícita (`Send test webhook` del dashboard) y comprobación de `stripe_events` |
| Imágenes de producto (~peso en `public/products/`) lentas en Vercel | Ya se sirven por `next/image` con `sizes`; se mide con Lighthouse sobre la URL desplegada |
| Neon suspende el compute tras inactividad | El primer arranque del backend reintenta la conexión; se documenta |

## 5. Estimación

PR A: ~1 jornada de código + tests · despliegue (acciones tuyas en 3 paneles, yo guío y verifico) ~1 hora ·
PR B: ~medio día (capturas, GIF, README, docs).
