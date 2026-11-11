# ADR-0008: Despliegue en Vercel + Render + Neon, proxy por rewrite y modo demo

* **Estado:** Aprobado
* **Fecha:** 2026-11-11
* **Decisores:** Equipo Nexus Core
* **Spec:** `specs/fase10/` (plan D1–D14, spec R1–R15, ajustes A1–A3)

---

## 1. Contexto y Problema

Hasta la Fase 9 el proyecto solo existía en `localhost`. Como portfolio, tiene que poder abrirse con un clic, sin instalar nada, y aguantar que **cualquiera** entre al panel de administración con credenciales públicas. Las restricciones:

1. **Coste cero**, y sin tarjeta siempre que se pueda.
2. **PostgreSQL con pgvector** (ADR-0002): descarta los Postgres gestionados sin la extensión.
3. **Spring Boot + Spring AI** en un contenedor de 512 MB.
4. **No abrir CORS** ni cookies cross-site: ADR-0004 eligió un proxy por rewrite de Next.js.
5. Un secreto JWT **versionado en el repositorio** (valor por defecto de desarrollo) que en producción permitiría forjar tokens de `ADMIN`.

---

## 2. Decisiones Tomadas

### 2.1 Topología: Vercel (frontend) · Render (backend en Docker) · Neon (PostgreSQL)
* **Decisión:** el frontend en Vercel Hobby; el backend como imagen Docker multi-etapa (`backend/Dockerfile`, JRE 21, usuario sin privilegios) en un *web service* gratuito de Render (`render.yaml`); la base de datos en Neon Free, que trae pgvector.
* **Razón:** los tres planes son gratuitos. Neon no caduca, a diferencia del Postgres gratuito de Render, que caduca a los 30 días. La imagen Docker es portable: si Render no basta, el plan B (Fly.io, Koyeb) **no cambia el código**.
* **Coste aceptado:** el backend duerme tras 15 minutos sin tráfico y tarda alrededor de un minuto en despertar. Se avisa en voz alta (§2.5), no se esconde.

### 2.2 El proxy sigue siendo un rewrite, ahora parametrizado
* **Decisión:** `next.config.ts` reescribe `/api/v1/*` a `${BACKEND_URL}/api/v1/*`, con `http://localhost:8080` por defecto.
* **Razón:** se mantiene ADR-0004. El navegador solo habla con el origen de Vercel, así que no hay CORS ni cookies cross-site. Dev, CI y E2E no cambian.

### 2.3 Perfil `prod` con guardas de arranque
* **Decisión:** `application-prod.properties` toma el datasource y el `JWT_SECRET` de variables **sin valor por defecto**, silencia el SQL y fija `server.port=${PORT}`. `JwtSecretGuard` (solo con el perfil `prod`) **aborta el arranque** si el secreto es el del repositorio o tiene menos de 32 bytes.
* **Razón:** es el mismo patrón que la guarda de `sk_live_` (ADR-0007): un olvido de configuración se convierte en un fallo en voz alta, nunca en un agujero silencioso.

### 2.4 Modo demo: el panel abierto, salvo lo que destruye
* **Decisión:** `app.demo.enabled` (perfil `demo`) registra `DemoModeFilter`, que responde `403` con `code: DEMO_MODE` a: borrar productos, SKUs y cupones; cambiar el rol de usuarios o suspenderlos; y `forgot-password`/`reset-password`. Todo lo demás funciona: estados de pedido, stock, precios, reembolsos, y crear y editar productos y cupones. Sin el flag, el bean no existe.
* **Razón:** un panel de solo lectura no enseña nada, y reembolsar o cambiar estados es justo lo que la demo quiere mostrar. Lo bloqueado es lo que permitiría vandalizar la demo o dejar a otros visitantes sin acceso. El filtro corre **después** de Spring Security: la seguridad no se debilita, y solo un admin autenticado llega a ver `DEMO_MODE`.
* **Datos:** `db/demo/R__demo_data.sql` es una migración **repetible**. Una `V1000` habría hecho que la siguiente `V24` quedase «ignorada» y la validación de Flyway abortase el arranque. Añade un usuario demo verificado (no hay SMTP real) y pedidos de ejemplo. `scripts/reset-demo.sh` devuelve la demo a su estado de fábrica vaciando el esquema; Flyway la reconstruye al reiniciar.
* **Señal al frontend:** `GET /api/v1/payments/config` expone `demoMode`. Es la configuración pública que ya existía, porque `/health` es solo ADMIN desde la Fase 8.

### 2.5 Arranque en frío visible
* **Decisión:** con `NEXT_PUBLIC_DEMO=1`, si la primera petición tarda más de 4 s, el frontend muestra «Despertando la demo…». No puede depender del `demoMode` del backend, porque es precisamente el backend lo que está dormido.

### 2.6 Despliegue sin CD propio
* **Decisión:** cada proveedor despliega desde su integración con Git. El despliegue desde GitHub Actions queda para la Fase 11.

---

## 3. Alternativas Consideradas

| Alternativa | Por qué no |
|:---|:---|
| Postgres gratuito de Render | Caduca a los 30 días |
| Fly.io | Exige tarjeta; queda como plan B |
| `NEXT_PUBLIC_API_URL` + CORS en Spring | Superficie de seguridad nueva (orígenes, preflight, cookies) sin ningún beneficio frente al rewrite |
| Panel admin de solo lectura en la demo | No enseña lo que el proyecto sabe hacer |
| Datos de demo en `db/migration/` | Las migraciones de producción no deben llevar datos de demostración |

---

## 4. Consecuencias

* ✅ Cualquiera puede abrir la tienda, comprar con Stripe en modo de pruebas y entrar al panel sin instalar nada.
* ✅ Sin perfiles activos, el comportamiento es idéntico al de antes: los tests y la CI no cambian.
* ✅ Un secreto JWT por defecto o una clave `sk_live_` no pueden llegar a producción.
* ⚠️ Primera visita lenta tras inactividad (alrededor de un minuto), avisada en la interfaz y en el README.
* ⚠️ El *access token* de 24 h sigue siendo *stateless*: suspender o cambiar el rol no aplica hasta que expira (limitación conocida desde la 7.5, irrelevante con el modo demo, que bloquea esas acciones).
* ⚠️ Los datos de la demo pueden ensuciarse entre resets; son de prueba y no hay datos personales reales.
