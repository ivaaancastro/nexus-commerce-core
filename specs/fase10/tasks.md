# Fase 10 — tasks (PR A: código y configuración)

> Spec aprobada con ajustes A1–A3 (2026-11-11). Se marca cada tarea al completarla (regla 4).

## A. Backend
- [x] A.1 `application-prod.properties` (R2): SQL silenciado, datasource y `JWT_SECRET` por entorno, `server.port=${PORT}`
- [x] A.2 `JwtSecretGuard` (R3): en perfil `prod`, aborta con secreto por defecto o < 32 bytes + test — **es un `FlywayConfigurationCustomizer`** para fallar **antes** de migrar (medido: como `@Component` suelto, Flyway ya había migrado una base vacía al abortar; corregido → 0 tablas)
- [x] A.3 `Dockerfile` multi-etapa + `.dockerignore` (R4), healthcheck contra `/api/v1/markets`
- [x] A.4 `DemoProperties` + `DemoModeFilter` (R5, A2): `403 DEMO_MODE`; sin el flag el filtro no se registra + tests
- [x] A.5 `PaymentConfigResponse` + `demoMode` (R6, A3) + test
- [x] A.6 `application-demo.properties` + `db/demo/R__demo_data.sql` (R7, A1): usuario demo verificado, dirección y ≥ 6 pedidos
- [x] A.7 Suite backend en verde: **527 → 553** (+3 guarda · +18 filtro · +5 integración demo; `SecurityRulesTest` gana la aserción `demoMode=false`, R8.3)

## B. Frontend
- [x] B.1 `next.config.ts`: `BACKEND_URL` (R1) y `localPatterns` + `/landing/**`
- [x] B.2 `DemoBanner` (lee `demoMode` de `/payments/config`) + tests
- [x] B.3 Estado de despertar (R12, `NEXT_PUBLIC_DEMO=1`, > 4 s) + tests — **consume el cuerpo de la respuesta** (medido: sin leerlo, `networkidle` no llegaba nunca en el build de demo)
- [x] B.4 Landing `/proyecto` (R9, R10, R14) con capturas con respaldo neutro + tests
- [x] B.5 `npm run shots` (R11) — no pisa sin `--force`; primeras capturas generadas en local
- [x] B.6 axe 17 → 18 rutas (RNF3) + humo E2E de `/proyecto` (RNF6) — **E2E rápido 33/33** (+4 de pago saltados sin `E2E_STRIPE`) · Lighthouse 4 → 5 rutas
- [x] B.7 `tsc` 0 · ESLint 0/0 · build 0 · **590 → 605** tests · cobertura **83,88/78,87/81,48/85,9** EXIT 0 (una corrida tuvo 1 fallo intermitente no reproducido en 2 corridas más)

## C. Raíz y docs
- [x] C.1 `scripts/reset-demo.sh` (R8) con confirmación
- [x] C.2 `render.yaml` (blueprint)
- [x] C.3 `docs/deployment.md` (R13, R15): Neon → Render → Vercel → Stripe (webhook + Apple Pay), tabla de variables
- [x] C.4 ADR-0008 + índice `docs/adr/README.md`
- [x] C.5 CHANGELOG + bloque ESTADO de AGENTS.md (verdad tras el merge)

## D. Verificación
- [x] D.1 Imagen (208 MB) arrancada en local con `prod,demo` contra una base **vacía**: Flyway V1–V23 + `R__`, arranque ~8 s, `HEALTHCHECK` *healthy*. **Memoria con `--memory=512m`**: con `-Xmx300m` ~454 MiB y **OOM** con NMT activo; NMT → heap comprometida 259 MB como mayor partida ⇒ **`-Xmx200m` + `MALLOC_ARENA_MAX=2` → ~382 MiB bajo carga**, sin `OutOfMemoryError` y latencia en ms
- [x] D.2 `prod` con secreto por defecto no arranca (medido)
- [x] D.3 Modo demo medido contra la imagen: 403 `DEMO_MODE` en las 5 acciones (2 DELETE de producto/SKU, cupón, rol, suspensión) y en `forgot-password`; 200 en dashboard, pedidos, usuarios, tracking y cambio de estado; sin token sigue 401; login de `demo@nexus.dev` OK con sus 7 pedidos; banner visible en la tienda y oculto en `/proyecto`
- [x] D.4 `/proyecto` en navegador: 0 errores de consola, **CLS 0**, 6 capturas cargadas, `og:image` absoluta, sin desborde en 375 px
- [ ] D.5 Despliegue real (acciones del usuario) — fuera de este PR, guiado con `docs/deployment.md`
