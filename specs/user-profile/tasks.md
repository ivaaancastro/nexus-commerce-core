# Tasks: Tarea 5.2 — Perfil y Direcciones

> **Estado**: PENDIENTE DE APROBACIÓN
> **Fecha**: 2026-10-01
> **Rama**: `feat/user-profile`

⚠️ **No marcar tareas hasta que la spec esté aprobada y se cree la rama.**

---

## Backend

### UserService y UserController
- [ ] `UserService.getCurrentProfile(email)`
- [ ] `UserService.updateProfile(email, request)`
- [ ] `UserController` con `GET /me` y `PUT /me`
- [ ] Validación de rango en altura (100-250) y peso (30-250)

### AddressService y CRUD
- [ ] `AddressService.list(userId)`
- [ ] `AddressService.create(userId, request)` con límite de 2
- [ ] `AddressService.update(userId, addressId, request)`
- [ ] `AddressService.delete(userId, addressId)`
- [ ] Validar pertenencia de la dirección al usuario
- [ ] Al marcar principal, desmarcar la anterior
- [ ] Si se elimina la principal, promover la otra

### DTOs
- [ ] `ProfileUpdateRequest` (record)
- [ ] `AddressRequest` (record)
- [ ] `AddressResponse` (record)

### Recomendación de talla
- [ ] Lógica de recomendación basada en altura y peso
- [ ] Tabla de tallas por familia de producto
- [ ] Endpoint o servicio de recomendación

### Tests
- [ ] Obtener perfil
- [ ] Actualizar perfil
- [ ] Validar rango de medidas
- [ ] Listar direcciones
- [ ] Añadir dirección
- [ ] Rechazar tercera dirección
- [ ] Marcar principal desmarca la anterior
- [ ] Eliminar dirección
- [ ] Dirección de otro usuario → 404
- [ ] Recomendación de talla

---

## Frontend

### API client
- [ ] `api.getProfile()`
- [ ] `api.updateProfile(data)`
- [ ] `api.getAddresses()`
- [ ] `api.createAddress(data)`
- [ ] `api.updateAddress(id, data)`
- [ ] `api.deleteAddress(id)`

### Página de perfil
- [ ] `app/profile/page.tsx`
- [ ] Formulario precargado con datos del usuario
- [ ] Campos editables (sin email)
- [ ] Inputs con `text-neutral-900`
- [ ] Validación de medidas en cliente
- [ ] Feedback de guardado

### Página de direcciones
- [ ] `app/addresses/page.tsx`
- [ ] Lista de direcciones con badge "Principal"
- [ ] Formulario de alta y edición
- [ ] Botón de eliminar con confirmación
- [ ] Deshabilitar añadir cuando hay 2 direcciones
- [ ] Selector de dirección principal

### Protección de rutas
- [ ] `components/ProtectedRoute.tsx`
- [ ] Envolver `/profile` y `/addresses`
- [ ] Redirección a `/login` sin sesión

### Header
- [ ] Enlace "Cuenta" apunta a `/profile`

### Tests
- [ ] Renderizado del perfil con datos
- [ ] Validación de medidas
- [ ] CRUD de direcciones
- [ ] Límite de 2 direcciones
- [ ] ProtectedRoute redirige sin sesión

---

## Docs

- [ ] `CHANGELOG.md` actualizado
- [ ] `MEMORY.md` actualizado
- [ ] ADR solo si cambia arquitectura

---

*Tasks pendientes de aprobación de la spec.*
