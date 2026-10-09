# Architecture Decision Records (ADRs)

Este directorio documenta formalmente las decisiones arquitectónicas del núcleo transaccional Nexus Commerce. Cada registro describe el contexto de una decisión, las alternativas analizadas y sus consecuencias en el sistema.

## Registro de Decisiones

| ID | Fecha | Título | Estado |
| :---: | :---: | :--- | :---: |
| [ADR-0001](0001-core-architecture-and-concurrency.md) | 2026-09-25 | Definición de Stack Base, Concurrencia de Inventario y Precisión Financiera | **Aprobado** |
| [ADR-0002](0002-hybrid-semantic-search-pgvector.md) | 2026-09-27 | Búsqueda Semántica Híbrida con PostgreSQL y pgvector | **Aprobado** |
| [ADR-0003](0003-transactional-order-checkout-and-idempotency.md) | 2026-09-28 | Motor Transaccional de Pedidos, Snapshot Fiscal e Idempotencia | **Aprobado** |
| [ADR-0004](0004-frontend-architecture-and-proxy.md) | 2026-09-29 | Arquitectura Frontend Monorepo, Rewrite Proxy e Idempotencia en Cliente | **Aprobado** |
| [ADR-0005](0005-frontend-testing-strategy.md) | 2026-09-29 | Estrategia de Testing en Frontend con Vitest y React Testing Library | **Aprobado** |
| [ADR-0006](0006-role-based-access-control.md) | 2026-10-09 | Control de Acceso Basado en Roles (RBAC) con `ADMIN`/`USER` | **Aprobado** |