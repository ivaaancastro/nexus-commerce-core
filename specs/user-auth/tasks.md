# Tasks: Tarea 5.1 — Registro y Login de Usuarios

> **Estado**: EN CURSO  
> **Fecha**: 2026-10-01  
> **Rama**: `feat/user-auth`

---

## Backend

- [x] Entidad `User.java` con todos los campos
- [x] Entidad `Address.java`
- [x] Enum `Gender.java`
- [x] Repositorio `UserRepository.java`
- [x] Repositorio `AddressRepository.java`
- [x] `JwtService.java` — Generación/validación de JWT
- [x] `JwtAuthenticationFilter.java` — Filtro de autenticación
- [x] `SecurityConfig.java` — Configuración de seguridad
- [x] `AuthService.java` — Lógica de autenticación
- [x] `EmailService.java` — Envío de emails
- [x] `AuthController.java` — Endpoints de auth
- [x] DTOs: `RegisterRequest`, `LoginRequest`, `AuthResponse`, `UserResponse`
- [x] Migración `V6__users_schema.sql`
- [x] Migración `V7__orders_user_id.sql`
- [x] Migración `V8__users_measurements_fix.sql`
- [x] Tests de `AuthService` (7 tests)

## Frontend

- [x] Tipos `auth.ts`
- [x] `AuthContext.tsx` — Estado global de autenticación
- [x] API client: register, login, verifyEmail, forgotPassword, resetPassword
- [x] Página `/login`
- [x] Página `/register`
- [x] Página `/verify-email`
- [x] Página `/forgot-password`
- [x] Header actualizado con estado de auth
- [x] Layout actualizado con `AuthProvider`

## Pendiente

- [ ] Verificar flujo completo: registro → email verificación → login
- [ ] Probar con Mailtrap que el email llega correctamente
- [ ] Crear PR de `feat/user-auth` → `feat/user-management`

---

## Notas de Implementación

- EmailService tiene modo desarrollo que loguea el código si no hay credenciales
- `.env` con credenciales de Mailtrap está en `.gitignore`
- Validación de email en frontend: simple y robusta (`includes("@")` + `includes(".")`)
- Errores traducidos a mensajes amigables con `getFriendlyErrorMessage()`

---

*Tasks actualizadas el 2026-10-01*
