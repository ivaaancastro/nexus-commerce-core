# Tasks: Tarea 5.2 — Perfil y Direcciones

> **Estado**: ✅ COMPLETADA — 2026-10-01
> **Fecha**: 2026-10-01
> **Rama**: `feat/user-profile`
> **Spec**: ✅ Aprobada el 2026-10-01
> **Tests**: 84 backend + 44 frontend en verde
> **Pendiente**: commit + PR (esperando OK del usuario)

---

## Backend ✅ COMPLETADO — 84 tests en verde

### UserService y UserController
- [x] `UserService.getProfile(email)`
- [x] `UserService.updateProfile(email, request)` — actualización parcial: `null` = no modificar
- [x] `UserController` con `GET /me`, `PUT /me`
- [x] Validación de rango en altura (100-250) y peso (30-250)
- [x] Validación de fecha de nacimiento (no futura, no anterior a 1900)

### AddressService y CRUD
- [x] `AddressService.list(email)`
- [x] `AddressService.create(email, request)` con límite de 2
- [x] `AddressService.update(email, addressId, request)`
- [x] `AddressService.delete(email, addressId)`
- [x] Validar pertenencia de la dirección al usuario → 404
- [x] Al marcar principal, desmarcar la anterior
- [x] Si se elimina la principal, promover la otra

### DTOs
- [x] `ProfileUpdateRequest` (record)
- [x] `AddressRequest` (record)
- [x] `AddressResponse` (record)
- [x] `SizeRecommendationRequest` / `SizeRecommendationResponse` (records)

### Recomendación de talla
- [x] Lógica de recomendación basada en altura y peso (interpolación por tramos sobre **centros** de talla)
- [x] Escala canónica XS-XXL + respaldo por posición para escalas desconocidas
- [x] Confianza Alta / Media / Baja según fiabilidad de la tabla
- [x] Endpoint `POST /api/v1/users/me/size-recommendation`
- [ ] ~~Tabla de tallas por familia de producto~~ — ver spec §6.3: escala genérica (catálogo solo tiene `OUTERWEAR`)

### Excepciones
- [x] `ResourceNotFoundException` → 404 en `GlobalExceptionHandler`

### Tests
- [x] Obtener perfil (2)
- [x] Actualizar perfil (3)
- [x] Validar rango de medidas (4)
- [x] Listar direcciones (2)
- [x] Añadir dirección (2)
- [x] Rechazar tercera dirección
- [x] Marcar principal desmarca la anterior
- [x] Eliminar dirección (2)
- [x] Dirección de otro usuario → 404 (2)
- [x] Recomendación de talla (14)

---

## Frontend ✅ COMPLETADO — 44 tests en verde, build y lint OK

### API client
- [x] `api.getProfile()`
- [x] `api.updateProfile(data)`
- [x] `api.getAddresses()`
- [x] `api.createAddress(data)`
- [x] `api.updateAddress(id, data)`
- [x] `api.deleteAddress(id)`
- [x] `api.recommendSize(productId)`

### Página de perfil
- [x] `app/profile/page.tsx`
- [x] Formulario precargado con datos del usuario
- [x] Campos editables (email en solo lectura con `htmlFor`/`id`)
- [x] Inputs con `text-neutral-900`
- [x] Validación de medidas en cliente (altura, peso, fecha de nacimiento)
- [x] Feedback de guardado
- [x] `AuthContext.refreshUser()` para refrescar el header tras guardar

### Página de direcciones
- [x] `app/addresses/page.tsx`
- [x] Lista de direcciones con badge "Principal"
- [x] Formulario de alta y edición
- [x] Botón de eliminar con confirmación en línea (sin `window.confirm`)
- [x] Deshabilitar añadir cuando hay 2 direcciones + mensaje explicativo
- [x] Selector de dirección principal
- [x] Botón "Hacer principal" para la que no lo es

### Protección de rutas
- [x] `components/ProtectedRoute.tsx`
- [x] Envolver `/profile` y `/addresses`
- [x] Redirección a `/login` sin sesión (`router.replace`)
- [x] Estado de carga mientras AuthContext resuelve el token

### Header
- [x] Enlace "Cuenta" apunta a `/profile` (ya existía)

### Tests
- [x] Renderizado del perfil con datos (7 tests)
- [x] Validación de medidas y fecha de nacimiento
- [x] CRUD de direcciones (7 tests)
- [x] Límite de 2 direcciones
- [x] Confirmación antes de eliminar
- [x] ProtectedRoute redirige sin sesión (3 tests)
- [x] Errores de API traducidos a mensajes amigables

---

## Docs ✅ COMPLETADO

- [x] `CHANGELOG.md` actualizado — entradas de perfil, direcciones, `ProtectedRoute`, recomendación de talla y tests
- [x] `MEMORY.md` actualizado — Tarea 5.2 movida a *Tareas Completadas*
- [x] `AGENTS.md` actualizado — bloque de estado con rama `feat/user-profile`
- [x] `README.md` §3 *Catálogo de APIs REST* actualizado — secciones **Autenticación y Sesión** (gap previo de la Tarea 5.1) y **Perfil y Direcciones**
- [x] `specs/user-profile/spec.md` actualizada — criterios marcados + §6 *Apuntes de Implementación*
- [x] ADR — **no procede**: la feature no cambia arquitectura ni stack. Sigue la capa `Controller → Service → Repository`, sin dependencias nuevas ni infraestructura nueva. Las 5 decisiones de diseño quedan registradas en `spec.md` §6.

---

> **Tasks completadas**: ✅ Backend + Frontend + Docs — pendiente de commit/PR
