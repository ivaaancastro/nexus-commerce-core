# Changelog

Todos los cambios notables en este proyecto se documentarán en este archivo.
El formato sigue las directrices de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- Página de recibo y comprobante de compra `/orders/[orderNumber]` con desglose fiscal y auditoría de `Idempotency-Key`.
- Método `getOrder` en la capa de API de TypeScript (`frontend/src/lib/api.ts`).
- Suite de pruebas unitarias y de componentes para frontend con **Vitest**, **React Testing Library** y **jsdom**.
- Componentes **Skeleton** con animación de pulso sutil para el grid del catálogo (`ProductCardSkeleton`) y la ficha de producto (`ProductDetailSkeleton`), evitando layout shifts (CLS).
- **ErrorBoundary** con fallback editorial elegante y botón de reintento para capturar errores de renderizado sin mostrar pantallas en blanco.
- Utility `cn()` para combinación inteligente de clases Tailwind (clsx + tailwind-merge).

### Changed
- Migración de la lectura de parámetros dinámicos en PDP y Recibo hacia el hook síncrono `useParams` de Next.js.
- Redirección automática desde la PDP hacia la URL persistente del pedido tras el checkout exitoso.

### Fixed
- Limpieza reactiva de estado en `ProductDetailPage` al cambiar de talla para evitar el arrastre de inventario de otros SKUs.
- Tratamiento editorial y silencioso del estado "Agotado" sin exponer errores técnicos JSON 400 al usuario.