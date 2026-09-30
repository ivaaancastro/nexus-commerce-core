# MEMORY.md — Nexus Commerce Core

> **Archivo de memoria persistente para agentes IA y desarrolladores.**
> Este archivo consolida todo el contexto del proyecto para mantener continuidad entre sesiones.
> Se actualiza al completar tareas o cuando hay cambios importantes.

---

## Estado Actual

| Aspecto | Valor |
|:---|:---|
| **Rama actual** | `feat/user-auth` |
| **Fase actual** | Fase 5 — Gestión de Usuarios y Autenticación |
| **Tarea actual** | Tarea 5.1 — Registro y Login de Usuarios |
| **Estado** | EN CURSO |
| **Última actualización** | 2026-09-30 |

---

## Resumen del Proyecto

**Nexus Commerce Core** es un backend transaccional de alto rendimiento para retail global, con frontend editorial en Next.js.

### Stack
- **Backend**: Spring Boot 3.4 + Java 21 + PostgreSQL 16 + pgvector
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Auth**: Spring Security + JWT + BCrypt
- **Email**: Mailtrap (desarrollo) / SendGrid (producción)

---

## Tareas Completadas

### Fase 1 — Resiliencia UI
- [x] Tarea 1.2 — Skeletons de Carga y Error Boundaries

### Fase 2 — Carrito de Compra
- [x] Tarea 2.1 — Estado Global de la Bolsa (CartContext)
- [x] Tarea 2.2 — Cajón Lateral de la Bolsa (Cart Drawer)
- [x] Tarea 2.3 — Checkout Multilínea con selección automática de almacén

### Fase 5 — Gestión de Usuarios (EN CURSO)
- [ ] Tarea 5.1 — Registro y Login (EN CURSO)
  - [x] Backend: Entidades, repositorios, seguridad JWT, AuthService, AuthController
  - [x] Frontend: AuthContext, páginas login/register/verify-email/forgot-password
  - [x] Tests: 38 backend + 27 frontend
  - [x] Email: Mailtrap configurado
  - [ ] Pendiente: Verificar flujo completo de registro → verificación → login

---

## Tareas Pendientes

### Fase 5 — Gestión de Usuarios
- [ ] Tarea 5.2 — Perfil de Usuario y Direcciones
- [ ] Tarea 5.3 — Historial de Pedidos

### Fase 3 — Experiencia Editorial
- [ ] Tarea 3.1 — Navegación por Familias y Filtros
- [ ] Tarea 3.2 — Selector Dinámico de Mercado y Divisa
- [ ] Tarea 3.3 — Galería de Imágenes Responsive

### Fase 4 — Calidad Enterprise
- [ ] Tarea 4.1 — Suite de Pruebas Unitarias de Componentes
- [ ] Tarea 4.2 — Test E2E con Playwright
- [ ] Tarea 4.3 — Auditoría Core Web Vitals y Accesibilidad

---

## Decisiones Importantes

| Decisión | Detalle |
|:---|:---|
| **Flujo de trabajo** | GitHub Flow con Pull Requests |
| **Commits/Pushes** | Preguntar siempre antes |
| **Ramas** | Una por tarea, merge a rama padre |
| **Estilo UI** | Estilo editorial Zara (neutral-*, uppercase, tracking-widest) |
| **Auth** | JWT + BCrypt, roles: solo USER por ahora |
| **Email** | Mailtrap (desarrollo), SendGrid (producción) |
| **Validación** | Frontend: simple y robusta; Backend: completa |

---

## Convenciones del Proyecto

### Commits
Formato: `tipo(alcance): descripción en español`
Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

### Ramas
- `feat/nueva-funcionalidad`
- `fix/descripcion-bug`
- `docs/descripcion-cambios`

### Tests
- Backend: JUnit 5 + Mockito + AssertJ, >90% cobertura
- Frontend: Vitest + React Testing Library

---

## Archivos de Referencia

| Archivo | Contenido |
|:---|:---|
| `AGENTS.md` | Convenciones completas para agentes IA |
| `docs/memory/roadmap.md` | Roadmap detallado de todas las fases |
| `docs/plans/user-management-plan.md` | Plan de implementación de usuarios |
| `docs/adr/` | Architecture Decision Records |
| `CHANGELOG.md` | Registro de cambios |

---

## Notas de Contexto

- **Usuario**: Iván Castro
- **Proyecto**: Nexus Commerce Core
- **Inicio**: 2026-09-25
- **Convenciones**: Ver `AGENTS.md` en la raíz del proyecto

---

*Última actualización: 2026-09-30 por agente IA*
