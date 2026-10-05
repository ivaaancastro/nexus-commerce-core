# Changelog

Todos los cambios notables en este proyecto se documentarán en este archivo.
El formato sigue las directrices de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- **23 tests nuevos de frontend** para el fix de checkout: `Errors.test.ts` (12), `ApiAuthHeaders.test.ts` (7) y `CartPage.test.tsx` (4). 54 frontend → **77** en 12 archivos. `frontend/src/lib/errors.ts` no tenía ni un solo test.
- Propiedad `app.base-url` (default `http://localhost:3000`) para construir los enlaces absolutos que viajan dentro de los emails transaccionales.
- Helper `isUnverifiedEmailError()` en `frontend/src/lib/errors.ts` para detectar el error de cuenta sin verificar y ofrecerle salida.
- **16 tests nuevos**: 84 backend → **90**, 44 frontend → **54**. `EmailService` con cobertura del **100 %** de líneas y ramas.
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
- **Código muerto en la ficha de producto**: `ProductDetailPage` declaraba `handleCheckout` y `checkoutLoading` que ningún botón ejecutaba —la PDP nunca tuvo «Comprar ahora», solo «Añadir a la bolsa»— junto con imports y tipos residuales (`use`, `Order`, `PageProps`, `useRouter`, `useAuth`). Se eliminan; 5 warnings de ESLint de ese fichero pasan a 0 y el componente pierde 55 líneas que no podían ejecutarse.
- **El checkout siempre devolvía `401` con la sesión iniciada**: `api.checkout()` y `api.getOrder()` montaban sus cabeceras a mano sin incluir `getAuthHeaders()`, y como `/api/v1/orders/**` es `authenticated()` en `SecurityConfig`, el backend rechazaba la petición. El fallo era **anterior a la Tarea 5.3** (se reproducía igual en `main`, donde respondía `403`); la Tarea 5.3 solo cambió el código al correcto `401`. Ahora ambas llamadas envían `Authorization`, y el recibo y la confirmación de pedido vuelven a ser consultables.
- **Guard de sesión antes de comprar**: pulsar «Tramitar pedido» sin sesión no emite ninguna petición al backend; muestra *«Inicia sesión para completar tu compra»* con enlace a `/login` en el carrito y en la ficha de producto.
- **9 páginas pintaban el error técnico en crudo** (`err.message` → `API Error [401]: {…}` con timestamps y campos internos), incumpliendo la regla #9 de `AGENTS.md`: home (catálogo y búsqueda semántica), carrito, ficha de producto (carga y checkout), `forgot-password` (2), recibo y confirmación de pedido. Todas pasan ya por `getFriendlyErrorMessage()`.
- `getFriendlyErrorMessage()` no cubría los códigos HTTP del proyecto (AGENTS.md §4.5): añadidos `401`, `403`, `404` y `409`. El matching va **anclado al prefijo** `API Error [n]` —nunca al número suelto— porque `401.00` o `500.00` en un importe activaban el mensaje equivocado.
- `getFriendlyErrorMessage()` aplicaba `includes("500")`: un `409` con un cuerpo que contuviera `500.00` devolvía *«Inténtalo de nuevo en unos minutos»*. Ahora también anclado; el mensaje visible no cambia, solo desaparece el falso positivo.
- **Acceso al código de verificación de email**: la pantalla `/verify-email` existía pero no tenía puntos de entrada alcanzables. El email llegaba sin enlace y `/login` solo permitía llegar tras un reenvío exitoso, dejando al usuario atrapado en el bucle *login → "revisa tu bandeja" → email sin enlace → login sin botón*. Ahora:
  - Los emails de verificación y de recuperación incluyen enlace absoluto con el email ya precargado (`EmailService` + nueva propiedad `app.base-url`).
  - `/login` muestra un enlace directo *«¿Ya tienes un código? Verifica tu cuenta»*.
  - `/login` muestra un botón *«Verificar ahora»* cuando el fallo es *email no verificado*, precargando el email introducido.
- `/verify-email` traducía los errores con `err.message` en crudo; ahora usa `getFriendlyErrorMessage()` (regla #9 de `AGENTS.md`).
- Los dos inputs de `/verify-email` no llevaban `text-neutral-900`, dejando el texto casi invisible (regla #7 de `AGENTS.md`). Igual que los 3 inputs de `/forgot-password`.
- Los 16 `label` de `/login`, `/register`, `/verify-email` y `/forgot-password` no estaban asociados a su control (`htmlFor`/`id`), por lo que pulsar el texto no enfocaba el campo y los lectores de pantalla no los anunciaban.
- Código muerto en `/register`: `useRouter` se importaba y declaraba sin usarse.
- Limpieza reactiva de estado en `ProductDetailPage` al cambiar de talla para evitar el arrastre de inventario de otros SKUs.
- Tratamiento editorial y silencioso del estado "Agotado" sin exponer errores técnicos JSON 400 al usuario.
- Label del campo email en `/profile` sin asociación `htmlFor`/`id`, inaccesible para lectores de pantalla.
- 238 ficheros duplicados con sufijo `" 2"` generados por la resolución de conflictos de git (incluidas migraciones Flyway duplicadas que impedían arrancar el backend).