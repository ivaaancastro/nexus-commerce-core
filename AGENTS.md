# AGENTS.md — Nexus Commerce Core

> **Este archivo se carga automáticamente en cada sesión y se refresca si lo editas.**
> Contiene las convenciones, reglas críticas y el estado actual del proyecto.

---

## ⚡ ESTADO ACTUAL (leer primero)

| Campo | Valor |
|:---|:---|
| **Rama activa** | `feat/product-returns` |
| **Fase** | 5 — Gestión de Usuarios |
| **Tarea** | 5.4 — Devoluciones (implementada y documentada, pendiente commit + PR) |
| **Tarea siguiente** | Por definir — la 5.4 es la última spec escrita |
| **Pendiente** | Commit + PR de `feat/product-returns` |
| **Actualizado** | 2026-10-05 |

> **Estado de pruebas**: 134 backend · 100 frontend · CI verde en `main`.
> **Mergeado**: Tarea 5.3 (PR #12, `cd9ca74`) y fix de checkout (PR #13, `8704dff`).
> **Decisión del fix**: *el checkout requiere sesión* — sin `permitAll` en `/api/v1/orders/checkout`.

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

### 7.3. Reglas de Testing
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
