# ADR-0004: Arquitectura Frontend Monorepo, Rewrite Proxy e Idempotencia en Cliente

* **Estado:** Aprobado
* **Fecha:** 2026-09-29
* **Decisores:** Equipo Nexus Core

---

## 1. Contexto y Problema

Integrar una interfaz moderna con un backend transaccional de Spring Boot plantea tres retos:
1. **Problemas de CORS y acoplamiento de dominios:** Las peticiones entre `localhost:3000` y `localhost:8080` exigen cabeceras complejas de preflight (`OPTIONS`) en desarrollo.
2. **Generación de claves de idempotencia:** El cliente web debe originar identificadores únicos por intención de compra para proteger la integridad del checkout ante caídas de red o doble clic.
3. **Consistencia tipada:** Discrepancias entre las entidades de dominio en Java y los modelos consumidos por la vista pueden introducir bugs silenciosos en producción.

---

## 2. Decisiones Tomadas

### 2.1 Monorepo con Next.js (App Router) y TypeScript
* **Decisión:** Alojar la capa web en `frontend/` dentro del mismo repositorio, tipando estrictamente cada DTO en interfaces inmutables equivalentes a los Records de Java.
* **Motivo:** Facilita el versionado atómico de contratos de API y asegura que cualquier cambio en las firmas de backend se refleje de inmediato en el tipado estático del frontend.

### 2.2 Reescritura de Rutas como Proxy Inverso (`rewrites`)
* **Decisión:** Enrutar el tráfico `/api/v1/:path*` hacia `http://localhost:8080` directamente desde `next.config.ts`.
* **Motivo:** Elimina la necesidad de habilitar CORS permisivos en Spring Boot durante el desarrollo y simula la topología de un reverse-proxy de producción (Nginx o Cloudflare API Gateway).

### 2.3 Generación Criptográfica de `Idempotency-Key`
* **Decisión:** Emplear `crypto.randomUUID()` en el navegador inmediatamente antes de disparar la petición de checkout.
* **Motivo:** Garantiza unicidad matemática (RFC 4122) y traslada la responsabilidad de la intención transaccional al cliente HTTP.

---

## 3. Consecuencias

### Positivas
* Desacoplamiento total de dominios y ausencia de errores de CORS.
* Flujo de compra tolerante a fallos de red y reintentos automáticos.
* Experiencia visual editorial con renderizado optimizado y tipado estricto.

### Compromisos Asumidos
* Las reescrituras de Next.js añaden un salto de proxy local en desarrollo; en entornos productivos distribuidos se delegará a un Ingress Controller o Gateway dedicado.