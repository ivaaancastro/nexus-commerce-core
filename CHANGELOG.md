# Changelog

Todos los cambios notables en este proyecto se documentarán en este archivo.
El formato sigue las directrices de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- **Perfil de usuario** `/profile` con edición de datos personales, validación en cliente y confirmación de guardado. El email se muestra en solo lectura.
- **Gestión de direcciones** `/addresses` con alta, edición, borrado con confirmación en línea, badge "Principal" y límite de 2 direcciones.
- **Protección de rutas** mediante el componente `ProtectedRoute`, que redirige a `/login` y muestra un estado de carga mientras se resuelve el token.
- **Recomendación de talla** según las medidas del perfil: `POST /api/v1/users/me/size-recommendation`, con servicio `SizeRecommendationService` y confianza Alta/Media/Baja.
- Endpoints de perfil y direcciones: `GET/PUT /api/v1/users/me` y CRUD en `/api/v1/users/me/addresses`.
- DTOs `ProfileUpdateRequest`, `AddressRequest`, `AddressResponse`, `SizeRecommendationRequest` y `SizeRecommendationResponse`.
- Excepción `ResourceNotFoundException` con manejo centralizado a `404` en `GlobalExceptionHandler`.
- Método `refreshUser()` en `AuthContext` para refrescar el usuario global tras editar el perfil.
- Métodos `getProfile`, `updateProfile`, `getAddresses`, `createAddress`, `updateAddress`, `deleteAddress` y `recommendSize` en `frontend/src/lib/api.ts`.
- **27 tests nuevos**: 44 backend → **84**, 27 frontend → **44**. Cobertura de las clases de la feature entre 88,6 % y 100 %.
- Página de recibo y comprobante de compra `/orders/[orderNumber]` con desglose fiscal y auditoría de `Idempotency-Key`.
- Método `getOrder` en la capa de API de TypeScript (`frontend/src/lib/api.ts`).
- Suite de pruebas unitarias y de componentes para frontend con **Vitest**, **React Testing Library** y **jsdom**.
- Componentes **Skeleton** con animación de pulso sutil para el grid del catálogo (`ProductCardSkeleton`) y la ficha de producto (`ProductDetailSkeleton`), evitando layout shifts (CLS).
- **ErrorBoundary** con fallback editorial elegante y botón de reintento para capturar errores de renderizado sin mostrar pantallas en blanco.
- Utility `cn()` para combinación inteligente de clases Tailwind (clsx + tailwind-merge).
- **Carrito de compra** con estado global (`CartContext`), persistencia en `localStorage`, icono con badge en header y botón "Añadir a la bolsa" (modelo Zara).
- Confirmación visual temporal (toast) al añadir items al carrito.
- **Drawer lateral del carrito** con animación suave, controles de cantidad y acceso a página completa (`/cart`).
- **Checkout multilínea** con selección automática de almacén óptimo por distancia geográfica (Haversine).
- **Página de confirmación de pedido** estilo Zara con resumen y acceso al recibo.
- **Página de recibo** `/receipt/[orderNumber]` con descarga PDF funcional.

### Changed
- Migración de la lectura de parámetros dinámicos en PDP y Recibo hacia el hook síncrono `useParams` de Next.js.
- Redirección automática desde la PDP hacia la URL persistente del pedido tras el checkout exitoso.
- Los formularios de perfil y direcciones usan `noValidate` para que la validación custom (mensajes amigables en español) sea quien controla el envío, conservando `required`/`min`/`max` como pistas de accesibilidad.
- `refresh()` en la página de direcciones recarga mediante clave de estado en lugar de una llamada directa dentro del efecto, cumpliendo `react-hooks/set-state-in-effect`.

### Fixed
- Limpieza reactiva de estado en `ProductDetailPage` al cambiar de talla para evitar el arrastre de inventario de otros SKUs.
- Tratamiento editorial y silencioso del estado "Agotado" sin exponer errores técnicos JSON 400 al usuario.
- Label del campo email en `/profile` sin asociación `htmlFor`/`id`, inaccesible para lectores de pantalla.
- 238 ficheros duplicados con sufijo `" 2"` generados por la resolución de conflictos de git (incluidas migraciones Flyway duplicadas que impedían arrancar el backend).