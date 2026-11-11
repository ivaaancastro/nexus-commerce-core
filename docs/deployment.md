# Despliegue de la demo pública

> Fase 10 (`specs/fase10/`, ADR-0008). Topología: **Neon** (PostgreSQL + pgvector) → **Render** (backend Docker) →
> **Vercel** (frontend, proxy `/api/v1/*` → Render) → **Stripe** (test mode, webhook al backend).
> Todo cabe en los planes gratuitos. Ninguna clave real se versiona: todo va en variables de cada panel.

```
Navegador ──► Vercel (Next.js)  ── rewrite /api/v1/* ──►  Render (Spring Boot, perfiles prod,demo) ──► Neon
                                                              ▲
                                     Stripe ── webhook ───────┘  POST /api/v1/webhooks/stripe
```

El navegador **solo** habla con el dominio de Vercel, así que no hay CORS (ADR-0004).

---

## 1. Base de datos — Neon

1. [neon.tech](https://neon.tech) → *New project* · PostgreSQL 16 · región **Frankfurt** (la misma que Render).
2. Copia la *connection string*, que tiene esta forma: `postgresql://<usuario>:<contraseña>@<host>/<db>?sslmode=require`.
3. Pásala a JDBC para el backend:
   - `DATABASE_URL` = `jdbc:postgresql://<host>/<db>?sslmode=require`
   - `DATABASE_USERNAME` = `<usuario>` · `DATABASE_PASSWORD` = `<contraseña>`
4. No hace falta crear nada a mano: Flyway aplica `V1…V23` al arrancar (incluido `CREATE EXTENSION vector`, que Neon
   permite) y, con el perfil `demo`, `db/demo/R__demo_data.sql`.

> Neon suspende el *compute* tras unos minutos sin uso. El pool del perfil `prod` espera hasta 60 s en el primer
> arranque (`initialization-fail-timeout`), así que el backend no aborta mientras Neon despierta.

## 2. Backend — Render

1. [render.com](https://render.com) → *New* → **Blueprint** → este repositorio. Render lee `render.yaml`: un
   *web service* Docker gratuito con `rootDir: backend`, *health check* en `/api/v1/markets` y
   `SPRING_PROFILES_ACTIVE=prod,demo`. `JWT_SECRET` se genera solo.
2. Rellena las variables marcadas como `sync: false` (tabla del §5). `APP_BASE_URL` es la URL de Vercel (§3), así que
   puedes dejarla vacía y volver a ponerla después.
3. Primer despliegue: compila la imagen (unos minutos) y arranca. Comprueba en el log:
   - `JWT: secreto de producción validado.`
   - `MODO DEMO activo: …`
   - `PAGOS: Stripe en test mode activo.` (o `MODO SIN PASARELA` si aún no has puesto las claves)
4. Prueba: `curl https://<backend>.onrender.com/api/v1/markets` debe devolver los 4 mercados.

**Plan gratuito**: 512 MB y el servicio duerme tras 15 min sin tráfico. La imagen acota la JVM (`-Xmx200m`,
SerialGC, `MALLOC_ARENA_MAX=2`): medido con `docker run --memory=512m` y carga, unos 385 MiB. Si Render mata el proceso por memoria (`Out of memory` en el panel), el plan B es Fly.io o Koyeb con la
**misma imagen y las mismas variables**. Opcional: un ping externo gratuito (p. ej. cron-job.org) a `/api/v1/markets`
cada 10 min evita el arranque en frío.

## 3. Frontend — Vercel

1. [vercel.com](https://vercel.com) → *Add New Project* → este repositorio → **Root Directory: `frontend`**
   (framework Next.js detectado).
2. Variables de entorno (§5): `BACKEND_URL`, `NEXT_PUBLIC_DEMO=1`, `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_API_DOCS_URL`.
   Las `NEXT_PUBLIC_*` y `BACKEND_URL` se leen **en el build**: si las cambias, vuelve a desplegar.
3. Despliega y abre `https://<proyecto>.vercel.app/proyecto`.
4. Vuelve a Render y pon `APP_BASE_URL=https://<proyecto>.vercel.app` (son los enlaces de los emails).

## 4. Stripe — test mode

1. Dashboard de Stripe en **modo de prueba** → *Developers → API keys*: `sk_test_…` y `pk_test_…` en Render.
   Una clave `sk_live_…` **hace fallar el arranque**.
2. *Developers → Webhooks → Add endpoint*:
   - URL: `https://<backend>.onrender.com/api/v1/webhooks/stripe`
   - Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - Copia el *signing secret* (`whsec_…`) a `STRIPE_WEBHOOK_SECRET` en Render y reinicia.
3. Comprobación:
   - Compra en la tienda con `4242 4242 4242 4242`. El pedido pasa a **Confirmado** cuando llega el webhook.
   - En Stripe, *Webhooks → tu endpoint*: la entrega figura como `200`.
   - Un *Send test webhook* con una firma ajena no aplica nada: la firma la verifica el backend.

### Apple Pay

Apple Pay exige HTTPS y un dominio verificado, así que no se puede probar en `localhost`.

1. Stripe → *Settings → Payment methods → Apple Pay → Add new domain* → `<proyecto>.vercel.app`.
2. Descarga el fichero de verificación y guárdalo, **sin extensión**, en
   `frontend/public/.well-known/apple-developer-merchantid-domain-association`. Es público por diseño: no es un
   secreto.
3. Haz commit, vuelve a desplegar Vercel y pulsa *Verify* en Stripe.
4. Pruébalo desde Safari (macOS o iPhone) con una tarjeta en la Wallet. En test mode no se cobra nada.

## 5. Variables

| Variable | Dónde | Obligatoria | Ejemplo (no secreto) |
|:---|:---|:---:|:---|
| `SPRING_PROFILES_ACTIVE` | Render | sí | `prod,demo` (ya en `render.yaml`) |
| `DATABASE_URL` | Render | sí | `jdbc:postgresql://ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require` |
| `DATABASE_USERNAME` | Render | sí | `neondb_owner` |
| `DATABASE_PASSWORD` | Render | sí | — |
| `JWT_SECRET` | Render | sí | lo genera el blueprint; ≥ 32 bytes, nunca el del repo |
| `APP_BASE_URL` | Render | sí | `https://nexus-commerce.vercel.app` |
| `STRIPE_SECRET_KEY` | Render | no¹ | `sk_test_…` |
| `STRIPE_PUBLISHABLE_KEY` | Render | no¹ | `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Render | no¹ | `whsec_…` |
| `OPENAI_API_KEY` | Render | no² | `sk-…` |
| `MAIL_HOST` / `MAIL_USERNAME` / `MAIL_PASSWORD` | Render | no³ | — |
| `BACKEND_URL` | Vercel | sí | `https://nexus-backend.onrender.com` (sin `/` final) |
| `NEXT_PUBLIC_DEMO` | Vercel | sí | `1` (aviso de despertar) |
| `NEXT_PUBLIC_SITE_URL` | Vercel | sí | `https://nexus-commerce.vercel.app` (base de `og:image`) |
| `NEXT_PUBLIC_API_DOCS_URL` | Vercel | no | `https://nexus-backend.onrender.com/swagger-ui.html` |

¹ Sin claves de Stripe el backend arranca en **modo sin pasarela**: el pedido con tarjeta se confirma sin cobro.
² Sin clave de OpenAI la búsqueda cae al modo de texto (`ILIKE`, Tarea 6.2).
³ Sin SMTP los emails van al log («MODO DESARROLLO»). Por eso el usuario demo nace verificado.

## 6. Operación

- **Cuentas demo**: `demo@nexus.dev` / `Demo1234!` (cliente) y `admin@nexus.dev` / `Admin1234!` (admin).
  Son públicas a propósito.
- **Modo demo**: un admin recibe `403 DEMO_MODE` al borrar productos, SKUs o cupones, al cambiar el rol de un usuario
  o suspenderlo, y en `forgot-password`/`reset-password`. Todo lo demás funciona.
- **Volver al estado de fábrica**:
  ```bash
  DATABASE_URL=… DATABASE_USERNAME=… DATABASE_PASSWORD=… ./scripts/reset-demo.sh
  ```
  Después reinicia el servicio en Render: Flyway reconstruye el catálogo y los datos de demo.
- **Capturas de la landing** contra la demo desplegada:
  ```bash
  cd frontend && SHOTS_BASE_URL=https://<proyecto>.vercel.app npm run shots -- --force
  ```
- **Probar la imagen en local** (con el PostgreSQL de `docker compose`):
  ```bash
  docker build -t nexus-backend backend/
  docker run --rm -p 8081:8080 -e SPRING_PROFILES_ACTIVE=prod,demo \
    -e DATABASE_URL=jdbc:postgresql://host.docker.internal:5432/<db> \
    -e DATABASE_USERNAME=… -e DATABASE_PASSWORD=… \
    -e JWT_SECRET=$(openssl rand -base64 48) -e APP_BASE_URL=http://localhost:3000 nexus-backend
  ```
