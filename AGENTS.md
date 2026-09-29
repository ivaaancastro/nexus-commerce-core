# AGENTS.md — Nexus Commerce Core

> **Este archivo es la fuente de verdad para cualquier agente de IA o desarrollador que trabaje en el proyecto.**
> Contiene convenciones, patrones, reglas críticas y contexto arquitectónico. Léelo antes de escribir código.

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
│   │   └── service/            # Lógica de dominio transaccional
│   ├── src/main/resources/
│   │   └── db/migration/       # Flyway migrations (V1, V2, V3...)
│   └── src/test/java/          # Tests unitarios e integración
├── frontend/                   # Next.js + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/                # App Router (páginas)
│   │   ├── components/         # Componentes UI reutilizables
│   │   ├── lib/                # API client, utilidades
│   │   ├── types/              # Tipos TypeScript compartidos
│   │   └── __tests__/          # Tests de componentes
│   └── vitest.config.ts
├── docs/
│   └── adr/                    # Architecture Decision Records
├── docker-compose.yml          # PostgreSQL 16 + pgvector
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
| PostgreSQL | 16 | Base de datos relacional |
| pgvector | — | Búsqueda vectorial semántica |
| Flyway | — | Migraciones de esquema |
| Spring AI | 1.0.0-M6 | Enriquecimiento LLM (gpt-4o-mini) |
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

---

## 6. Convenciones de Frontend

### 6.1. Estructura de Páginas (App Router)
- Las páginas viven en `src/app/` con su archivo `page.tsx`.
- Usar `"use client"` solo cuando hay interactividad (hooks, eventos).
- Los parámetros dinámicos se leen con `useParams()` (síncrono).

### 6.2. API Client
- Toda la comunicación con el backend pasa por `src/lib/api.ts`.
- Usar `handleResponse<T>()` para manejo tipado de errores.
- La `Idempotency-Key` se genera en cliente con `crypto.randomUUID()`.

### 6.3. Tipos
- Los tipos de dominio viven en `src/types/commerce.ts`.
- Deben reflejar exactamente los DTOs del backend.
- Usar `interface` para objetos, `type` para uniones.

### 6.4. Estilos
- Tailwind CSS utility-first.
- Paleta editorial: `neutral-*` como base, acentos en `neutral-900`.
- Tipografía: `font-light`, `uppercase`, `tracking-widest` para estética editorial.

### 6.5. Componentes
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

### 8.2. Nombramiento de Ramas
```
feat/order-payment-integration
fix/stock-race-condition
docs/api-endpoint-documentation
refactor/pricing-service-extraction
test/order-checkout-e2e
```

### 8.3. Convención de Commits
Formato: `tipo(alcance): descripción en español`

```
feat(orders): implement persistent receipt page with fiscal breakdown
fix(inventory): prevent race condition in stock reservation
docs(adr): add ADR-0005 for frontend testing strategy
test(frontend): add OrderDetailPage component tests
refactor(pricing): extract tax calculation to dedicated service
```

Tipos válidos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

### 8.4. Cierre de Rama
Antes de considerar una rama lista para merge:
1. Tests pasando (`./mvnw test` en backend, `npx vitest` en frontend).
2. Cobertura mantenida o incrementada.
3. Documentación actualizada (CHANGELOG.md, ADRs si aplica).
4. Código revisado y limpio (sin TODOs, sin código muerto).

---

## 9. Documentación Obligatoria

### 9.1. Archivos de Documentación
| Archivo | Propósito |
|:---|:---|
| `README.md` | Visión general, setup, API pública |
| `CHANGELOG.md` | Registro de cambios (Keep a Changelog es-ES) |
| `docs/adr/*.md` | Decisiones arquitectónicas |
| `AGENTS.md` | Contexto para agentes IA y desarrolladores |

### 9.2. ADRs (Architecture Decision Records)
- Toda decisión arquitectónica significativa **DEBE** documentarse como ADR.
- Formato: Contexto → Decisión → Alternativas → Consecuencias.
- Se numeran secuencialmente: `0001-`, `0002-`, etc.
- Se registran en `docs/adr/README.md`.

### 9.3. OpenAPI
- La documentación de la API se genera automáticamente con springdoc-openapi.
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Especificación: `http://localhost:8080/v3/api-docs`
- Los controllers deben tener anotaciones `@Tag` y `@Operation`.

---

## 10. Comandos de Desarrollo

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

---

## Resumen de Verificación Antes de Cerrar una Rama

- [ ] Tests pasando (backend y frontend)
- [ ] Cobertura >= 90% (backend)
- [ ] Sin errores de compilación ni warnings críticos
- [ ] CHANGELOG.md actualizado
- [ ] ADR creado si hay decisión arquitectónica
- [ ] Código sin TODOs ni comentarios de depuración
- [ ] Commits con formato convencional
- [ ] Rama actualizada con main (rebase o merge)

---

*Última actualización: 2026-09-29*
