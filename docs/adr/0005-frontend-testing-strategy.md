# ADR-0005: Estrategia de Testing en Frontend con Vitest y React Testing Library

* **Estado:** Aprobado
* **Fecha:** 2026-09-29
* **Decisores:** Equipo Nexus Core

---

## 1. Contexto y Problema
Tras la implementación de la capa visual (PDP, Recibo, Catálogo), es crítico asegurar que las reglas de negocio en cliente (cálculo de stock ATS, deshabilitación de compras sin existencias y navegación de pedidos) no sufran regresiones.

Next.js con React 19 introduce particularidades en el manejo asíncrono de rutas que requieren un ejecutor de pruebas rápido y compatible con módulos ESM nativos.

---

## 2. Decisiones Tomadas

### 2.1 Elección de Vitest sobre Jest
* **Decisión:** Utilizar Vitest con `@vitejs/plugin-react` y emulación de DOM mediante `jsdom`.
* **Motivo:** Vitest comparte la resolución de módulos moderna, soporta TypeScript y JSX de forma nativa sin transformadores pesados (`ts-jest` o `babel`) y ofrece una velocidad de ejecución en memoria significativamente superior.

### 2.2 React Testing Library con Matchers Específicos
* **Decisión:** Utilizar `@testing-library/react` junto con `@testing-library/jest-dom/vitest`.
* **Motivo:** Enfoque en pruebas de comportamiento centradas en el usuario (accesibilidad, textos y roles) sin acoplarse a detalles de implementación interna de los componentes.

### 2.3 Patrón de Enrutamiento Síncrono (`useParams`)
* **Decisión:** Priorizar `useParams` sobre APIs de suspensión en componentes cliente (`"use client"`).
* **Motivo:** Evita bloqueos y advertencias de suspensión no controladas dentro de tests aislados, simplificando el mockeo de rutas dinámicas.

---

## 3. Consecuencias

### Positivas
* Cobertura automatizada obligatoria en frontend antes de cualquier merge a `main`.
* Tiempos de ejecución de tests por debajo de los 2 segundos.
* Facilidad de integración en el futuro pipeline de CI/CD.

### Compromisos Asumidos
* Las funciones que requieran simular navegación completa del navegador entre dominios se reservan para la suite E2E (Playwright) en la Fase 4.