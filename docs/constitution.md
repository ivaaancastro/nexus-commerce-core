# Constitution — Nexus Commerce Core

> **Documento fundacional del proyecto.** Define la visión, principios, arquitectura y reglas de negocio.
> Este archivo es la referencia principal para entender el "por qué" del proyecto.

---

## 1. Visión y Misión

**Nexus Commerce Core** es un backend transaccional de alto rendimiento para retail global, con un frontend editorial en Next.js.

### Misión
Proporcionar una plataforma de comercio electrónico de escala masiva con:
- Transacciones financieras precisas (BigDecimal, tolerancia cero a errores de coma flotante)
- Inventario omnicanal con control de concurrencia
- Experiencia de usuario editorial de alta gama (estilo Zara)
- Búsqueda semántica inteligente (pgvector + Spring AI)

---

## 2. Principios de Diseño

### 2.1. Separación de Responsabilidades
- **Controllers**: Solo reciben peticiones, validan y delegan
- **Services**: Lógica de dominio transaccional
- **Repositories**: Persistencia con Spring Data JPA
- **DTOs**: Records inmutables para comunicación HTTP

### 2.2. Inmutabilidad
- Las entidades JPA **NUNCA** se exponen al exterior
- Toda comunicación HTTP se realiza mediante Java `record` inmutables
- Los DTOs usan validación con `jakarta.validation`

### 2.3. Precisión Financiera
- **PROHIBIDO** usar `double` o `float` para cálculos monetarios
- **SIEMPRE** usar `BigDecimal` con `RoundingMode.HALF_UP` y escala de 2

### 2.4. Concurrencia
- Bloqueo pesimista (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) en operaciones de reserva
- Nunca permitir *over-selling*

### 2.5. Idempotencia
- Toda petición de checkout **DEBE** incluir `Idempotency-Key` (UUID)
- Si la clave ya existe, devolver la orden existente

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
| Spring Security | — | Autenticación y autorización |
| JWT (jjwt) | 0.12.6 | Tokens de sesión |
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

## 4. Arquitectura

### 4.1. Backend — Capas
```
Controller → Service → Repository → DB
     ↓           ↓
   DTOs      Spring AI (enriquecimiento)
```

### 4.2. Frontend — Estructura
```
app/           → Páginas (App Router)
components/    → Componentes UI reutilizables
context/       → Estado global (Cart, Auth, Drawer)
lib/           → API client, utilidades
types/         → Tipos TypeScript
```

### 4.3. Flujo de Autenticación
```
Registro → Email verificación (código 6 dígitos) → Login → JWT Token
```

---

## 5. Reglas de Negocio

### 5.1. Catálogo
- Productos con variantes físicas (SKU) organizados por familia textil
- Búsqueda exacta por referencia + búsqueda semántica vectorial

### 5.2. Precios
- Tarificación multidivisa por mercado (ES, US, UK...)
- Desglose impositivo (base neta + IVA)

### 5.3. Inventario
- Visión omnicanal con múltiples almacenes
- Cálculo ATS (*Available to Sell*)
- Selección automática de almacén óptimo por distancia (Haversine)

### 5.4. Pedidos
- Checkout transaccional con snapshots financieros inmutables
- Idempotencia garantizada por `Idempotency-Key`

### 5.5. Usuarios
- Registro con email + contraseña + datos personales
- Verificación de email obligatoria
- Perfil con medidas (altura, peso) para recomendación de tallas
- Máximo 2 direcciones de entrega (una principal)

---

## 6. Convenciones

### 6.1. Commits
Formato: `tipo(alcance): descripción en español`
Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

### 6.2. Ramas
- `feat/nueva-funcionalidad`
- `fix/descripcion-bug`
- `docs/descripcion-cambios`

### 6.3. Tests
- Backend: JUnit 5 + Mockito + AssertJ, >90% cobertura
- Frontend: Vitest + React Testing Library

### 6.4. Estilo UI
- Estilo editorial Zara: `neutral-*`, `uppercase`, `tracking-widest`
- Tipografía: `font-light` (300) para textos, `font-medium` (500) para títulos

---

## 6. Workflow: Spec-Driven Development

Este proyecto sigue **SDD** (Spec-Driven Development). La spec es la fuente de verdad; el código la implementa.

### 6.1. Principio rector

> **Ninguna línea de código se escribe sin una spec aprobada.**

El orden importa: primero se entiende y se documenta **qué** se va a construir y **por qué**; después se construye.

### 6.2. Ciclo de vida de una feature

```
PLAN ──────► SPEC ──────► ⛔ APROBACIÓN ──────► TASKS
objetivos    requisitos    del usuario          checklist
decisiones   API           (punto de bloqueo)
                                 │
                                 ▼
                               CODE
                        implementación
                                 │
                                 ▼
                          /spec-check
                        código vs spec
                                 │
                                 ▼
                          /spec-close
                       tests + docs + PR
```

### 6.3. Artefactos y su propósito

| Artefacto | Responde a | Momento |
|:---|:---|:---|
| `plan.md` | ¿Por qué y cómo lo haremos? | Inicio |
| `spec.md` | ¿Qué debe hacer exactamente? | Antes de codificar |
| `tasks.md` | ¿Qué pasos concretos quedan? | Antes de codificar |
| `ADR` | ¿Por qué esta decisión técnica? | Cuando hay decisión arquitectónica |

### 6.4. Reglas inviolables

| # | Regla |
|:--|:---|
| 1 | No se escribe código sin `spec.md` aprobado explícitamente por el usuario |
| 2 | La aprobación es un punto de bloqueo real, no un formality |
| 3 | Si el alcance cambia durante la implementación, se actualiza `spec.md` primero |
| 4 | Cada tarea completada se marca en `tasks.md` en el momento |
| 5 | Ningún merge sin `/spec-check` en verde y tests pasando |
| 6 | Toda decisión que altere arquitectura o stack requiere un ADR |
| 7 | Esta constitution solo se modifica junto con un ADR |

### 6.5. Criterios de "feature terminado"

Una feature está completa cuando:

- [ ] Todos los requisitos de `spec.md` están implementados
- [ ] `/spec-check` no reporta requisitos pendientes
- [ ] Tests pasan (backend >90% cobertura, frontend verde)
- [ ] `tasks.md` tiene todas las tareas marcadas
- [ ] `CHANGELOG.md` actualizado
- [ ] ADR creado si hubo decisión arquitectónica
- [ ] PR creado y revisado

### 6.6. Trazabilidad

Cada cambio en el código debe poder rastrearse hasta un requisito de una spec. Si no está en ninguna spec, no debería existir.

---

## 7. Estructura del Proyecto

```
nexus-commerce-core/
├── AGENTS.md              → Convenciones para agentes IA
├── MEMORY.md              → Estado actual del proyecto
├── docs/
│   ├── constitution.md    → Este archivo
│   └── adr/               → Architecture Decision Records
├── specs/                 → Planes y especificaciones por feat
├── backend/               → Spring Boot + Java 21
├── frontend/              → Next.js + TypeScript
├── docker-compose.yml     → PostgreSQL 16 + pgvector
└── CHANGELOG.md           → Registro de cambios
```

---

## 8. Referencias

- [AGENTS.md](../AGENTS.md) — Convenciones completas para agentes IA
- [MEMORY.md](../MEMORY.md) — Estado actual del proyecto
- [docs/adr/](adr/) — Decisiones arquitectónicas
- [specs/](../specs/) — Planes y especificaciones

---

*Última actualización: 2026-10-01*
